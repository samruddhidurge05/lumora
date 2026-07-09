import sqlite3

DB_PATH = r"C:\Users\samruddhi\lumora final\lumora\backend\test.db"
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# List all tables
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print("Tables:", tables)

if "products" in tables:
    cur.execute("SELECT id, title, price, features, system_requirements, what_you_get, preview FROM products")
    rows = cur.fetchall()
    for r in rows:
        print("---")
        print("ID:", r["id"], "| Title:", r["title"], "| Price:", r["price"])
        print("  features:", r["features"])
        print("  sys_req:", r["system_requirements"])
        print("  what_get:", r["what_you_get"])
        preview = r["preview"] or ""
        print("  preview:", preview[:120])
else:
    print("No products table found!")

conn.close()
