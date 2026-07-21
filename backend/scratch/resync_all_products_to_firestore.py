"""
One-off script: re-sync ALL products from SQLite ? Firestore with the corrected
sync logic (proper thumbnail, image_urls, features, whatYouGet, etc.)

Run from the backend/ directory:
    python scratch/resync_all_products_to_firestore.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app.db.session import SessionLocal
from app.models.product import Product
from admin.firestore.admin_firestore import sync_product_to_firestore, firebase_connected

def main():
    if not firebase_connected:
        print("?  Firebase not connected - check serviceAccountKey.json / env vars")
        return

    db = SessionLocal()
    try:
        products = db.query(Product).all()
        print(f"Found {len(products)} products in SQLite. Starting Firestore re-sync...\n")

        ok = 0
        fail = 0
        for p in products:
            try:
                # Auto-fix: if thumbnail/preview is missing, derive from image_urls
                if not p.thumbnail and isinstance(p.image_urls, list) and p.image_urls:
                    p.thumbnail = p.image_urls[0]
                if not p.preview and isinstance(p.image_urls, list) and p.image_urls:
                    p.preview = p.image_urls[0]

                sync_product_to_firestore(p)
                print(f"  ?  [{p.id}] {p.title[:50]!r}  |  thumbnail={p.thumbnail or 'none'}  |  image_urls={len(p.image_urls or [])}  |  features={len(p.features or [])}")
                ok += 1
            except Exception as e:
                print(f"  ?  [{p.id}] {p.title[:50]!r}  ?  {e}")
                fail += 1

        print(f"\n?  Done - {ok} synced, {fail} failed")
    finally:
        db.close()

if __name__ == "__main__":
    main()
