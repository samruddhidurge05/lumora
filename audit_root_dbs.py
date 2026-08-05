"""
PHASE 3b — Root-Level Database Audit (run from project root)
Checks root lumora.db, test.db, and all .db files at project root.
"""
import sqlite3
import os

ROOT = os.path.dirname(os.path.abspath(__file__))  # project root since this runs from root

print(f"Working dir: {ROOT}\n")

# All db files to check
candidates = []
for fname in os.listdir(ROOT):
    if fname.endswith(".db") or fname.endswith(".db.bak"):
        candidates.append(os.path.join(ROOT, fname))

# Also check backend/ subfolder ones
backend = os.path.join(ROOT, "backend")
for fname in os.listdir(backend):
    if fname.endswith(".db") or fname.endswith(".db.bak"):
        candidates.append(os.path.join(backend, fname))

print(f"{'='*65}")
print("ALL .db FILES")
print(f"{'='*65}")

for db_path in candidates:
    size = os.path.getsize(db_path)
    relative = db_path.replace(ROOT, "")
    print(f"\n  {relative}  ({size:,} bytes)")
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cur.fetchall()]
        if "users" not in tables:
            print(f"    No users table")
            conn.close()
            continue
        cur.execute("SELECT COUNT(*) FROM users")
        tc = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM users WHERE role='admin'")
        ac = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM users WHERE email LIKE '%@lumora.io%'")
        lc = cur.fetchone()[0]
        print(f"    users: {tc} total | {ac} admin | {lc} @lumora.io")
        if ac > 0:
            cur.execute("SELECT id,name,email FROM users WHERE role='admin' LIMIT 5")
            for r in cur.fetchall():
                print(f"      -> id={r[0]} | {r[1]} | {r[2]}")
        try:
            cur.execute("SELECT COUNT(*) FROM admin_roles")
            print(f"    admin_roles: {cur.fetchone()[0]}")
        except: pass
        try:
            cur.execute("SELECT COUNT(*) FROM admin_invitations")
            inv_total = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM admin_invitations WHERE email LIKE '%@lumora.io%'")
            inv_lumora = cur.fetchone()[0]
            print(f"    admin_invitations: {inv_total} total | {inv_lumora} @lumora.io")
        except: pass
        conn.close()
    except Exception as e:
        print(f"    ERROR: {e}")

print(f"\n{'='*65}")
print("CONFIG.PY DEFAULT DATABASE_URL ANALYSIS")
print(f"{'='*65}")
print("config.py default: sqlite:///./test.db")
print("If Render has no DATABASE_URL env var => it reads test.db from CWD")
print("If Render CWD is project root => ROOT test.db")
print("If Render CWD is backend/ => backend/test.db (does not exist as a standalone file)")
print()
print("backend/.env has: DATABASE_URL=sqlite:///./lumora.db")
print("So if backend/.env is loaded, it reads backend/lumora.db (CLEAN)")
print()
print("KEY QUESTION: Does Render load backend/.env? Or is DATABASE_URL set in Render env vars?")
