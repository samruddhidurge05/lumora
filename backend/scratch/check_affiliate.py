import sqlite3

conn = sqlite3.connect('test.db')
c = conn.cursor()

# All tables
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
all_tables = [r[0] for r in c.fetchall()]
print("All tables:", all_tables)
print()

# Affiliate tables
aff_tables = [t for t in all_tables if 'affil' in t.lower()]
print("Affiliate tables:", aff_tables)
print()

# Product affiliate settings for our 4 key products
c.execute("SELECT id, title, affiliate_enabled, commission_type, commission_value FROM products WHERE id IN (108,109,111,112) ORDER BY id")
rows = c.fetchall()
print("Product affiliate settings:")
for r in rows:
    print(f"  ID:{r[0]} | {r[1]} | affiliate_enabled:{r[2]} | type:{r[3]} | value:{r[4]}")
print()

# Also check affiliate_product_links or similar table if it exists
for t in aff_tables:
    c.execute(f"PRAGMA table_info({t})")
    cols = [col[1] for col in c.fetchall()]
    print(f"Table '{t}' columns: {cols}")
    c.execute(f"SELECT * FROM {t} LIMIT 3")
    rows = c.fetchall()
    print(f"  Sample rows: {rows}")

conn.close()
