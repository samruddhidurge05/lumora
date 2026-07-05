
import sqlite3
conn = sqlite3.connect('lumora.db')
cur = conn.cursor()
cur.execute('SELECT id, email, role, password_hash FROM users LIMIT 10')
rows = cur.fetchall()
for r in rows:
    h = r[3] if r[3] else 'NULL'
    print(f"id={r[0]} email={r[1]} role={r[2]} hash={h[:25]}")
total = cur.execute('SELECT COUNT(*) FROM users').fetchone()[0]
print(f"Total users: {total}")
conn.close()
