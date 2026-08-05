"""
PHASE 3 — Root-Level Database Audit
There is a lumora.db at the PROJECT ROOT (not inside backend/).
This script checks EVERY .db file at root and backend level.
"""
import sqlite3
import os

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # project root
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))               # backend/

print(f"Project root: {ROOT_DIR}")
print(f"Backend dir:  {BACKEND_DIR}\n")

DB_FILES = []
for dir_path, label in [(ROOT_DIR, "PROJECT ROOT"), (BACKEND_DIR, "BACKEND DIR")]:
    for fname in os.listdir(dir_path):
        if fname.endswith(".db") or fname.endswith(".db.bak"):
            full = os.path.join(dir_path, fname)
            DB_FILES.append((full, label))

print(f"{'='*65}")
print(f"ALL .db FILES FOUND")
print(f"{'='*65}")

for db_path, label in DB_FILES:
    size = os.path.getsize(db_path)
    print(f"\n[{label}] {db_path}")
    print(f"  Size: {size:,} bytes")
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # Check tables
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cur.fetchall()]
        print(f"  Tables: {tables}")

        if "users" in tables:
            cur.execute("SELECT COUNT(*) FROM users")
            total = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM users WHERE role='admin'")
            admin_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM users WHERE email LIKE '%@lumora.io%'")
            lumora_count = cur.fetchone()[0]
            print(f"  Users total: {total}, admin: {admin_count}, @lumora.io: {lumora_count}")
            
            if admin_count > 0:
                cur.execute("SELECT id, name, email, role, created_at FROM users WHERE role='admin' LIMIT 10")
                rows = cur.fetchall()
                print(f"  ADMIN USERS:")
                for r in rows:
                    print(f"    {dict(r)}")

        if "admin_roles" in tables:
            cur.execute("SELECT COUNT(*) FROM admin_roles")
            ar_total = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM admin_roles WHERE is_active=1")
            ar_active = cur.fetchone()[0]
            print(f"  admin_roles: total={ar_total}, active={ar_active}")
            if ar_active > 0:
                cur.execute("SELECT id, user_id, role_level, is_active FROM admin_roles WHERE is_active=1 LIMIT 10")
                for r in cur.fetchall():
                    print(f"    {dict(r)}")

        if "admin_invitations" in tables:
            cur.execute("SELECT COUNT(*) FROM admin_invitations")
            inv_total = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM admin_invitations WHERE email LIKE '%@lumora.io%'")
            inv_lumora = cur.fetchone()[0]
            print(f"  admin_invitations: total={inv_total}, @lumora.io={inv_lumora}")

        conn.close()
    except Exception as e:
        print(f"  ERROR querying: {e}")

print("\n\nFINDING: If root lumora.db has fake admins, it is NOT what the backend reads.")
print("The backend/.env points to: sqlite:///./lumora.db (relative to backend/ CWD)")
print("So backend/ CWD resolves to backend/lumora.db, NOT root lumora.db")
print("But Render may use a different CWD or DATABASE_URL pointing to a persistent disk.")
