import sys, os
sys.path.insert(0, os.path.abspath('.'))
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.api.products_router import generate_download_token

def test_preview_stream():
    client = TestClient(app)
    db = SessionLocal()
    try:
        user = db.query(User).first()
        product = db.query(Product).first()
        if not user or not product:
            print("No user or product found.")
            return

        token = generate_download_token(int(getattr(user, "id")), int(getattr(product, "id")))
        res = client.get(f"/api/products/{product.id}/preview-stream?token={token}")
        print(f"Preview Stream Status: {res.status_code}")
        print(f"Content-Type: {res.headers.get('content-type')}")
        print(f"Content-Disposition: {res.headers.get('content-disposition')}")
        print(f"Bytes count: {len(res.content)}")
    finally:
        db.close()

if __name__ == "__main__":
    test_preview_stream()
