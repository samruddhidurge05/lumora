"""
sync_single_product.py
-----------------------
Force-syncs a specific product from SQLite to Firestore by title or ID.
Run from backend/ directory:
    .venv/Scripts/python.exe scratch/sync_single_product.py
"""
import sys, os

_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND_ROOT)

# Load .env
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

SEARCH_TITLE = "The Freelancer Client Toolkit"

def main():
    if not firebase_connected or fs_db is None:
        print("[sync] ERROR: Firestore not connected.")
        sys.exit(1)

    session = SessionLocal()
    try:
        # Find by title (case-insensitive)
        product = session.query(Product).filter(
            Product.title.ilike(f"%{SEARCH_TITLE}%")
        ).first()

        if not product:
            print(f"[sync] ERROR: No product found matching '{SEARCH_TITLE}'")
            print("[sync] All products in SQLite:")
            all_p = session.query(Product.id, Product.title, Product.status).all()
            for p in all_p:
                print(f"  ID={p[0]}  title={p[1]}  status={p[2]}")
            sys.exit(1)

        print(f"[sync] Found product in SQLite:")
        print(f"  ID         : {product.id}")
        print(f"  Title      : {product.title}")
        print(f"  seller     : '{product.seller}'")
        print(f"  status     : {product.status}")
        print(f"  thumbnail  : {product.thumbnail}")
        print(f"  preview    : {product.preview}")
        print(f"  image_urls : {product.image_urls}")
        print(f"  pcloud_link: {product.pcloud_download_link}")
        print(f"  file_url   : {product.file_url}")
        print(f"  features   : {product.features}")
        print(f"  category   : {product.category}")
        print(f"  price      : {product.price}")

        # Check if it already exists in Firestore
        doc = fs_db.collection("products").document(str(product.id)).get()
        if doc.exists:
            print(f"\n[sync] Product {product.id} EXISTS in Firestore. Current creatorName: '{doc.to_dict().get('creatorName','MISSING')}'")
            print("[sync] Re-syncing to update all fields...")
        else:
            print(f"\n[sync] Product {product.id} is MISSING from Firestore. Adding now...")

        sync_product_to_firestore(product)

        # Verify
        doc_after = fs_db.collection("products").document(str(product.id)).get()
        if doc_after.exists:
            data = doc_after.to_dict()
            print(f"\n[sync] ? SUCCESS - Product {product.id} is now in Firestore with:")
            print(f"  creatorName : {data.get('creatorName')}")
            print(f"  title       : {data.get('title')}")
            print(f"  status      : {data.get('status')}")
            print(f"  category    : {data.get('category')}")
            print(f"  price       : {data.get('price')}")
            print(f"  thumbnail   : {data.get('thumbnail')}")
            print(f"  preview     : {data.get('preview')}")
            print(f"  image_urls  : {data.get('image_urls')}")
            print(f"  file_url    : {data.get('file_url')}")
            print(f"  features    : {data.get('features')}")
            print(f"  pcloud_link : {data.get('pcloud_download_link')}")
        else:
            print(f"[sync] ? FAILED - product {product.id} still not in Firestore after sync attempt")

    finally:
        session.close()

if __name__ == "__main__":
    main()
