import sqlite3
import os

db_path = "test.db" if os.path.exists("test.db") else "../test.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Get all products and check if their vendor is active
products = cur.execute("SELECT id, title, vendor_id, status FROM products").fetchall()
users = {str(u[0]): u[1] for u in cur.execute("SELECT id, is_active FROM users").fetchall()}

print(f"Total products in DB: {len(products)}")
inactive_vendor_products = []
non_existent_vendor_numeric_products = []

for p in products:
    pid, title, vid, status = p
    if vid is not None:
        vid_str = str(vid)
        if vid_str.isdigit():
            if vid_str in users:
                is_active = users[vid_str]
                if not is_active:
                    inactive_vendor_products.append(p)
            else:
                non_existent_vendor_numeric_products.append(p)

print(f"Products with inactive vendors: {len(inactive_vendor_products)}")
for p in inactive_vendor_products:
    print(f"  ID={p[0]} title={p[1]} vendor_id={p[2]} status={p[3]}")

print(f"Products with non-existent numeric vendors: {len(non_existent_vendor_numeric_products)}")
for p in non_existent_vendor_numeric_products:
    print(f"  ID={p[0]} title={p[1]} vendor_id={p[2]} status={p[3]}")

conn.close()
