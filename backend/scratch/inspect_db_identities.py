import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, r"d:\SAM(DIGI)\digital-marketplace\Digi\digital-marketplace\backend")

from app.db.session import SessionLocal
from app.models.user import User as UserModel
from app.models.order import Order as OrderModel
from app.models.payment import Payment as PaymentModel
from app.shared.firebase.connection import db as fs_db, firebase_connected
from app.services.customer_identity_service import resolve_customer_identity

def main():
    print("=== INSPECTING SQL DATA ===")
    db_s = SessionLocal()
    try:
        users = db_s.query(UserModel).all()
        print(f"Total SQL Users: {len(users)}")
        for u in users:
            print(f"  User ID={u.id}, name={u.name!r}, email={u.email!r}, firebase_uid={u.firebase_uid!r}, role={u.role!r}")

        orders = db_s.query(OrderModel).all()
        print(f"\nTotal SQL Orders: {len(orders)}")
        for o in orders:
            res_name, res_email = resolve_customer_identity(db_s, user_id=o.user_id, order_id=o.id)
            print(f"  Order ID={o.id}, user_id={o.user_id}, total_amount={o.total_amount}, status={o.status} -> Resolved: name={res_name!r}, email={res_email!r}")

        payments = db_s.query(PaymentModel).all()
        print(f"\nTotal SQL Payments: {len(payments)}")
        for p in payments:
            print(f"  Payment ID={p.id}, ref={p.payment_ref}, customer_id={p.customer_id}, order_id={p.order_id}, amount={p.amount}, status={p.status}")

    finally:
        db_s.close()

    print("\n=== INSPECTING FIRESTORE DATA ===")
    print(f"Firebase Connected: {firebase_connected}")
    if firebase_connected and fs_db is not None:
        try:
            u_docs = list(fs_db.collection("users").stream())
            print(f"Firestore 'users' docs: {len(u_docs)}")
            for d in u_docs:
                print(f"  Doc ID={d.id}, Data={d.to_dict()}")

            c_docs = list(fs_db.collection("customers").stream())
            print(f"Firestore 'customers' docs: {len(c_docs)}")
            for d in c_docs:
                print(f"  Doc ID={d.id}, Data={d.to_dict()}")

            o_docs = list(fs_db.collection("orders").stream())
            print(f"Firestore 'orders' docs: {len(o_docs)}")
            for d in o_docs:
                print(f"  Doc ID={d.id}, Data={d.to_dict()}")
        except Exception as e:
            print(f"Error querying Firestore: {e}")

if __name__ == "__main__":
    main()
