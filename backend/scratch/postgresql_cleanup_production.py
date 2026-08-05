"""
PHASE 8 — PostgreSQL Production Cleanup
========================================
Removes fake/test administrator records from production PostgreSQL.
ONLY run this AFTER reviewing the output of postgresql_forensic_audit.py.

USAGE:
  python backend/scratch/postgresql_cleanup_production.py <DATABASE_URL>

SAFETY:
  - Creates a transaction — all changes are atomic
  - Prints all SQL before executing
  - Asks for confirmation before committing
  - Preserves all LEGIT_EMAILS accounts unconditionally
"""
import sys
import os

LEGIT_EMAILS = {
    "avikapawar08@gmail.com",
    "451.avikapawar@gmail.com",
    "admin@lumora.co",
    "samruddhidurge05@gmail.com",
}

TEST_EMAIL_PATTERNS = [
    "%@lumora.io%",
]

def main():
    if len(sys.argv) < 2:
        print("ERROR: DATABASE_URL required as argument")
        print("USAGE: python postgresql_cleanup_production.py <DATABASE_URL>")
        sys.exit(1)

    db_url = sys.argv[1]
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    if "sslmode" not in db_url:
        sep = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{sep}sslmode=require"

    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        print("ERROR: pip install psycopg2-binary")
        sys.exit(1)

    print(f"\n{'='*70}")
    print("PHASE 8 — POSTGRESQL PRODUCTION CLEANUP")
    print(f"{'='*70}\n")

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    print("[OK] Connected to PostgreSQL\n")

    # --- Find fake user IDs (exclude LEGIT_EMAILS) ---
    fake_user_ids = []
    for pattern in TEST_EMAIL_PATTERNS:
        cur.execute(
            "SELECT id, name, email FROM users WHERE email ILIKE %s",
            (pattern,)
        )
        rows = cur.fetchall()
        for r in rows:
            if r["email"].lower() not in LEGIT_EMAILS:
                fake_user_ids.append(r["id"])

    fake_user_ids = list(set(fake_user_ids))

    if not fake_user_ids:
        print("[OK] No fake/test user records found in PostgreSQL.")
        print("     Database is clean. No action required.")
        cur.close()
        conn.close()
        return

    # --- Count what will be removed ---
    cur.execute("SELECT id, name, email FROM users WHERE id = ANY(%s)", (fake_user_ids,))
    fake_users = cur.fetchall()

    cur.execute("SELECT COUNT(*) as cnt FROM admin_roles WHERE user_id = ANY(%s)", (fake_user_ids,))
    roles_count = cur.fetchone()["cnt"]

    cur.execute("SELECT COUNT(*) as cnt FROM admin_invitations WHERE email ILIKE '%@lumora.io%'")
    inv_count = cur.fetchone()["cnt"]

    cur.execute("SELECT COUNT(*) as cnt FROM audit_logs WHERE admin_user_id = ANY(%s)", (fake_user_ids,))
    log_count = cur.fetchone()["cnt"]

    print("RECORDS TO BE REMOVED:")
    print(f"  Fake users:           {len(fake_users)}")
    print(f"  Fake admin_roles:     {roles_count}")
    print(f"  Fake invitations:     {inv_count}")
    print(f"  Fake audit_logs:      {log_count}")
    print()
    print("FAKE USERS:")
    for u in fake_users:
        print(f"  id={u['id']} | {u['name']} | {u['email']}")

    print()
    print("LEGITIMATE USERS (will NOT be touched):")
    cur.execute("SELECT id, name, email FROM users WHERE email = ANY(%s)", (list(LEGIT_EMAILS),))
    for u in cur.fetchall():
        print(f"  id={u['id']} | {u['name']} | {u['email']} [PROTECTED]")

    print()
    print("="*70)
    confirm = input("Type 'DELETE' to confirm and execute cleanup, or anything else to abort: ").strip()
    if confirm != "DELETE":
        print("ABORTED. No changes made.")
        conn.rollback()
        cur.close()
        conn.close()
        return

    print("\nExecuting cleanup inside transaction...\n")

    # Step 1: Delete admin_roles
    cur.execute("DELETE FROM admin_roles WHERE user_id = ANY(%s)", (fake_user_ids,))
    deleted_roles = cur.rowcount
    print(f"  [1/4] Deleted admin_roles: {deleted_roles}")

    # Step 2: Delete admin_invitations
    cur.execute("DELETE FROM admin_invitations WHERE email ILIKE '%@lumora.io%'")
    deleted_invitations = cur.rowcount
    print(f"  [2/4] Deleted admin_invitations: {deleted_invitations}")

    # Step 3: Delete audit_logs
    cur.execute("DELETE FROM audit_logs WHERE admin_user_id = ANY(%s)", (fake_user_ids,))
    deleted_logs = cur.rowcount
    print(f"  [3/4] Deleted audit_logs: {deleted_logs}")

    # Step 4: Delete users
    cur.execute("DELETE FROM users WHERE id = ANY(%s) AND email NOT IN %s",
                (fake_user_ids, tuple(LEGIT_EMAILS)))
    deleted_users = cur.rowcount
    print(f"  [4/4] Deleted users: {deleted_users}")

    # Commit
    conn.commit()
    print("\n[COMMITTED] All changes committed successfully.")

    # Verification
    print("\nVERIFICATION:")
    cur.execute("SELECT COUNT(*) as cnt FROM users WHERE email ILIKE '%@lumora.io%'")
    remaining = cur.fetchone()["cnt"]
    print(f"  Remaining @lumora.io users: {remaining}")

    cur.execute("""
        SELECT ar.id, ar.user_id, ar.role_level, u.name, u.email
        FROM admin_roles ar
        JOIN users u ON u.id = ar.user_id
        WHERE ar.is_active = true
    """)
    active_admins = cur.fetchall()
    print(f"  Active admin team members: {len(active_admins)}")
    for a in active_admins:
        print(f"    -> {a['name']} | {a['email']} | {a['role_level']}")

    cur.close()
    conn.close()
    print("\nCleanup complete.")


if __name__ == "__main__":
    main()
