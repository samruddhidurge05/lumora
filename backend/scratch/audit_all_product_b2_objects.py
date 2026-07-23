import os
import sys
import requests
from dotenv import load_dotenv

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

from app.db.session import SessionLocal
from app.models.product import Product
from app.services.storage_service import storage_service

def audit_all_product_objects():
    print("=================================================================")
    print("             AUDITING ALL PRODUCTS FOR STORAGE IMPACT            ")
    print("=================================================================")

    db = SessionLocal()
    try:
        products = db.query(Product).all()
        print(f"Total Products in SQLite: {len(products)}")
        
        b2 = storage_service.b2_provider
        if b2.is_available():
            b2._ensure_auth()
            
        for p in products:
            sp = p.storage_path or p.file_url
            if sp and "b2://" in sp or (sp and "backblazeb2.com" in sp):
                b2_key = storage_service.resolve_storage_path_from_url(sp).replace(f"b2://{b2.bucket_name}/", "")
                file_url = f"{b2.download_url}/file/{b2.bucket_name}/{b2_key}"
                res = requests.get(file_url, headers={"Authorization": b2.auth_token})
                print(f"Product ID {p.id} ('{p.title}'):")
                print(f"  Storage Key: {b2_key}")
                print(f"  HTTP Code:   {res.status_code}")
                if res.status_code == 200:
                    print(f"  Size:        {len(res.content)} bytes")
                    print(f"  Snippet:     {res.content[:30]}")

    finally:
        db.close()

if __name__ == "__main__":
    audit_all_product_objects()
