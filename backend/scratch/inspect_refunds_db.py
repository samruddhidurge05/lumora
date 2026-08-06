import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.database import SessionLocal
from app.models.refund_request import RefundRequest
from app.models.order import Order
from app.services.refund_service import refund_service

def inspect_refunds():
    db = SessionLocal()
    try:
        print("=== 1. Checking refund_requests table directly in DB ===")
        db_requests = db.query(RefundRequest).all()
        print(f"Total rows in refund_requests table: {len(db_requests)}")
        for r in db_requests:
            print(f"  RefundRequest ID={r.id}, order_id={r.order_id}, user_id={r.user_id}, status={r.status}, amount={r.requested_amount}")

        print("\n=== 2. Checking orders table for refunded/disputed orders ===")
        orders = db.query(Order).all()
        print(f"Total orders in DB: {len(orders)}")
        for o in orders:
            print(f"  Order ID={o.id}, user_id={o.user_id}, status={o.status}, total={o.total_amount}, payment_id={o.payment_id}")

        print("\n=== 3. Running refund_service.get_all_requests() ===")
        all_reqs = refund_service.get_all_requests(db=db)
        print(f"Total requests returned by get_all_requests(): {len(all_reqs)}")
        for r in all_reqs:
            print(f"  Returned Request object: ID={r.id}, order_id={r.order_id}, status={r.status}, amount={getattr(r, 'requested_amount', None)}")

    finally:
        db.close()

if __name__ == "__main__":
    inspect_refunds()
