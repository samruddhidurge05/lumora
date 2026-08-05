"""
HISTORICAL FORENSICS & VERIFICATION SCRIPT — POSTGRESQL
======================================================
Performs a deep forensic inspection of all historical tables, audit logs,
activity logs, email logs, and user tables in production PostgreSQL.
"""
import sys
import json
import psycopg2
import psycopg2.extras

db_url = 'postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni?sslmode=require'

def main():
    conn = psycopg2.connect(db_url)
    conn.set_session(readonly=True, autocommit=True)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    print("=" * 70)
    print("PHASE 1 — FORENSIC INSPECTION OF ALL HISTORICAL TABLES")
    print("=" * 70)

    # 1. Inspect ALL users in PostgreSQL
    cur.execute("SELECT id, name, email, role, firebase_uid, created_at, last_login_at FROM users ORDER BY id")
    all_users = cur.fetchall()
    print(f"\n[TOTAL USERS IN POSTGRESQL]: {len(all_users)}")
    for u in all_users:
        print(f"  User #{u['id']}: name={u['name']} | email={u['email']} | role={u['role']} | created={u['created_at']}")

    # 2. Inspect ALL admin_roles
    cur.execute("""
        SELECT ar.id, ar.user_id, ar.role_level, ar.is_active, ar.activated_at, ar.created_at, u.email, u.name
        FROM admin_roles ar
        LEFT JOIN users u ON u.id = ar.user_id
        ORDER BY ar.id
    """)
    roles = cur.fetchall()
    print(f"\n[TOTAL ADMIN_ROLES IN POSTGRESQL]: {len(roles)}")
    for r in roles:
        print(f"  Role #{r['id']}: user_id={r['user_id']} ({r['email']}) | level={r['role_level']} | active={r['is_active']} | created={r['created_at']}")

    # 3. Inspect ALL admin_invitations
    cur.execute("SELECT * FROM admin_invitations ORDER BY id")
    invites = cur.fetchall()
    print(f"\n[TOTAL ADMIN_INVITATIONS IN POSTGRESQL]: {len(invites)}")
    for inv in invites:
        print(f"  Invite #{inv['id']}: email={inv['email']} | role={inv['role_level']} | accepted={inv['accepted_at']} | created={inv['created_at']}")

    # 4. Inspect ALL audit_logs
    cur.execute("SELECT id, admin_user_id, action, target_type, target_id, metadata, created_at FROM audit_logs ORDER BY id")
    logs = cur.fetchall()
    print(f"\n[TOTAL AUDIT_LOGS IN POSTGRESQL]: {len(logs)}")
    for l in logs:
        print(f"  AuditLog #{l['id']}: action={l['action']} | user_id={l['admin_user_id']} | target={l['target_type']}#{l['target_id']} | meta={l['metadata']} | created={l['created_at']}")

    # 5. Inspect ALL admin_email_logs if table exists
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_name = 'admin_email_logs'")
    if cur.fetchone():
        cur.execute("SELECT * FROM admin_email_logs ORDER BY id")
        email_logs = cur.fetchall()
        print(f"\n[TOTAL ADMIN_EMAIL_LOGS IN POSTGRESQL]: {len(email_logs)}")
        for el in email_logs:
            print(f"  EmailLog #{el['id']}: recipient={el['recipient']} | event={el['event']} | created={el['created_at']}")
    else:
        print("\n[ADMIN_EMAIL_LOGS]: Table does not exist in PostgreSQL")

    # 6. Search for any invitation/admin mention in notifications or user_activities
    cur.execute("SELECT * FROM notifications WHERE type ILIKE '%admin%' OR type ILIKE '%invite%' OR title ILIKE '%invite%' LIMIT 50")
    notifs = cur.fetchall()
    print(f"\n[ADMIN/INVITE NOTIFICATIONS IN POSTGRESQL]: {len(notifs)}")
    for n in notifs:
        print(f"  Notification #{n['id']}: user_id={n['user_id']} | title={n['title']} | created={n['created_at']}")

    cur.execute("SELECT * FROM user_activities WHERE activity_type ILIKE '%admin%' OR activity_type ILIKE '%invite%' LIMIT 50")
    activities = cur.fetchall()
    print(f"\n[ADMIN/INVITE ACTIVITIES IN POSTGRESQL]: {len(activities)}")
    for a in activities:
        print(f"  Activity #{a['id']}: user_id={a['user_id']} | type={a['activity_type']} | created={a['created_at']}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
