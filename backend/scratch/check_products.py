import sqlite3
conn = sqlite3.connect('lumora.db')
c = conn.cursor()
c.execute("SELECT id, title, seller, vendor_id, status FROM products WHERE status IN ('published','draft') ORDER BY id DESC")
rows = c.fetchall()
print(f"Total active products in SQLite: {len(rows)}")
for r in rows:
    print(r)
conn.close()
