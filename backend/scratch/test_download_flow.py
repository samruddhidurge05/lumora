import sys, os
sys.path.insert(0, os.path.abspath('.'))
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.api.products_router import generate_download_token

def test_product_download_flow():
    client = TestClient(app)
    db = SessionLocal()
    try:
        user = db.query(User).first()
        product = db.query(Product).first()
        
        if not user or not product:
            print("No user or product found in DB for testing.")
            return

        print(f"Testing with User ID {user.id}, Product ID {product.id}")

        token = generate_download_token(int(getattr(user, "id")), int(getattr(product, "id")))
        
        res = client.get(f"/api/products/{product.id}/download-file?token={token}")
        print(f"Download response status: {res.status_code}")
        print(f"Content-Type: {res.headers.get('content-type')}")
        print(f"Content-Disposition: {res.headers.get('content-disposition')}")
        print(f"Downloaded bytes length: {len(res.content)}")

        assert res.status_code == 200, f"Expected 200 OK but got {res.status_code}: {res.text}"
        assert len(res.content) > 0, "Downloaded content should not be empty"
        print("SUCCESS: Product download flow verified!")
    finally:
        db.close()

if __name__ == "__main__":
    test_product_download_flow()
