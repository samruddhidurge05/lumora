import sqlite3, os
db_path = 'test.db' if os.path.exists('test.db') else '../test.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    tables = [t[0] for t in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    for t in tables:
        try:
            cur.execute(f"PRAGMA table_info({t})")
            cols = [c[1] for c in cur.fetchall()]
            for c in cols:
                cur.execute(f"SELECT COUNT(*) FROM {t} WHERE {c} LIKE '%pcloud%'")
                count = cur.fetchone()[0]
                if count > 0:
                    print(f"Table: {t} | Column: {c} | Count: {count}")
        except Exception as e:
            pass
    conn.close()
else:
    print("Database not found")
