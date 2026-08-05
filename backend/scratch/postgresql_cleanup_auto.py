"""
PHASE 8 — Non-Interactive Production PostgreSQL Cleanup (Dynamic Cascading Cleanup)
====================================================================================
Dynamically discovers all child tables referencing orders.id and users.id,
clearing all dependent test rows before purging test users and orders.
"""
import sys
import psycopg2
import psycopg2.extras

LEGIT_EMAILS = {
    "avikapawar08@gmail.com",
    "451.avikapawar@gmail.com",
    "admin@lumora.co",
    "samruddhidurge05@gmail.com",
}

TEST_PATTERNS = [
    "%@lumora.io",
    "%@lumora.test",
    "%@lumora.dev",
    "cust_test_unique_%",
]

def get_referencing_fks(cur, target_table):
    cur.execute("""
        SELECT
            kcu.table_name,
            kcu.column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = %s
          AND ccu.column_name = 'id';
    """, (target_table,))
    return cur.fetchall()

def main():
    if len(sys.argv) < 2:
        print("ERROR: DATABASE_URL required")
        sys.exit(1)

    db_url = sys.argv[1]
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    if "sslmode" not in db_url:
        sep = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{sep}sslmode=require"

    print("=" * 70)
    print("EXECUTING POSTGRESQL PRODUCTION CLEANUP (DYNAMIC CASCADING)")
    print("=" * 70)

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # 1. Identify fake users
    fake_user_ids = set()
    for pattern in TEST_PATTERNS:
        cur.execute("SELECT id, email FROM users WHERE email ILIKE %s", (pattern,))
        for r in cur.fetchall():
            if r["email"].lower() not in LEGIT_EMAILS:
                fake_user_ids.add(r["id"])

    fake_user_ids_list = sorted(list(fake_user_ids))
    print(f"Targeting {len(fake_user_ids_list)} fake user records: {fake_user_ids_list}")

    if not fake_user_ids_list:
        print("No fake users found in PostgreSQL.")
        conn.close()
        return

    # 2. Identify fake orders
    cur.execute("SELECT id FROM orders WHERE user_id = ANY(%s)", (fake_user_ids_list,))
    fake_order_ids_list = [r["id"] for r in cur.fetchall()]
    print(f"Targeting {len(fake_order_ids_list)} fake order records: {fake_order_ids_list}")

    # 3. Clear all references to fake orders
    if fake_order_ids_list:
        order_fks = get_referencing_fks(cur, 'orders')
        print("\nClearing foreign key references to orders.id:")
        for fk in order_fks:
            tbl = fk['table_name']
            col = fk['column_name']
            cur.execute(f"DELETE FROM {tbl} WHERE {col} = ANY(%s)", (fake_order_ids_list,))
            print(f"  - Deleted {cur.rowcount} rows from {tbl}.{col}")

        cur.execute("DELETE FROM orders WHERE id = ANY(%s)", (fake_order_ids_list,))
        print(f"Deleted {cur.rowcount} fake orders.")

    # 4. Clear all references to fake users
    user_fks = get_referencing_fks(cur, 'users')
    print("\nClearing foreign key references to users.id:")
    for fk in user_fks:
        tbl = fk['table_name']
        col = fk['column_name']
        cur.execute(f"DELETE FROM {tbl} WHERE {col} = ANY(%s)", (fake_user_ids_list,))
        print(f"  - Deleted {cur.rowcount} rows from {tbl}.{col}")

    # Special handling for admin_invitations, audit_logs (which may reference invited_by / admin_user_id)
    cur.execute("DELETE FROM audit_logs WHERE admin_user_id = ANY(%s)", (fake_user_ids_list,))
    print(f"Deleted {cur.rowcount} audit_logs with admin_user_id in fake_user_ids.")

    cur.execute("DELETE FROM admin_invitations WHERE email ILIKE '%@lumora.io%' OR email ILIKE '%@lumora.test%' OR email ILIKE '%@lumora.dev%'")
    print(f"Deleted {cur.rowcount} test admin_invitations.")

    # 5. Delete fake users
    cur.execute(
        "DELETE FROM users WHERE id = ANY(%s) AND LOWER(email) NOT IN %s",
        (fake_user_ids_list, tuple(LEGIT_EMAILS))
    )
    deleted_users = cur.rowcount
    print(f"\nSuccessfully deleted {deleted_users} fake user records from PostgreSQL.")

    # Commit transaction
    conn.commit()
    print("\n[SUCCESS] Transaction committed successfully to production PostgreSQL.")

    # 6. Final Audits & Verifications
    cur.execute("""
        SELECT ar.id as role_id, ar.user_id, ar.role_level, u.name, u.email
        FROM admin_roles ar
        JOIN users u ON u.id = ar.user_id
        WHERE ar.is_active = true
    """)
    active_admins = cur.fetchall()
    print(f"\nVERIFICATION — Active Team Members in PostgreSQL: {len(active_admins)}")
    for a in active_admins:
        print(f"  -> id={a['user_id']} | {a['name']} | {a['email']} | role={a['role_level']}")

    cur.execute("SELECT id, name, email, role FROM users WHERE role = 'admin'")
    all_admins = cur.fetchall()
    print(f"\nVERIFICATION — Users with role='admin' in PostgreSQL: {len(all_admins)}")
    for u in all_admins:
        print(f"  -> id={u['id']} | {u['name']} | {u['email']}")

    cur.execute("SELECT COUNT(*) as cnt FROM admin_invitations")
    inv_count = cur.fetchone()["cnt"]
    print(f"\nVERIFICATION — Total Admin Invitations in PostgreSQL: {inv_count}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
