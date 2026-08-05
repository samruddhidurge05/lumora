"""
ZERO-ASSUMPTION FORENSIC INVESTIGATION SCRIPT
==============================================
Performs deep forensic scans across:
  1. All database files (.db, .db.bak, .sqlite) in project
  2. Git commit history (deleted rows, past commits, invitation logs)
  3. Migration files & scratch scripts
  4. Production PostgreSQL database
  5. Firestore code & sync handlers
"""
import os
import sys
import sqlite3
import subprocess
import psycopg2
import psycopg2.extras

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PG_URL = 'postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni?sslmode=require'

def inspect_sqlite_db(path):
    info = {"path": path, "size": os.path.getsize(path), "tables": [], "admin_users": [], "invitations": [], "admin_roles": []}
    try:
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        info["tables"] = [r[0] for r in cur.fetchall()]

        if "users" in info["tables"]:
            cur.execute("SELECT id, name, email, role, created_at FROM users WHERE role='admin'")
            info["admin_users"] = [dict(r) for r in cur.fetchall()]

        if "admin_invitations" in info["tables"]:
            cur.execute("SELECT id, email, role_level, accepted_at, created_at FROM admin_invitations")
            info["invitations"] = [dict(r) for r in cur.fetchall()]

        if "admin_roles" in info["tables"]:
            cur.execute("SELECT id, user_id, role_level, is_active FROM admin_roles")
            info["admin_roles"] = [dict(r) for r in cur.fetchall()]

        conn.close()
    except Exception as e:
        info["error"] = str(e)
    return info

def search_git_history():
    print("\n" + "="*70)
    print("STEP 3A: GIT COMMIT HISTORY FORENSICS (INVITATIONS & ADMINS)")
    print("="*70)

    try:
        # Search git commits referencing admin_invitations or invite
        cmd = ["git", "log", "-S", "admin_invitations", "--oneline", "-n", "30"]
        res = subprocess.run(cmd, cwd=ROOT_DIR, capture_output=True, text=True)
        print("\nCommits touching 'admin_invitations':")
        print(res.stdout if res.stdout else "  (none)")

        # Search git commits referencing invite_admin
        cmd2 = ["git", "log", "-S", "invite_admin", "--oneline", "-n", "30"]
        res2 = subprocess.run(cmd2, cwd=ROOT_DIR, capture_output=True, text=True)
        print("\nCommits touching 'invite_admin':")
        print(res2.stdout if res2.stdout else "  (none)")

        # Search git commit messages for invite/admin/team
        cmd3 = ["git", "log", "--grep=invite", "--oneline", "-n", "30"]
        res3 = subprocess.run(cmd3, cwd=ROOT_DIR, capture_output=True, text=True)
        print("\nCommits with 'invite' in message:")
        print(res3.stdout if res3.stdout else "  (none)")

    except Exception as e:
        print(f"Git history search error: {e}")

def search_all_db_files():
    print("\n" + "="*70)
    print("STEP 1: LOCATING & AUDITING ALL DISCOVERABLE DATABASE FILES")
    print("="*70)

    db_files = []
    for root, dirs, files in os.walk(ROOT_DIR):
        if ".git" in root or ".venv" in root or "node_modules" in root:
            continue
        for f in files:
            if f.endswith(".db") or f.endswith(".sqlite") or f.endswith(".db.bak") or ".db.bak" in f or ".db.purged" in f:
                db_files.append(os.path.join(root, f))

    for db_path in db_files:
        rel = os.path.relpath(db_path, ROOT_DIR)
        info = inspect_sqlite_db(db_path)
        print(f"\n--- Database: {rel} ({info['size']:,} bytes) ---")
        if "error" in info:
            print(f"  Error: {info['error']}")
            continue
        print(f"  Tables: {info['tables']}")
        print(f"  Admin Users Count: {len(info['admin_users'])}")
        for u in info['admin_users']:
            print(f"    -> User #{u['id']}: {u['name']} | {u['email']} | {u['created_at']}")
        print(f"  Invitations Count: {len(info['invitations'])}")
        for inv in info['invitations']:
            print(f"    -> Invite #{inv['id']}: {inv['email']} | role={inv['role_level']} | accepted={inv['accepted_at']}")

def audit_postgresql():
    print("\n" + "="*70)
    print("STEP 4: POSTGRESQL PRODUCTION DATASOURCE SUMMARY")
    print("="*70)

    try:
        conn = psycopg2.connect(PG_URL)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute("SELECT id, name, email, role, created_at FROM users WHERE role='admin'")
        pg_admins = cur.fetchall()

        cur.execute("SELECT * FROM admin_invitations")
        pg_invites = cur.fetchall()

        cur.execute("SELECT * FROM admin_roles WHERE is_active=true")
        pg_roles = cur.fetchall()

        print(f"  PostgreSQL Admin Users ({len(pg_admins)}):")
        for a in pg_admins:
            print(f"    -> #{a['id']}: {a['name']} | {a['email']} | {a['created_at']}")

        print(f"  PostgreSQL Invitations ({len(pg_invites)}):")
        for i in pg_invites:
            print(f"    -> #{i['id']}: {i['email']} | role={i['role_level']} | accepted={i['accepted_at']}")

        print(f"  PostgreSQL Active Admin Roles ({len(pg_roles)}):")
        for r in pg_roles:
            print(f"    -> #{r['id']}: user_id={r['user_id']} | role_level={r['role_level']}")

        conn.close()
    except Exception as e:
        print(f"PostgreSQL audit error: {e}")

def inspect_code_datasources():
    print("\n" + "="*70)
    print("STEP 2: CODESPACE DATASOURCE & ROUTE TRACE ANALYSIS")
    print("="*70)

    # Inspect app/core/config.py, backend/.env, admin-app/.env, main.py, database.py
    files_to_check = [
        "backend/app/core/config.py",
        "backend/.env",
        "admin-app/.env",
        "backend/app/db/database.py",
        "backend/admin/routes/auth.py",
        "backend/app/admin_api/admin_users/routes.py",
        "backend/admin/firestore/admin_firestore.py"
    ]

    for rel in files_to_check:
        full = os.path.join(ROOT_DIR, rel)
        exists = os.path.exists(full)
        print(f"  File: {rel:<45} Exists: {exists}")

if __name__ == "__main__":
    search_all_db_files()
    audit_postgresql()
    search_git_history()
    inspect_code_datasources()
