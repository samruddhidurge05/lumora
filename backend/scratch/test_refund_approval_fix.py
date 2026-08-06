import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.database import SessionLocal
from app.models.refund_request import RefundRequest
from app.models.order import Order
from app.services.refund_service import refund_service

def test_refund_approval():
    db = SessionLocal()
    try:
        print("=== Step 1: Attempting approve_refund for Order/Request ID 1 ===")
        # Test approving for ID 1 (which previously returned 404 because no refund_requests row existed)
        res = refund_service.approve_refund(db=db, request_id=1, admin_id=1, notes="Verified in production audit")
        print(f"Approval Success! Returned RefundRequest ID: {res.id}, Status: {res.status}, Order ID: {res.order_id}")

        # Verify DB updates
        db_req = db.query(RefundRequest).filter(RefundRequest.id == res.id).first()
        print(f"PostgreSQL RefundRequest row: ID={db_req.id}, OrderID={db_req.order_id}, Status={db_req.status}, Notes='{db_req.admin_notes}'")

        db_order = db.query(Order).filter(Order.id == res.order_id).first()
        print(f"PostgreSQL Order row: ID={db_order.id}, Status={db_order.status}")

        assert db_req.status == "APPROVED", "RefundRequest status must be APPROVED"
        assert db_order.status == "refunded", "Order status must be refunded"
        print("=== SUCCESS: Refund approval verified on Render PostgreSQL! ===")
    except Exception as e:
        print(f"=== FAILURE: {e} ===")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_refund_approval()
