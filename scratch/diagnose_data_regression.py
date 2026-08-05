import sqlite3
import json
import sys
import os

# Add backend directory to sys.path to import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

conn = sqlite3.connect('lumora.db')
cur = conn.cursor()

print("=== USERS (Full 46) ===")
cur.execute("SELECT id, name, email, role, firebase_uid FROM users")
users = cur.fetchall()
for u in users:
    print(f"User ID {u[0]}: Name='{u[1]}', Email='{u[2]}', Role='{u[3]}', FirebaseUID='{u[4]}'")

print("\n=== ORDERS WITH USER LOOKUP ===")
cur.execute("SELECT id, user_id, status, total_amount, created_at FROM orders")
orders = cur.fetchall()
for o in orders:
    order_id, user_id, status, amount, created_at = o
    cur.execute("SELECT name, email FROM users WHERE id = ?", (user_id,))
    u_row = cur.fetchone()
    u_name = u_row[0] if u_row else "NOT_FOUND"
    u_email = u_row[1] if u_row else "NOT_FOUND"
    print(f"Order #{order_id}: user_id={user_id} -> User Name='{u_name}', Email='{u_email}', Status={status}, Amount={amount}")

print("\n=== PAYMENTS WITH CUSTOMER LOOKUP ===")
cur.execute("SELECT id, payment_ref, order_id, customer_id, amount, status FROM payments")
payments = cur.fetchall()
for p in payments:
    p_id, ref, o_id, cust_id, amount, status = p
    cur.execute("SELECT name, email FROM users WHERE id = ?", (cust_id,))
    u_row = cur.fetchone()
    u_name = u_row[0] if u_row else "NOT_FOUND"
    u_email = u_row[1] if u_row else "NOT_FOUND"
    print(f"Payment #{p_id}: ref={ref}, order_id={o_id}, customer_id={cust_id} -> Name='{u_name}', Email='{u_email}', Amount={amount}")

print("\n=== FIRESTORE CHECK ===")
try:
    from app.shared.firebase.connection import db, firebase_connected
    print(f"Firebase Connected: {firebase_connected}")
    if firebase_connected and db is not None:
        # Check orders in Firestore
        fs_orders = list(db.collection("orders").stream())
        print(f"Firestore 'orders' count: {len(fs_orders)}")
        for doc in fs_orders[:5]:
            print("FS Order Doc:", doc.id, doc.to_dict())

        # Check refunds / refund_requests in Firestore
        for coll in ["refunds", "refund_requests", "refundRequests"]:
            docs = list(db.collection(coll).stream())
            print(f"Firestore '{coll}' count: {len(docs)}")
            for d in docs:
                print(f"FS {coll} Doc:", d.id, d.to_dict())

        # Check users in Firestore
        fs_users = list(db.collection("users").stream())
        print(f"Firestore 'users' count: {len(fs_users)}")
        for d in fs_users[:5]:
            print("FS User Doc:", d.id, d.to_dict())
except Exception as e:
    print(f"Firestore check exception: {e}")
