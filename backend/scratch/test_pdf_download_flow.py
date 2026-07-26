import sys, os
sys.path.insert(0, os.path.abspath('.'))
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.api.products_router import generate_download_token

def test_pdf_download():
    client = TestClient(app)
    db = SessionLocal()
    try:
        user = db.query(User).first()
        pdf_product = db.query(Product).filter(Product.title.like("%pdf%") | Product.storage_path.like("%.pdf")).first()
        if not pdf_product:
            print("No PDF product found in DB.")
            return

        print(f"Testing PDF Product ID: {pdf_product.id}, Title: {pdf_product.title}, Path: {pdf_product.storage_path}")

        token = generate_download_token(int(getattr(user, "id")), int(getattr(pdf_product, "id")))
        res = client.get(f"/api/products/{pdf_product.id}/download-file?token={token}")
        
        print(f"Status Code: {res.status_code}")
        print(f"Content-Type: {res.headers.get('content-type')}")
        print(f"Content-Disposition: {res.headers.get('content-disposition')}")
        print(f"Bytes count: {len(res.content)}")
        print(f"Is PDF header: {res.content.startswith(b'%PDF')}")

        assert res.status_code == 200
        assert "application/pdf" in res.headers.get('content-type')
        assert ".pdf" in res.headers.get('content-disposition')
        print("SUCCESS: PDF Product download verified!")
    finally:
        db.close()

if __name__ == "__main__":
    test_pdf_download()
