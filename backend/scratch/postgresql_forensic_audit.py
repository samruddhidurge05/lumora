"""
PHASE 1-8 — PostgreSQL Forensic Audit Script
=============================================
Connects to the Render production PostgreSQL database and performs
a complete forensic audit of all admin-related tables.

USAGE:
  python backend/scratch/postgresql_forensic_audit.py <DATABASE_URL>

Where DATABASE_URL is the full Render PostgreSQL connection string, e.g.:
  postgresql://lumora_db_k4ni_user:<PASSWORD>@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni

The password must be retrieved from the Render Dashboard:
  Dashboard -> lumora-backend -> Environment -> DATABASE_URL

WHAT THIS SCRIPT DOES (Read-Only — Zero modifications):
  1. Verifies connectivity to PostgreSQL
  2. Lists all tables in the schema
  3. Audits users (admin, @lumora.io, all roles)
  4. Audits admin_roles (active, inactive, by role_level)
  5. Audits admin_invitations (pending, accepted, expired, revoked)
  6. Audits audit_logs (team-related actions)
  7. Identifies legitimate vs fake administrators
  8. Simulates the exact GET /admin/team query result
  9. Identifies all test/fake records for Phase 8 removal
"""
import sys
import os

def main():
    if len(sys.argv) < 2:
        print("ERROR: DATABASE_URL required as argument")
        print()
        print("USAGE:")
        print("  python postgresql_forensic_audit.py <DATABASE_URL>")
        print()
        print("Get the URL from Render Dashboard:")
        print("  Dashboard -> lumora-backend -> Environment -> DATABASE_URL")
        sys.exit(1)

    db_url = sys.argv[1]

    # Normalize postgres:// -> postgresql://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    # Add sslmode if missing (required for Render PostgreSQL)
    if "sslmode" not in db_url:
        sep = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{sep}sslmode=require"

    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
        sys.exit(1)

    print(f"\n{'='*70}")
    print("POSTGRESQL FORENSIC AUDIT — TEAM MANAGEMENT")
    print(f"{'='*70}")
    print(f"Host: {db_url.split('@')[1].split('/')[0] if '@' in db_url else 'unknown'}")
    print(f"DB:   {db_url.split('/')[-1].split('?')[0]}")
    print()

    # ------------------------------------------------------------------
    # CONNECT
    # ------------------------------------------------------------------
    try:
        conn = psycopg2.connect(db_url)
        conn.set_session(readonly=True, autocommit=True)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        print("[OK] Connected to PostgreSQL\n")
    except Exception as e:
        print(f"[FAIL] Could not connect: {e}")
        sys.exit(1)

    LEGIT_EMAILS = {
        "avikapawar08@gmail.com",
        "451.avikapawar@gmail.com",
        "admin@lumora.co",
        "samruddhidurge05@gmail.com",
    }

    # ------------------------------------------------------------------
    # PHASE 1: LIST ALL TABLES
    # ------------------------------------------------------------------
    print(f"{'='*70}")
    print("PHASE 1 — ALL TABLES IN PRODUCTION SCHEMA")
    print(f"{'='*70}")
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
    """)
    tables = [r["table_name"] for r in cur.fetchall()]
    print(f"  Tables ({len(tables)}): {tables}\n")

    # ------------------------------------------------------------------
    # PHASE 2: USERS TABLE AUDIT
    # ------------------------------------------------------------------
    print(f"{'='*70}")
    print("PHASE 2 — USERS TABLE AUDIT")
    print(f"{'='*70}")

    cur.execute("SELECT COUNT(*) as total FROM users")
    total_users = cur.fetchone()["total"]
    print(f"  Total users: {total_users}")

    cur.execute("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'")
    total_admin_users = cur.fetchone()["cnt"]
    print(f"  Users with role='admin': {total_admin_users}")

    cur.execute("SELECT COUNT(*) as cnt FROM users WHERE email LIKE '%@lumora.io%'")
    lumora_io_users = cur.fetchone()["cnt"]
    print(f"  Users with @lumora.io email: {lumora_io_users}")

    print()
    print("  ALL ADMIN USERS (role='admin'):")
    cur.execute("""
        SELECT id, name, email, role, firebase_uid, created_at, last_login_at
        FROM users 
        WHERE role = 'admin' 
        ORDER BY created_at
    """)
    admin_users = cur.fetchall()
    for u in admin_users:
        is_legit = u["email"].lower() in LEGIT_EMAILS
        tag = "LEGITIMATE" if is_legit else "SUSPECT/TEST"
        print(f"    [{tag}] id={u['id']} | {u['name']} | {u['email']}")
        print(f"           firebase_uid={u['firebase_uid']}")
        print(f"           created={u['created_at']} | last_login={u['last_login_at']}")

    print()
    print("  ALL @lumora.io USERS (any role):")
    cur.execute("""
        SELECT id, name, email, role, created_at 
        FROM users 
        WHERE email ILIKE '%@lumora.io%' 
        ORDER BY id
    """)
    lumora_users = cur.fetchall()
    if lumora_users:
        for u in lumora_users:
            print(f"    id={u['id']} | {u['name']} | {u['email']} | role={u['role']}")
    else:
        print("    (none)")

    # ------------------------------------------------------------------
    # PHASE 3: ADMIN_ROLES TABLE AUDIT
    # ------------------------------------------------------------------
    print()
    print(f"{'='*70}")
    print("PHASE 3 — ADMIN_ROLES TABLE AUDIT")
    print(f"{'='*70}")

    cur.execute("SELECT COUNT(*) as cnt FROM admin_roles")
    total_roles = cur.fetchone()["cnt"]
    cur.execute("SELECT COUNT(*) as cnt FROM admin_roles WHERE is_active = true")
    active_roles = cur.fetchone()["cnt"]
    print(f"  Total admin_roles: {total_roles}")
    print(f"  Active admin_roles: {active_roles}")
    print(f"  Inactive admin_roles: {total_roles - active_roles}")

    print()
    print("  ALL ADMIN_ROLES:")
    cur.execute("""
        SELECT ar.id, ar.user_id, ar.role_level, ar.is_active, ar.activated_at, ar.created_at,
               u.name, u.email
        FROM admin_roles ar
        LEFT JOIN users u ON u.id = ar.user_id
        ORDER BY ar.created_at
    """)
    roles = cur.fetchall()
    for r in roles:
        is_legit = (r["email"] or "").lower() in LEGIT_EMAILS
        tag = "LEGITIMATE" if is_legit else "SUSPECT/TEST"
        print(f"    [{tag}] role_id={r['id']} | user_id={r['user_id']} | {r['name']} | {r['email']}")
        print(f"            role={r['role_level']} | active={r['is_active']} | created={r['created_at']}")

    # Role level breakdown
    print()
    cur.execute("""
        SELECT role_level, COUNT(*) as cnt, SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_cnt
        FROM admin_roles 
        GROUP BY role_level 
        ORDER BY cnt DESC
    """)
    role_breakdown = cur.fetchall()
    print("  ROLE BREAKDOWN:")
    for rb in role_breakdown:
        print(f"    {rb['role_level']}: total={rb['cnt']}, active={rb['active_cnt']}")

    # ------------------------------------------------------------------
    # PHASE 4: ADMIN_INVITATIONS TABLE AUDIT
    # ------------------------------------------------------------------
    print()
    print(f"{'='*70}")
    print("PHASE 4 — ADMIN_INVITATIONS TABLE AUDIT")
    print(f"{'='*70}")

    cur.execute("SELECT COUNT(*) as cnt FROM admin_invitations")
    total_inv = cur.fetchone()["cnt"]
    cur.execute("SELECT COUNT(*) as cnt FROM admin_invitations WHERE accepted_at IS NOT NULL")
    accepted_inv = cur.fetchone()["cnt"]
    cur.execute("SELECT COUNT(*) as cnt FROM admin_invitations WHERE accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()")
    pending_inv = cur.fetchone()["cnt"]
    cur.execute("SELECT COUNT(*) as cnt FROM admin_invitations WHERE revoked_at IS NOT NULL")
    revoked_inv = cur.fetchone()["cnt"]
    cur.execute("SELECT COUNT(*) as cnt FROM admin_invitations WHERE email ILIKE '%@lumora.io%'")
    lumora_inv = cur.fetchone()["cnt"]

    print(f"  Total invitations: {total_inv}")
    print(f"  Accepted: {accepted_inv}")
    print(f"  Pending: {pending_inv}")
    print(f"  Revoked: {revoked_inv}")
    print(f"  @lumora.io: {lumora_inv}")

    print()
    print("  ALL INVITATIONS:")
    cur.execute("""
        SELECT id, email, invited_name, role_level, 
               accepted_at, revoked_at, expires_at, created_at,
               CASE 
                   WHEN revoked_at IS NOT NULL THEN 'revoked'
                   WHEN accepted_at IS NOT NULL THEN 'accepted'
                   WHEN expires_at < NOW() THEN 'expired'
                   ELSE 'pending'
               END as status
        FROM admin_invitations
        ORDER BY created_at
    """)
    invitations = cur.fetchall()
    for inv in invitations:
        is_legit = inv["email"].lower() in LEGIT_EMAILS or not inv["email"].endswith("@lumora.io")
        tag = "LEGITIMATE" if is_legit else "TEST/FAKE"
        print(f"    [{tag}] id={inv['id']} | {inv['email']} | role={inv['role_level']} | status={inv['status']}")

    # ------------------------------------------------------------------
    # PHASE 5: AUDIT_LOGS TABLE
    # ------------------------------------------------------------------
    print()
    print(f"{'='*70}")
    print("PHASE 5 — AUDIT_LOGS (team-related, last 30)")
    print(f"{'='*70}")

    cur.execute("SELECT COUNT(*) as cnt FROM audit_logs")
    total_logs = cur.fetchone()["cnt"]
    cur.execute("""
        SELECT COUNT(*) as cnt FROM audit_logs 
        WHERE action IN ('admin_invited','admin_invite_accepted','admin_deactivated',
                         'admin_role_changed','admin_invitation_revoked','admin_invitation_resent')
    """)
    team_logs = cur.fetchone()["cnt"]
    print(f"  Total audit_logs: {total_logs}")
    print(f"  Team-related audit_logs: {team_logs}")

    cur.execute("""
        SELECT id, action, admin_user_id, target_type, target_id, created_at, metadata
        FROM audit_logs 
        WHERE action IN ('admin_invited','admin_invite_accepted','admin_deactivated',
                         'admin_role_changed','admin_invitation_revoked','admin_invitation_resent')
        ORDER BY created_at DESC
        LIMIT 30
    """)
    logs = cur.fetchall()
    if logs:
        for log in logs:
            print(f"    {log['created_at']} | {log['action']} | by user_id={log['admin_user_id']} | {log['metadata']}")
    else:
        print("    (no team audit logs)")

    # ------------------------------------------------------------------
    # PHASE 6: SIMULATE GET /admin/team
    # ------------------------------------------------------------------
    print()
    print(f"{'='*70}")
    print("PHASE 6 — SIMULATE GET /admin/team (exact query)")
    print(f"{'='*70}")
    print()
    print("  QUERY 1 — admin_roles WHERE is_active=true:")
    cur.execute("""
        SELECT ar.id as role_id, ar.user_id, ar.role_level, u.name, u.email
        FROM admin_roles ar
        JOIN users u ON u.id = ar.user_id
        WHERE ar.is_active = true
        ORDER BY ar.created_at
    """)
    active_role_members = cur.fetchall()
    seen_ids = set()
    for m in active_role_members:
        seen_ids.add(m["user_id"])
        is_legit = m["email"].lower() in LEGIT_EMAILS
        tag = "LEGIT" if is_legit else "FAKE"
        print(f"    [{tag}] {m['name']} | {m['email']} | role={m['role_level']}")

    print()
    print("  QUERY 2 — users WHERE role='admin' AND NOT in admin_roles (fallback):")
    cur.execute("SELECT id, name, email FROM users WHERE role='admin'")
    all_admin_users = cur.fetchall()
    for u in all_admin_users:
        if u["id"] not in seen_ids:
            is_legit = u["email"].lower() in LEGIT_EMAILS
            tag = "LEGIT" if is_legit else "FAKE"
            print(f"    [{tag}] {u['name']} | {u['email']} | role=super_admin (fallback)")

    print()
    total_shown = len(active_role_members) + len([u for u in all_admin_users if u["id"] not in seen_ids])
    print(f"  TOTAL MEMBERS SHOWN IN /admin/team: {total_shown}")

    # ------------------------------------------------------------------
    # PHASE 7: IDENTIFY TEST/FAKE RECORDS FOR CLEANUP
    # ------------------------------------------------------------------
    print()
    print(f"{'='*70}")
    print("PHASE 7 — FAKE/TEST RECORDS REQUIRING CLEANUP")
    print(f"{'='*70}")

    test_patterns = [
        "%@lumora.io%",
        "%load_super_admin%",
        "%phase_b_admin%",
        "%infra_admin%",
        "%benchmark%",
        "%_test_%",
        "%b5_admin%",
        "%sec_super_admin%",
    ]

    fake_user_ids = set()
    for pattern in test_patterns:
        cur.execute("SELECT id, name, email FROM users WHERE email ILIKE %s", (pattern,))
        rows = cur.fetchall()
        for r in rows:
            fake_user_ids.add(r["id"])

    print(f"  Fake/test user IDs found: {sorted(fake_user_ids)}")
    if fake_user_ids:
        id_list = tuple(fake_user_ids)
        if len(id_list) == 1:
            id_list = (id_list[0], id_list[0])
        cur.execute("SELECT id, name, email, role FROM users WHERE id = ANY(%s)", (list(fake_user_ids),))
        fake_users = cur.fetchall()
        for u in fake_users:
            print(f"    FAKE: id={u['id']} | {u['name']} | {u['email']} | role={u['role']}")

    cur.execute("SELECT COUNT(*) as cnt FROM admin_roles WHERE user_id = ANY(%s)", (list(fake_user_ids) if fake_user_ids else [0],))
    fake_roles_count = cur.fetchone()["cnt"]
    cur.execute("SELECT COUNT(*) as cnt FROM admin_invitations WHERE email ILIKE '%@lumora.io%'")
    fake_inv_count = cur.fetchone()["cnt"]

    print()
    print(f"  Fake admin_roles: {fake_roles_count}")
    print(f"  Fake invitations (@lumora.io): {fake_inv_count}")

    # ------------------------------------------------------------------
    # SUMMARY
    # ------------------------------------------------------------------
    print()
    print(f"{'='*70}")
    print("FORENSIC AUDIT SUMMARY")
    print(f"{'='*70}")
    legit_admin_users = [u for u in admin_users if u["email"].lower() in LEGIT_EMAILS]
    fake_admin_users_list = [u for u in admin_users if u["email"].lower() not in LEGIT_EMAILS]
    print(f"  Genuine admin accounts:  {len(legit_admin_users)}")
    print(f"  Fake/test admin accounts: {len(fake_admin_users_list)}")
    print(f"  Active admin_roles:      {active_roles}")
    print(f"  Total invitations:       {total_inv}")
    print(f"    -> Accepted:           {accepted_inv}")
    print(f"    -> Pending:            {pending_inv}")
    print(f"    -> Revoked:            {revoked_inv}")
    print(f"    -> @lumora.io (fake):  {lumora_inv}")
    print()

    if fake_admin_users_list or lumora_inv > 0:
        print("  ACTION REQUIRED: Fake records exist. Run the cleanup phase.")
        print()
        print("  CLEANUP SQL (review before executing):")
        if fake_user_ids:
            id_str = ", ".join(str(i) for i in sorted(fake_user_ids))
            print(f"    -- Step 1: Delete fake admin_roles")
            print(f"    DELETE FROM admin_roles WHERE user_id IN ({id_str});")
            print()
            print(f"    -- Step 2: Delete fake admin_invitations")
            print(f"    DELETE FROM admin_invitations WHERE email ILIKE '%@lumora.io%';")
            print()
            print(f"    -- Step 3: Delete fake audit_logs")
            print(f"    DELETE FROM audit_logs WHERE admin_user_id IN ({id_str});")
            print()
            print(f"    -- Step 4: Delete fake users")
            print(f"    DELETE FROM users WHERE id IN ({id_str});")
    else:
        print("  DATABASE IS CLEAN — No fake records found.")
        print("  Team Management is reading genuine production data only.")

    cur.close()
    conn.close()
    print()
    print("Audit complete.")


if __name__ == "__main__":
    main()
