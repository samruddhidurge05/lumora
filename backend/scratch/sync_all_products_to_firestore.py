"""
sync_all_products_to_firestore.py
----------------------------------
One-time utility: reads every published/draft product from SQLite and
pushes it to Firestore using the canonical sync_product_to_firestore()
function. Fixes:
  - Products missing from Firestore (e.g. 118, 119)
  - Stale fields (e.g. creatorName showing personal name instead of brand)

Run from backend/ directory:
    .venv/Scripts/python.exe scratch/sync_all_products_to_firestore.py
"""
import sys, os

# -- Add backend root to sys.path ----------------------------------------------
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND_ROOT)

# -- Load .env so FIREBASE_SERVICE_ACCOUNT_JSON is available ------------------
_env_path = os.path.join(_BACKEND_ROOT, ".env")
if os.path.exists(_env_path):
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip())

from app.db.session import SessionLocal
from app.models.product import Product
from app.shared.firebase.connection import db as fs_db, firebase_connected
from admin.firestore.admin_firestore import sync_product_to_firestore

def main():
    print("[sync] Checking Firestore connection...")
    if not firebase_connected or fs_db is None:
        print("[sync] ERROR: Firestore is not connected. Aborting.")
        sys.exit(1)
    print("[sync] Firestore connected OK.")

    # Fetch all existing Firestore product IDs
    print("[sync] Fetching existing Firestore product IDs...")
    existing_fs_ids = set()
    try:
        for doc in fs_db.collection("products").stream():
            existing_fs_ids.add(doc.id)
    except Exception as e:
        print(f"[sync] WARNING: Could not fetch Firestore IDs: {e}")
    print(f"[sync] Firestore currently has {len(existing_fs_ids)} product documents.")

    # Fetch all active products from SQLite
    session = SessionLocal()
    try:
        products = session.query(Product).filter(
            Product.status.in_(["published", "draft"])
        ).order_by(Product.id.asc()).all()
        print(f"[sync] SQLite has {len(products)} active products (published + draft).")

        synced = 0
        skipped = 0
        missing = []
        stale = []

        for product in products:
            pid = str(product.id)
            if pid not in existing_fs_ids:
                missing.append(product.id)
            else:
                # Check if creatorName is stale (different from current seller)
                try:
                    fs_doc = fs_db.collection("products").document(pid).get()
                    if fs_doc.exists:
                        fs_data = fs_doc.to_dict() or {}
                        fs_creator = fs_data.get("creatorName", "")
                        sqlite_seller = (product.seller or "").strip()
                        if fs_creator != sqlite_seller and sqlite_seller:
                            stale.append((product.id, fs_creator, sqlite_seller))
                except Exception:
                    pass

        print(f"\n[sync] Missing from Firestore: {missing}")
        print(f"[sync] Stale creatorName in Firestore: {[(pid, old, new) for pid, old, new in stale]}")

        # Sync ALL products - both missing ones and stale ones get updated
        # sync_product_to_firestore uses merge=True so existing docs are updated, not replaced
        print(f"\n[sync] Starting full sync of all {len(products)} products...")
        for product in products:
            try:
                sync_product_to_firestore(product)
                synced += 1
                if synced % 10 == 0:
                    print(f"[sync]   Synced {synced}/{len(products)}...")
            except Exception as e:
                print(f"[sync]   ERROR syncing product {product.id} ({product.title}): {e}")
                skipped += 1

        print(f"\n[sync] ? Done! Synced: {synced}, Errors: {skipped}")
        print(f"[sync] Previously missing products now added: {missing}")
        if stale:
            print(f"[sync] Fixed stale creatorName for product IDs: {[p[0] for p in stale]}")

    finally:
        session.close()

if __name__ == "__main__":
    main()
