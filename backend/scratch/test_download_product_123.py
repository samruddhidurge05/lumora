import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.session import SessionLocal
from app.models.product import Product
from app.api.products_router import generate_download_token, download_product_file
from app.services.storage_service import storage_service

def test_download_product_123():
    print("=================================================================")
    print("             TESTING DOWNLOAD ROUTE FOR PRODUCT 123              ")
    print("=================================================================")

    db = SessionLocal()
    try:
        p123 = db.query(Product).filter(Product.id == 123).first()
        print(f"[Product Record] ID: {p123.id} | Title: {p123.title}")
        print(f"  storage_path:   {p123.storage_path}")
        print(f"  file_url:       {p123.file_url}")
        print(f"  thumbnail_path: {p123.thumbnail_path}")
        print(f"  preview_path:   {p123.preview_path}")
        
        # Verify logical object-key structure
        assert "private/products/123/" in p123.storage_path, "Private downloadable file must be under private/products/123/"
        assert "public/products/123/thumbnail/" in p123.thumbnail_path, "Public thumbnail must be under public/products/123/thumbnail/"
        assert "public/products/123/previews/" in p123.preview_path, "Public preview must be under public/products/123/previews/"
        print("[Pass] Storage paths follow the correct B2 Public / Private structure.")

        # Test download token generation
        token = generate_download_token(user_id=1, product_id=123)
        print(f"[Pass] Download Token generated for Product 123: {token[:20]}...")

    finally:
        db.close()

if __name__ == "__main__":
    test_download_product_123()
