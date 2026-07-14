import sqlite3
import os

db_path = "test.db" if os.path.exists("test.db") else "../test.db"
print(f"Opening database: {os.path.abspath(db_path)}")
conn = sqlite3.connect(db_path)
cur = conn.cursor()
tables = [t[0] for t in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("Tables:")
for t in tables:
    count = cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    print(f"  {t}: {count}")

print("\nUsers:")
users = cur.execute("SELECT id, email, name, role, is_active FROM users").fetchall()
for u in users:
    print(f"  {u}")

print("\nProduct statuses/vendors:")
products = cur.execute("SELECT id, title, status, vendor_id, category FROM products").fetchall()
print(f"Total products: {len(products)}")
for p in products[:15]:
    print(f"  ID={p[0]} title={p[1][:30]} status={p[2]} vendor_id={p[3]} category={p[4]}")
conn.close()
