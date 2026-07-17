"""
push_all_to_firestore.py
─────────────────────────
One-time script: Sync ALL published SQLite products to Firestore so the
Render backend can restore them on next deploy via restore_sqlite_products_from_firestore().

Run from backend/ directory:
    python scripts/push_all_to_firestore.py
"""
import sys
import os

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.product import Product
from app.shared.firebase.connection import db as firestore_db, firebase_connected
from admin.firestore.admin_firestore import sync_product_to_firestore

def push_all():
    if not firebase_connected or firestore_db is None:
        print("[push] ERROR: Firebase not connected. Cannot push to Firestore.")
        return

    db = SessionLocal()
    try:
        products = db.query(Product).filter(Product.status.in_(["published", "draft"])).all()
        print(f"[push] Found {len(products)} products in SQLite. Syncing to Firestore...")

        # Get existing Firestore document IDs
        existing = {doc.id for doc in firestore_db.collection("products").stream()}
        print(f"[push] Firestore already has {len(existing)} product docs.")

        pushed = 0
        skipped = 0
        for p in products:
            try:
                sync_product_to_firestore(p)
                if str(p.id) not in existing:
                    pushed += 1
                    print(f"[push]   NEW → {p.id}: {p.title}")
                else:
                    skipped += 1
            except Exception as e:
                print(f"[push]   ERROR product {p.id}: {e}")

        print(f"\n[push] Done. Pushed {pushed} new products, updated {skipped} existing.")
    finally:
        db.close()

if __name__ == "__main__":
    push_all()
