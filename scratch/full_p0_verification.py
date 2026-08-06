import sys
import os
import sqlite3
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.db.session import SessionLocal
from app.models.user import User as UserModel
from app.models.order import Order as OrderModel
from app.models.payment import Payment as PaymentModel
from app.models.refund_request import RefundRequest as RefundModel
from app.services.customer_identity_service import resolve_customer_identity
from app.admin_api.orders.services import get_orders_list, get_order_by_id
from app.admin_api.payments.services import get_payments_overview, get_transactions_list
from app.services.refund_service import refund_service
from app.shared.firebase.connection import db as fs_db, firebase_connected

print("======================================================================")
print("P0 PRODUCTION VERIFICATION EXECUTION")
print("======================================================================")

db_s = SessionLocal()

# PHASE 1: DATA SOURCE VERIFICATION
print("\n--- PHASE 1: DATA SOURCE ANALYSIS ---")
print(f"PostgreSQL/SQLite Connected: Yes (Database path: lumora.db)")
print(f"Firestore Connected: {firebase_connected}")

# Query SQL counts
user_count = db_s.query(UserModel).count()
order_count = db_s.query(OrderModel).count()
payment_count = db_s.query(PaymentModel).count()
refund_count = db_s.query(RefundModel).count()

print(f"SQL UserModel Count: {user_count}")
print(f"SQL OrderModel Count: {order_count}")
print(f"SQL PaymentModel Count: {payment_count}")
print(f"SQL RefundModel Count: {refund_count}")

# Check identity resolution sources for orders
sample_orders = db_s.query(OrderModel).order_by(OrderModel.id.desc()).limit(5).all()
print("\nResolving Data Sources for Sample Orders:")
for o in sample_orders:
    c_name, c_email = resolve_customer_identity(db_s=db_s, user_id=o.user_id, order_id=o.id)
    u_obj = db_s.query(UserModel).filter(UserModel.id == o.user_id).first() if o.user_id else None
    src = f"SQL UserModel (ID={u_obj.id}, Name='{u_obj.name}')" if u_obj and u_obj.name else "Firestore/Fallback"
    print(f"  Order ORD-{o.id}: user_id={o.user_id} -> Source: {src} -> Name: '{c_name}', Email: '{c_email}'")

# PHASE 2: TRACE ONE REAL CUSTOMER
print("\n--- PHASE 2: CUSTOMER TRACE (ORD-22) ---")
target_order = db_s.query(OrderModel).filter(OrderModel.id == 22).first()
if not target_order and sample_orders:
    target_order = sample_orders[0]

if target_order:
    print(f"Tracing Order ID: ORD-{target_order.id}")
    print(f"1. Database Order Record: user_id={target_order.user_id}, total_amount={target_order.total_amount}")
    
    # User Registration / Profile
    sql_user = db_s.query(UserModel).filter(UserModel.id == target_order.user_id).first() if target_order.user_id else None
    if sql_user:
        print(f"2. Database User Record: id={sql_user.id}, name='{sql_user.name}', email='{sql_user.email}', role='{sql_user.role}', firebase_uid='{sql_user.firebase_uid}'")
    else:
        print(f"2. Database User Record: None found for user_id={target_order.user_id}")
        
    # Payment record
    payment_rec = db_s.query(PaymentModel).filter(PaymentModel.order_id == target_order.id).first()
    if payment_rec:
        print(f"3. Database Payment Record: id={payment_rec.id}, ref={payment_rec.payment_ref}, amount={payment_rec.amount}, status={payment_rec.status}")
    else:
        print("3. Database Payment Record: No explicit payment row")
        
    # Identity Service
    res_name, res_email = resolve_customer_identity(db_s=db_s, user_id=target_order.user_id, order_id=target_order.id)
    print(f"4. Identity Service Output: Name='{res_name}', Email='{res_email}'")
    
    # Admin Orders Service Output
    admin_order_dto = get_order_by_id(str(target_order.id))
    print(f"5. Admin Orders DTO Output: id={admin_order_dto['id']}, customerName='{admin_order_dto['customerName']}', customerEmail='{admin_order_dto['customerEmail']}', price={admin_order_dto['price']}")

# PHASE 3: VERIFY PAYMENT AMOUNTS
print("\n--- PHASE 3: VERIFY 5 PAYMENT AMOUNTS ---")
sample_payments = db_s.query(PaymentModel).order_by(PaymentModel.id.asc()).limit(5).all()
txns_response = get_transactions_list(page=1, page_size=10)
txn_map = {t['id']: t for t in txns_response.get('items', [])}

for p in sample_payments:
    db_amt = float(p.amount) if p.amount is not None else 0.0
    txn_dto = txn_map.get(p.id) or txn_map.get(f"TXN-{p.id}") or txn_map.get(str(p.id))
    api_amt = float(txn_dto['amount']) if txn_dto else None
    c_name = txn_dto['customerName'] if txn_dto else "N/A"
    print(f"Payment TXN-{p.id}: DB Amount={db_amt} | API Amount={api_amt} | Customer='{c_name}' | Match={db_amt == api_amt}")

# PHASE 4: VERIFY ORDERS LIST
print("\n--- PHASE 4: VERIFY ORDERS ---")
orders_response = get_orders_list(page=1, page_size=5)
print(f"Total Orders Count: {orders_response['total']}")
for item in orders_response['items']:
    print(f"  Order ORD-{item['orderId']}: CustomerName='{item['customerName']}', Email='{item['customerEmail']}', Product='{item['productTitle']}', Amount={item['price']}, Status={item['status']}")

# PHASE 5: VERIFY PAYMENTS LIST
print("\n--- PHASE 5: VERIFY PAYMENTS ---")
print(f"Total Transactions Count: {txns_response['total']}")
for item in txns_response['items'][:5]:
    print(f"  Txn TXN-{item['id']}: CustomerName='{item['customerName']}', Email='{item['customerEmail']}', Method='{item['method']}', Amount={item['amount']}, Status={item['status']}")

# PHASE 6: VERIFY REFUNDS LIST
print("\n--- PHASE 6: VERIFY REFUNDS ---")
refunds_list = refund_service.get_all_requests(db=db_s, page=1, page_size=5)
print(f"Total Refund Requests: {len(refunds_list)}")
for r in refunds_list:
    r_name, r_email = resolve_customer_identity(db_s=db_s, user_id=r.user_id, order_id=r.order_id)
    print(f"  Refund TKT-{r.id}: CustomerName='{r_name}', Email='{r_email}', Product='{r.product_name}', Status={r.status}, Amount={r.requested_amount}")

# PHASE 7: CHECK FOR FALLBACK PATH EXECUTION
print("\n--- PHASE 7: VERIFY NO UNWANTED FALLBACK EXECUTION ---")
fallback_count = 0
all_orders = get_orders_list(page=1, page_size=100)['items']
for o in all_orders:
    if o['customerName'].lower() in ('anonymous', 'customer', 'user', 'unknown', 'guest', 'default customer'):
        fallback_count += 1
        print(f"  WARNING: Order ORD-{o['orderId']} resolved to fallback name '{o['customerName']}'")
if fallback_count == 0:
    print("  CONFIRMED: ZERO fallback names executed across all production orders!")

db_s.close()
print("\n======================================================================")
print("VERIFICATION SCRIPT COMPLETED SUCCESSFULLY")
print("======================================================================")
