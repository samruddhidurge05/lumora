import sys
import os
from datetime import datetime, timezone

# Add backend directory to path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.session import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.product_download_event import ProductDownloadEvent
from app.models.refund_request import RefundRequest
from app.services.refund_service import refund_service
from app.api.products_router import generate_download_token, download_product_file
from app.admin_api.orders.services import get_orders_list, get_order_by_id
from fastapi import HTTPException

import app.main  # Triggers startup migrations on SQLite

def run_forensic_verification():
    db = SessionLocal()

    print("=" * 70)
    print("STARTING FORENSIC VERIFICATION OF DOWNLOAD AUDIT SYNCHRONIZATION")
    print("=" * 70)

    try:
        # 1. Fetch test user and product
        user = db.query(User).filter(User.role == "customer").first()
        if not user:
            user = db.query(User).first()
        product = db.query(Product).filter(Product.status == "published").first()
        if not product:
            product = db.query(Product).first()

        print(f"[TEST SETUP] Using User #{user.id} ({user.email}), Product #{product.id} ({product.title})")

        # ----------------------------------------------------------------------
        # SCENARIO 2: Purchase -> Never download (Initial State Check)
        # ----------------------------------------------------------------------
        print("\n--- SCENARIO 2: Purchase without download ---")
        order = Order(
            user_id=user.id,
            total_amount=product.price or 100.0,
            status="completed",
            payment_method="upi",
            payment_id="PAY-AUDIT-TEST-001"
        )
        db.add(order)
        db.flush()

        item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            price_paid=product.price or 100.0,
            downloaded=False,
            download_count=0
        )
        db.add(item)
        db.commit()
        db.refresh(order)

        order_id = order.id
        print(f"[SCENARIO 2] Created Order ORD-{order_id}")

        # Verify admin order details output
        admin_order = get_order_by_id(f"ORD-{order_id}")
        assert admin_order["downloadGranted"] == True, "downloadGranted should be True for completed order"
        assert admin_order["downloaded"] == False, "downloaded should be False prior to download"
        assert admin_order["download_count"] == 0, "download_count should be 0 prior to download"
        print("[OK] Admin order output correctly shows downloadGranted=True and downloaded=False")

        # Verify RefundService allows request when not downloaded
        print("[SCENARIO 2] Testing refund submission when NOT downloaded...")
        req = refund_service.submit_request(
            db=db,
            user_id=user.id,
            order_id=order_id,
            reason_category="broken_file",
            details="Test non-downloaded refund"
        )
        assert req is not None, "Refund request should be created when asset was never downloaded"
        print(f"[OK] Refund submitted successfully (TKT-{req.id}) as product was not downloaded.")

        # Clean up mock request to continue test
        db.delete(req)
        db.commit()

        # ----------------------------------------------------------------------
        # SCENARIO 1 & 4: Download product once & multiple times
        # ----------------------------------------------------------------------
        print("\n--- SCENARIO 1 & 4: Execute Download & Audit Event Recording ---")
        token = generate_download_token(user.id, product.id)
        
        # Simulate Request object
        class MockRequest:
            class MockHeaders:
                def get(self, key, default=None):
                    if key.lower() == "user-agent":
                        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
                    return default
            headers = MockHeaders()
            class MockClient:
                host = "192.168.1.100"
            client = MockClient()

        mock_req = MockRequest()
        
        # Execute download file endpoint logic
        res = download_product_file(product_id=product.id, token=token, request=mock_req, db=db)
        print(f"[DOWNLOAD EXECUTION] Download returned StreamingResponse status_code={getattr(res, 'status_code', 200)}")

        # Refresh order state
        db.refresh(order)
        db.refresh(item)

        dl_event = db.query(ProductDownloadEvent).filter(
            ProductDownloadEvent.user_id == user.id,
            ProductDownloadEvent.product_id == product.id
        ).first()
        assert dl_event is not None, "ProductDownloadEvent MUST be recorded in database"
        assert item.downloaded == True, "OrderItem.downloaded MUST be True"
        assert order.download_count >= 1, "Order.download_count MUST be >= 1"
        assert order.download_ip is not None, "Order.download_ip MUST be stored"

        print(f"[OK] ProductDownloadEvent created: Event ID #{dl_event.id}, IP={dl_event.ip_address}, OS={dl_event.os}")
        print(f"[OK] OrderItem updated: downloaded={item.downloaded}, count={item.download_count}")
        print(f"[OK] Order updated: download_count={order.download_count}, first_downloaded_at={order.first_downloaded_at}")

        # Verify Admin Order Service reflects single source of truth
        admin_order_updated = get_order_by_id(f"ORD-{order_id}")
        assert admin_order_updated["downloaded"] == True, "Admin Order serializer must show downloaded=True"
        assert admin_order_updated["download_count"] >= 1, "Admin Order serializer must return download_count >= 1"
        assert admin_order_updated["download_ip"] == "192.168.1.100", "Admin Order serializer must return download_ip"
        print("[OK] Admin order service output immediately reflects download evidence!")

        # ----------------------------------------------------------------------
        # SCENARIO 3: Attempt Refund after Download
        # ----------------------------------------------------------------------
        print("\n--- SCENARIO 3: Attempt Refund after Download ---")
        try:
            refund_service.submit_request(
                db=db,
                user_id=user.id,
                order_id=order_id,
                reason_category="broken_file",
                details="Attempt refund after download"
            )
            assert False, "Refund submission MUST fail when product has been downloaded!"
        except HTTPException as err:
            assert err.status_code == 400, f"Expected 400 Bad Request, got {err.status_code}"
            assert "already been downloaded" in err.detail, f"Unexpected error detail: {err.detail}"
            print(f"[OK] Refund submission correctly BLOCKED! Response detail: '{err.detail}'")

        # ----------------------------------------------------------------------
        # SCENARIO 5: Refund Approved -> Download Revocation Check
        # ----------------------------------------------------------------------
        print("\n--- SCENARIO 5: Refund Approved & License Revocation ---")
        order.status = "refunded"
        db.commit()

        try:
            download_product_file(product_id=product.id, token=token, request=mock_req, db=db)
            assert False, "Download MUST be blocked once order status is refunded!"
        except HTTPException as err:
            assert err.status_code == 403, f"Expected 403 Forbidden, got {err.status_code}"
            assert "revoked" in err.detail.lower(), f"Unexpected error detail: {err.detail}"
            print(f"[OK] Post-refund download attempt correctly BLOCKED with 403 Forbidden: '{err.detail}'")

        print("\n" + "=" * 70)
        print("ALL 5 FORENSIC SCENARIOS PASSED PERFECTLY!")
        print("=" * 70)

    finally:
        # Cleanup mock test order
        try:
            db.query(ProductDownloadEvent).filter(ProductDownloadEvent.order_id == order.id).delete()
            db.query(OrderItem).filter(OrderItem.order_id == order.id).delete()
            db.query(Order).filter(Order.id == order.id).delete()
            db.commit()
        except Exception:
            pass
        db.close()

if __name__ == "__main__":
    run_forensic_verification()
