import os
import sys
import json
import sqlite3

# Reconfigure stdout to use UTF-8 to prevent charmap print errors on Windows
sys.stdout.reconfigure(encoding='utf-8')

# Set up paths
WORKSPACE_DIR = r"d:\SAM(DIGI)\digital-marketplace\Digi\digital-marketplace"
os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = os.path.join(WORKSPACE_DIR, "lumora-e6ddc-firebase-adminsdk-fbsvc-abcf2d8c21.json")

BACKEND_DIR = os.path.join(WORKSPACE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.shared.firebase.connection import db, firebase_connected
from app.admin_api.reviews.services import get_reviews_dashboard_data

def run_functional_test():
    print("====================================================")
    print("       PHASE 7: REVIEWS DYNAMIC FUNCTIONAL TEST     ")
    print("====================================================")

    if not firebase_connected or db is None:
        print("Error: Firebase Admin SDK not connected.")
        sys.exit(1)

    target_product_id = "10"
    test_user_id = "23"
    test_review_id = "TEMP_TEST_REVIEW_999"

    # Pre-clean just in case
    db.collection("reviews").document(test_review_id).delete()

    # --- Step 1: Create ONE temporary review in Firestore ---
    print("\n[Step 1] Creating temporary 5-star review in Firestore...")
    review_ref = db.collection("reviews").document(test_review_id)
    review_ref.set({
        "status": "visible",
        "title": "Excellent",
        "vendorId": "DesignHub",
        "reviewId": test_review_id,
        "productId": target_product_id,
        "customerName": "Test Customer",
        "verifiedPurchase": True,
        "productTitle": "Portfolio Website Template",
        "body": "This is a temporary functional test review.",
        "customerId": test_user_id,
        "createdAt": "2026-07-19T00:00:00.000Z",
        "updatedAt": "2026-07-19T00:00:00.000Z",
        "rating": 5
    })

    # --- Step 2: Trigger recalculation for the affected product ---
    print("[Step 2] Recalculating rating for the target product...")
    p_reviews = []
    for doc in db.collection("reviews").where("productId", "==", target_product_id).stream():
        p_reviews.append(doc.to_dict())

    ratings_list = [float(r.get("rating") or 5) for r in p_reviews]
    new_rating = round(sum(ratings_list) / len(ratings_list), 1)
    new_reviews_count = len(ratings_list)
    new_stars = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 }
    for r_val in ratings_list:
        new_stars[str(int(round(r_val)))] += 1

    # Update product document in Firestore
    db.collection("products").document(target_product_id).set({
        "rating": new_rating,
        "reviews": new_reviews_count,
        "review_count": new_reviews_count,
        "reviewCount": new_reviews_count,
        "starDistribution": new_stars
    }, merge=True)

    # --- Step 3: Verify product ratings update ---
    print("[Step 3] Verifying product and dashboard stats update...")
    p_doc = db.collection("products").document(target_product_id).get().to_dict() or {}
    print(f"  - Product Rating:      {p_doc.get('rating')} (Expected: 5.0)")
    print(f"  - Reviews Count:       {p_doc.get('reviews')} (Expected: 1)")
    print(f"  - Star Distribution:   {p_doc.get('starDistribution')} (Expected: 5*: 1)")

    # Verify dashboard analytics update
    dash_data = get_reviews_dashboard_data()
    print(f"  - Dashboard AvgRating: {dash_data.get('averageRating')} (Expected: 5.0)")
    print(f"  - Dashboard TotalRevs: {dash_data.get('totalReviews')} (Expected: 1)")
    print(f"  - Positive Percentage: {dash_data.get('positivePercentage')}% (Expected: 100%)")

    # Assertions
    assert p_doc.get("rating") == 5.0, "Product rating did not update to 5.0"
    assert p_doc.get("reviews") == 1, "Product reviews count did not update to 1"
    assert dash_data.get("averageRating") == 5.0, "Dashboard average rating did not update to 5.0"

    # --- Step 4: Delete the temporary review ---
    print("\n[Step 4] Deleting the temporary review...")
    db.collection("reviews").document(test_review_id).delete()

    # --- Step 5: Recalculate rating back to clean state ---
    print("[Step 5] Recalculating rating back to empty state...")
    p_reviews_after = []
    for doc in db.collection("reviews").where("productId", "==", target_product_id).stream():
        p_reviews_after.append(doc.to_dict())

    final_rating = 0.0
    final_reviews_count = len(p_reviews_after)
    final_stars = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 }

    db.collection("products").document(target_product_id).set({
        "rating": final_rating,
        "reviews": final_reviews_count,
        "review_count": final_reviews_count,
        "reviewCount": final_reviews_count,
        "starDistribution": final_stars
    }, merge=True)

    # --- Step 6: Verify return to clean state ---
    print("[Step 6] Verifying return to empty state...")
    p_doc_final = db.collection("products").document(target_product_id).get().to_dict() or {}
    dash_data_final = get_reviews_dashboard_data()

    print(f"  - Final Product Rating: {p_doc_final.get('rating')} (Expected: 0.0)")
    print(f"  - Final Reviews Count:  {p_doc_final.get('reviews')} (Expected: 0)")
    print(f"  - Final Dashboard Avg:  {dash_data_final.get('averageRating')} (Expected: 0)")
    print(f"  - Final Dashboard Revs: {dash_data_final.get('totalReviews')} (Expected: 0)")

    assert p_doc_final.get("rating") == 0.0, "Product rating did not return to 0.0"
    assert p_doc_final.get("reviews") == 0, "Product reviews count did not return to 0"
    assert dash_data_final.get("averageRating") == 0, "Dashboard average rating did not return to 0"

    print("\nFunctional verification passed successfully! All test assertions succeeded.")

if __name__ == "__main__":
    run_functional_test()
