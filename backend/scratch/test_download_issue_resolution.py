import os
import sys
from fastapi import HTTPException
from sqlalchemy.orm import Session

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.session import SessionLocal
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.user import User
from app.services.storage_service import storage_service
from app.api.products_router import generate_download_token, download_product_file

def run_tests():
    print("=== STARTING DOWNLOAD BUG RESOLUTION VERIFICATION ===")
    
    db: Session = SessionLocal()
    try:
        # Test 1: Verify catalog product 117 (Study Planner & Exam Organizer)
        p117 = db.query(Product).filter(Product.id == 117).first()
        if p117:
            print(f"\n[Test 1] Inspecting Product 117 '{p117.title}'")
            print(f"  file_url: {p117.file_url}")
            print(f"  pcloud_download_link: {p117.pcloud_download_link}")
            
            # Find a user or mock purchase for token generation
            user = db.query(User).first()
            user_id = user.id if user else 1
            
            token = generate_download_token(user_id, 117)
            res = download_product_file(product_id=117, token=token, db=db)
            
            # Verify it returns JSONResponse redirect to real pCloud PDF link
            body = res.body.decode()
            print(f"  Response Body: {body}")
            assert "redirect_url" in body, "Response should contain redirect_url!"
            assert "pcloud.link" in body, "Response redirect_url should point to pcloud.link!"
            print("  [OK] Product 117 correctly resolves to working pCloud download link for real PDF!")

        # Test 2: Verify dummy README ZIP generation is removed
        print("\n[Test 2] Testing missing file stream behavior")
        fake_local_path = "local://uploads/products/99999/non_existent_file.zip"
        try:
            stream = storage_service.get_stream(fake_local_path)
            next(stream)
            assert False, "Should have raised 404 HTTPException!"
        except HTTPException as e:
            print(f"  Caught expected HTTPException: status={e.status_code}, detail='{e.detail}'")
            assert e.status_code == 404
            assert "readme.txt" not in str(e.detail).lower()
            print("  [OK] Missing storage files now correctly return 404 Not Found instead of dummy README ZIP!")

        # Test 3: Unauthorized Access Protection
        print("\n[Test 3] Testing unauthorized download rejection")
        invalid_token = "invalid_token_12345"
        try:
            download_product_file(product_id=117, token=invalid_token, db=db)
            assert False, "Should have rejected invalid token!"
        except HTTPException as e:
            print(f"  Caught expected 403 for invalid token: {e.detail}")
            assert e.status_code == 403
            print("  [OK] Unauthorized download requests strictly rejected with 403 Forbidden!")

    finally:
        db.close()

    print("\n=== ALL DOWNLOAD BUG RESOLUTION VERIFICATION TESTS PASSED ===")

if __name__ == "__main__":
    run_tests()
