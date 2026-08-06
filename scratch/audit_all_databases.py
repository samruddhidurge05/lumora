import sqlite3
import json
from pathlib import Path

RENDER_PG_URL = "postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni?sslmode=require"

root_dir = Path(__file__).resolve().parent.parent

def audit_sqlite(db_path: Path, label: str):
    print(f"\n=======================================================")
    print(f"AUDITING LOCAL SQLITE DB: {label} ({db_path})")
    print(f"=======================================================")
    if not db_path.exists():
        print(f"File {db_path} DOES NOT EXIST.")
        return
    
    print(f"File Size: {db_path.stat().st_size} bytes")
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    # Get tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [t[0] for t in cursor.fetchall()]
    print(f"Tables in {label}: {tables}")

    counts = {}
    for t in ("users", "orders", "payments", "refunds", "products"):
        if t in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {t};")
            counts[t] = cursor.fetchone()[0]
        else:
            counts[t] = 0
    
    print(f"\n--- {label} Table Row Counts ---")
    print(f"  Users:    {counts.get('users', 0)}")
    print(f"  Orders:   {counts.get('orders', 0)}")
    print(f"  Payments: {counts.get('payments', 0)}")
    print(f"  Refunds:  {counts.get('refunds', 0)}")
    print(f"  Products: {counts.get('products', 0)}")

    if "users" in tables:
        cursor.execute("SELECT id, name, email, role FROM users LIMIT 10;")
        users = cursor.fetchall()
        print(f"\n--- {label} Sample Users (first 10) ---")
        for u in users:
            print(f"  User ID={u[0]} | Name='{u[1]}' | Email='{u[2]}' | Role='{u[3]}'")

    if "orders" in tables:
        cursor.execute("SELECT id, user_id, total_amount, status FROM orders LIMIT 10;")
        orders = cursor.fetchall()
        print(f"\n--- {label} Sample Orders (first 10) ---")
        for o in orders:
            # Check user match
            cursor.execute("SELECT name, email FROM users WHERE id = ?;", (o[1],))
            u_row = cursor.fetchone()
            u_name = u_row[0] if u_row else "NOT FOUND IN USERS TABLE"
            u_email = u_row[1] if u_row else "N/A"
            print(f"  Order ID={o[0]} | user_id={o[1]} | total_amount={o[2]} | status='{o[3]}' | Matched User: '{u_name}' ({u_email})")

    conn.close()

def audit_postgres():
    print(f"\n=======================================================")
    print(f"AUDITING RENDER POSTGRESQL INSTANCE")
    print(f"Host: dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com")
    print(f"Database: lumora_db_k4ni")
    print(f"=======================================================")
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(RENDER_PG_URL)
        with engine.connect() as conn:
            tables_res = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"))
            tables = [r[0] for r in tables_res.fetchall()]
            print(f"Tables in Render PostgreSQL: {tables}")

            counts = {}
            for t in ("users", "orders", "payments", "refunds", "products"):
                if t in tables:
                    res = conn.execute(text(f"SELECT COUNT(*) FROM {t};"))
                    counts[t] = res.fetchone()[0]
                else:
                    counts[t] = 0

            print(f"\n--- Render PostgreSQL Table Row Counts ---")
            print(f"  Users:    {counts.get('users', 0)}")
            print(f"  Orders:   {counts.get('orders', 0)}")
            print(f"  Payments: {counts.get('payments', 0)}")
            print(f"  Refunds:  {counts.get('refunds', 0)}")
            print(f"  Products: {counts.get('products', 0)}")

            if "users" in tables:
                u_res = conn.execute(text("SELECT id, name, email, role FROM users LIMIT 10;"))
                users = u_res.fetchall()
                print(f"\n--- Render PostgreSQL Sample Users (first 10) ---")
                for u in users:
                    print(f"  User ID={u[0]} | Name='{u[1]}' | Email='{u[2]}' | Role='{u[3]}'")

            if "orders" in tables:
                o_res = conn.execute(text("SELECT id, user_id, total_amount, status FROM orders LIMIT 10;"))
                orders = o_res.fetchall()
                print(f"\n--- Render PostgreSQL Sample Orders (first 10) ---")
                for o in orders:
                    u_match = conn.execute(text("SELECT name, email FROM users WHERE id = :uid"), {"uid": o[1]}).fetchone()
                    u_name = u_match[0] if u_match else "NOT FOUND IN USERS TABLE"
                    u_email = u_match[1] if u_match else "N/A"
                    print(f"  Order ID={o[0]} | user_id={o[1]} | total_amount={o[2]} | status='{o[3]}' | Matched User: '{u_name}' ({u_email})")

    except Exception as e:
        print(f"Failed to connect or query Render PostgreSQL: {e}")

if __name__ == "__main__":
    audit_sqlite(root_dir / "lumora.db", "lumora.db")
    audit_sqlite(root_dir / "test.db", "test.db")
    audit_postgres()
