import sqlite3

def check_db(name):
    try:
        conn = sqlite3.connect(name)
        cur = conn.cursor()
        users = cur.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        try:
            products = cur.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        except Exception:
            products = "N/A"
        print(f"[{name}] users: {users}, products: {products}")
        conn.close()
    except Exception as e:
        print(f"[{name}] error: {e}")

check_db("test.db")
check_db("lumora.db")
