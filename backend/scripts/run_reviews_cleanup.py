import os
import sys
import json
import sqlite3
import shutil
import datetime

# Set up paths
WORKSPACE_DIR = r"d:\SAM(DIGI)\digital-marketplace\Digi\digital-marketplace"
os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = os.path.join(WORKSPACE_DIR, "lumora-e6ddc-firebase-adminsdk-fbsvc-abcf2d8c21.json")

BACKEND_DIR = os.path.join(WORKSPACE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.shared.firebase.connection import db, firebase_connected

def main():
    execute = "--execute" in sys.argv
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = os.path.join(BACKEND_DIR, "backups")
    os.makedirs(backup_dir, exist_ok=True)
    
    print("====================================================")
    print("      PRODUCTION REVIEWS & RATINGS CLEANUP          ")
    print("====================================================")
    if not execute:
        print(">>> DRY RUN MODE. Use '--execute' to perform changes. <<<")
    else:
        print(">>> LIVE EXECUTION MODE. Performing database updates. <<<")
    print("====================================================")

    if not firebase_connected or db is None:
        print("Error: Firebase Admin SDK not connected.")
        sys.exit(1)

    # ----------------------------------------------------
    # Phase 2: Forensic Verification
    # ----------------------------------------------------
    print("\n[Phase 2/8] Performing Forensic Verification...")
    all_reviews = []
    for doc in db.collection("reviews").stream():
        data = doc.to_dict() or {}
        all_reviews.append((doc.id, data))

    review_count = len(all_reviews)
    print(f"Review Count: {review_count}")
    print("----------------------------------------------------")
    print(f"{'Review ID':<40} | {'Product ID':<10} | {'User ID':<40} | {'Rating':<6} | {'Created At':<25}")
    print("-" * 130)
    for r_id, r_data in all_reviews:
        p_id = r_data.get("productId") or r_data.get("product_id")
        u_id = r_data.get("customerId") or r_data.get("userId")
        rating = r_data.get("rating")
        created_at = r_data.get("createdAt") or r_data.get("created_at") or "Unknown"
        text = r_data.get("body") or r_data.get("comment") or ""
        print(f"{r_id:<40} | {str(p_id):<10} | {str(u_id):<40} | {str(rating):<6} | {created_at:<25}")
        print(f"  > Text: \"{text}\"")

    if review_count > 3:
        print(f"\n[ABORT] Forensic check failed: Found {review_count} reviews (limit is 3). Aborting.")
        sys.exit(1)
    else:
        print("\nForensic verification passed. Reviews count is within limit.")

    # ----------------------------------------------------
    # Phase 1: Backup Everything
    # ----------------------------------------------------
    sqlite_src = os.path.join(BACKEND_DIR, "lumora.db")
    sqlite_backup = os.path.join(backup_dir, f"lumora_backup_reviews_{timestamp}.db")
    firestore_backup = os.path.join(backup_dir, f"firestore_backup_reviews_{timestamp}.json")
    manifest_path = os.path.join(backup_dir, "review_cleanup_manifest.json")

    print("\n[Phase 1/8] Compiling backup manifest and exporting states...")
    
    # Read product rating states before change
    products_before = {}
    
    # Firestore products
    for doc in db.collection("products").stream():
        pdata = doc.to_dict() or {}
        products_before[doc.id] = {
            "source": "firestore",
            "rating": pdata.get("rating"),
            "reviews": pdata.get("reviews") or pdata.get("review_count") or pdata.get("reviewCount"),
            "starDistribution": pdata.get("starDistribution") or pdata.get("stars")
        }
    
    # SQLite products
    if os.path.exists(sqlite_src):
        conn = sqlite3.connect(sqlite_src)
        cur = conn.cursor()
        cur.execute("SELECT id, rating, reviews FROM products")
        for pid, rating, reviews in cur.fetchall():
            k = str(pid)
            if k in products_before:
                products_before[k]["sqlite_rating"] = rating
                products_before[k]["sqlite_reviews"] = reviews
            else:
                products_before[k] = {
                    "source": "sqlite_only",
                    "sqlite_rating": rating,
                    "sqlite_reviews": reviews
                }
        conn.close()

    manifest_data = {
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "reviews_count_before": review_count,
        "reviews_to_delete": [r_id for r_id, _ in all_reviews],
        "products_before": products_before
    }

    if execute:
        # Copy SQLite
        if os.path.exists(sqlite_src):
            shutil.copy(sqlite_src, sqlite_backup)
            print(f"  SQLite database backed up to: {sqlite_backup}")
            
        # Export Firestore reviews
        with open(firestore_backup, "w", encoding="utf-8") as f:
            json.dump({r_id: r_data for r_id, r_data in all_reviews}, f, indent=2, default=str)
        print(f"  Firestore review documents exported to: {firestore_backup}")

        # Write Manifest
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, indent=2, default=str)
        print(f"  Review cleanup manifest written to: {manifest_path}")

    # ----------------------------------------------------
    # Phase 3: Delete Reviews
    # ----------------------------------------------------
    deleted_reviews = []
    if execute:
        print("\n[Phase 3/8] Deleting mock reviews from Firestore...")
        for r_id, r_data in all_reviews:
            db.collection("reviews").document(r_id).delete()
            print(f"  Deleted review document: {r_id}")
            deleted_reviews.append(r_id)

    # ----------------------------------------------------
    # Phase 4: Recalculate Product Ratings
    # ----------------------------------------------------
    recalculated_products = []
    skipped_products = []
    errors = []
    warnings = []

    # Get remaining reviews (should be 0 after execution, or same as all_reviews in dry-run)
    remaining_reviews = []
    if execute:
        # After deletion, remaining reviews is empty
        remaining_reviews = []
    else:
        # Dry-run evaluates based on what remains if we deleted all_reviews
        remaining_reviews = []

    # Build product reviews mapping
    prod_reviews_map = {}
    for r_id, r_data in remaining_reviews:
        p_id = str(r_data.get("productId") or r_data.get("product_id") or "")
        if p_id:
            if p_id not in prod_reviews_map:
                prod_reviews_map[p_id] = []
            prod_reviews_map[p_id].append(r_data)

    print("\n[Phase 4/8] Recalculating ratings per product...")

    # Load all products from Firestore to recalculate
    fs_products_list = list(db.collection("products").stream())
    
    # 1. Update Firestore Products
    fs_updated_count = 0
    fs_skipped_count = 0
    
    if execute:
        batch = db.batch()
        for doc in fs_products_list:
            p_id = doc.id
            pdata = doc.to_dict() or {}
            
            # Current values
            cur_rating = pdata.get("rating")
            cur_reviews = pdata.get("reviews") or pdata.get("review_count") or pdata.get("reviewCount")
            cur_stars = pdata.get("starDistribution") or pdata.get("stars")
            
            pre_rating = float(cur_rating) if cur_rating is not None else 0.0
            pre_reviews = int(cur_reviews) if cur_reviews is not None else 0
            
            # Recalculate from remaining reviews
            target_rating = 0.0
            target_reviews = 0
            target_stars = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 }
            
            if p_id in prod_reviews_map:
                p_revs = prod_reviews_map[p_id]
                ratings_list = [float(r.get("rating") or 5) for r in p_revs]
                target_rating = round(sum(ratings_list) / len(ratings_list), 1)
                target_reviews = len(ratings_list)
                for r_val in ratings_list:
                    r_str = str(int(round(r_val)))
                    if r_str in target_stars:
                        target_stars[r_str] += 1
            
            # Check if values actually change
            changed = (
                abs(pre_rating - target_rating) > 0.01 or
                pre_reviews != target_reviews or
                cur_stars != target_stars
            )
            
            if changed:
                ref = db.collection("products").document(p_id)
                batch.set(ref, {
                    "rating": target_rating,
                    "reviews": target_reviews,
                    "review_count": target_reviews,
                    "reviewCount": target_reviews,
                    "starDistribution": target_stars
                }, merge=True)
                fs_updated_count += 1
                recalculated_products.append(f"Firestore product {p_id} ('{pdata.get('title')}') -> reset to {target_rating} ({target_reviews} reviews)")
            else:
                fs_skipped_count += 1
                skipped_products.append(f"Firestore product {p_id} ('{pdata.get('title')}')")
                
        if fs_updated_count > 0:
            batch.commit()
        print(f"  Firestore products updated: {fs_updated_count}, skipped: {fs_skipped_count}")

    # 2. Update SQLite Products
    sq_updated_count = 0
    sq_skipped_count = 0
    
    if execute and os.path.exists(sqlite_src):
        conn = sqlite3.connect(sqlite_src)
        cur = conn.cursor()
        
        # Get all products from SQLite
        cur.execute("SELECT id, title, rating, reviews FROM products")
        sqlite_products = cur.fetchall()
        
        for pid, title, cur_rating, cur_reviews in sqlite_products:
            p_id = str(pid)
            pre_rating = float(cur_rating) if cur_rating is not None else 0.0
            pre_reviews = int(cur_reviews) if cur_reviews is not None else 0
            
            target_rating = 0.0
            target_reviews = 0
            
            if p_id in prod_reviews_map:
                p_revs = prod_reviews_map[p_id]
                ratings_list = [float(r.get("rating") or 5) for r in p_revs]
                target_rating = round(sum(ratings_list) / len(ratings_list), 1)
                target_reviews = len(ratings_list)
                
            changed = (
                abs(pre_rating - target_rating) > 0.01 or
                pre_reviews != target_reviews
            )
            
            if changed:
                cur.execute("UPDATE products SET rating = ?, reviews = ? WHERE id = ?", (target_rating, target_reviews, pid))
                sq_updated_count += 1
                recalculated_products.append(f"SQLite product {p_id} ('{title}') -> reset to {target_rating} ({target_reviews} reviews)")
            else:
                sq_skipped_count += 1
                skipped_products.append(f"SQLite product {p_id} ('{title}')")
                
        conn.commit()
        conn.close()
        print(f"  SQLite products updated: {sq_updated_count}, skipped: {sq_skipped_count}")

    # ----------------------------------------------------
    # Phase 8: Post Cleanup Report
    # ----------------------------------------------------
    print("\n[Phase 8/8] Generating Post Cleanup Report...")
    verification_passed = True
    
    # Automated post-checks if executed
    if execute:
        # Check remaining reviews
        remaining_revs_snap = list(db.collection("reviews").stream())
        if len(remaining_revs_snap) != 0:
            verification_passed = False
            errors.append(f"Firestore reviews count is {len(remaining_revs_snap)} instead of 0")
            
        # Check SQLite counts
        if os.path.exists(sqlite_src):
            conn = sqlite3.connect(sqlite_src)
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM reviews")
            sqlite_rev_cnt = cur.fetchone()[0]
            if sqlite_rev_cnt != 0:
                verification_passed = False
                errors.append(f"SQLite reviews count is {sqlite_rev_cnt} instead of 0")
            conn.close()

    print("\n" + "=" * 50)
    print("           REVIEWS CLEANUP SUMMARY REPORT          ")
    print("" + "=" * 50)
    print(f"Reviews before cleanup: {review_count}")
    print(f"Reviews deleted:        {len(deleted_reviews)}")
    print(f"Reviews remaining:      {review_count - len(deleted_reviews)}")
    print(f"Products recalculated:  {len(recalculated_products)}")
    print(f"Products skipped:       {len(skipped_products)}")
    print(f"Errors:                 {len(errors)}")
    print(f"Warnings:               {len(warnings)}")
    print(f"Verification Passed:    {verification_passed}")
    print(f"Verification Failed:    {not verification_passed}")
    print("=" * 50)

    if errors:
        print("\nErrors encountered:")
        for err in errors:
            print(f"  [ERROR] {err}")
            
    if warnings:
        print("\nWarnings encountered:")
        for warn in warnings:
            print(f"  [WARNING] {warn}")
            
    # Exit with code if verification failed
    if not verification_passed:
        sys.exit(1)

if __name__ == "__main__":
    main()
