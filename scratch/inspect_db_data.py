import sys
import os
import sqlite3

conn = sqlite3.connect('lumora.db')
cur = conn.cursor()

print("=== ORDERS TABLE ===")
cur.execute("SELECT id, user_id, status, total_amount, payment_method FROM orders")
orders = cur.fetchall()
for o in orders:
    print(f"Order ID {o[0]}: user_id={o[1]}, status='{o[2]}', total_amount={o[3]}, method='{o[4]}'")

print("\n=== PAYMENTS TABLE ===")
cur.execute("SELECT id, payment_ref, order_id, customer_id, amount, status FROM payments")
payments = cur.fetchall()
for p in payments:
    print(f"Payment ID {p[0]}: ref='{p[1]}', order_id={p[2]}, customer_id={p[3]}, amount={p[4]}, status='{p[5]}'")

conn.close()
