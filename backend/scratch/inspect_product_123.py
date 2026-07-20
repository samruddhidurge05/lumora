import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.session import SessionLocal
from app.models.product import Product
from app.services.storage_service import storage_service
from app.shared.firebase.connection import db as fs_db

def inspect_product_123():
    print("=================================================================")
    print("                   INSPECTING PRODUCT ID 123                     ")
    print("=================================================================")

    db = SessionLocal()
    try:
        p123 = db.query(Product).filter(Product.id == 123).first()
        if not p123:
            print("[SQLite] Product ID 123 NOT FOUND in SQLite database!")
        else:
            print(f"[SQLite] Found Product 123:")
            print(f"  ID:             {p123.id}")
            print(f"  Title:          {p123.title}")
            print(f"  Vendor ID:      {p123.vendor_id}")
            print(f"  Seller:         {p123.seller}")
            print(f"  Status:         {p123.status}")
            print(f"  Price:          {p123.price}")
            print(f"  Category:       {p123.category}")
            print(f"  file_url:       {p123.file_url}")
            print(f"  storage_path:   {p123.storage_path}")
            print(f"  thumbnail:      {p123.thumbnail}")
            print(f"  preview:        {p123.preview}")
            print(f"  thumbnail_path: {p123.thumbnail_path}")
            print(f"  preview_path:   {p123.preview_path}")
            print(f"  image_urls:     {p123.image_urls}")

            # Test B2 storage resolution for Product 123
            if p123.storage_path:
                resolved_sp = storage_service.resolve_storage_path_from_url(p123.storage_path)
                print(f"  Resolved Storage Path: {resolved_sp}")
                print(f"  Storage Service Exists? {storage_service.exists(resolved_sp)}")

        # Also inspect Firestore
        try:
            if fs_db:
                doc = fs_db.collection("products").document("123").get()
                if doc.exists:
                    print(f"\n[Firestore] Found Document '123' in Cloud Firestore:")
                    data = doc.to_dict()
                    for k, v in data.items():
                        print(f"  {k}: {v}")
                else:
                    print(f"\n[Firestore] Document '123' does NOT exist in Cloud Firestore.")
        except Exception as e:
            print(f"\n[Firestore Notice] Could not query Firestore: {e}")

    finally:
        db.close()

if __name__ == "__main__":
    inspect_product_123()
