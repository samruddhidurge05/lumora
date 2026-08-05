"""
Phase 2 Investigation — Exact datasource audit for GET /admin/team
Answers: which DB, which tables, which records are producing fake admins.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lumora.db")

print(f"\n{'='*65}")
print(f"PRODUCTION DB PATH: {DB_PATH}")
print(f"{'='*65}\n")

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row

cur = conn.cursor()

# 1. ALL users with role='admin' — this is the SECOND query in list_team_members
print("=== QUERY 1: Users WHERE role='admin' (feeds fallback loop in GET /team) ===")
cur.execute("SELECT id, name, email, role, created_at FROM users WHERE role='admin' ORDER BY id")
rows = cur.fetchall()
if rows:
    for r in rows:
        print(dict(r))
else:
    print("  (none)")
print(f"  Total: {len(rows)}\n")

# 2. ALL admin_roles active
print("=== QUERY 2: admin_roles WHERE is_active=1 ===")
cur.execute("SELECT id, user_id, role_level, is_active, created_at FROM admin_roles WHERE is_active=1 ORDER BY id")
rows = cur.fetchall()
if rows:
    for r in rows:
        print(dict(r))
else:
    print("  (none)")
print(f"  Total: {len(rows)}\n")

# 3. What does GET /team actually return? Simulate the exact query
print("=== SIMULATION: Exact GET /admin/team output ===")
cur.execute("""
    SELECT 
        ar.id as role_id, ar.user_id, ar.role_level, ar.is_active, ar.activated_at,
        u.name, u.email, u.role as user_role
    FROM admin_roles ar
    JOIN users u ON u.id = ar.user_id
    WHERE ar.is_active = 1
""")
joined = cur.fetchall()
seen = set()
team_result = []
for r in joined:
    d = dict(r)
    seen.add(d["user_id"])
    team_result.append(d)

# Fallback: admin users without AdminRole
cur.execute("SELECT id, name, email, role FROM users WHERE role='admin'")
admin_users = cur.fetchall()
for u in admin_users:
    d = dict(u)
    if d["id"] not in seen:
        d["role_level"] = "super_admin (fallback)"
        d["is_active"] = True
        team_result.append(d)

print(f"  Total team members returned by GET /team: {len(team_result)}")
for m in team_result:
    print(f"    -> {m.get('name', '?')} | {m.get('email', '?')} | {m.get('role_level', '?')}")
print()

# 4. Check for @lumora.io in all tables
print("=== QUERY 3: Any @lumora.io addresses still in users table? ===")
cur.execute("SELECT id, name, email, role, created_at FROM users WHERE email LIKE '%@lumora.io%' ORDER BY id")
rows = cur.fetchall()
if rows:
    print(f"  WARNING: {len(rows)} @lumora.io users STILL PRESENT:")
    for r in rows:
        print(f"    {dict(r)}")
else:
    print("  CLEAN — no @lumora.io users in users table.")
print()

# 5. Check admin_invitations
print("=== QUERY 4: admin_invitations total and @lumora.io ===")
cur.execute("SELECT COUNT(*) FROM admin_invitations")
total = cur.fetchone()[0]
cur.execute("SELECT id, email, role_level, accepted_at, created_at FROM admin_invitations WHERE email LIKE '%@lumora.io%' ORDER BY id LIMIT 20")
rows = cur.fetchall()
print(f"  Total invitations: {total}")
if rows:
    print(f"  @lumora.io invitations: {len(rows)}")
    for r in rows:
        print(f"    {dict(r)}")
else:
    print("  No @lumora.io invitations.")
print()

# 6. Check test databases
print("=== TEST DATABASE FILES ===")
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for fname in os.listdir(backend_dir):
    if fname.endswith(".db") or fname.endswith(".db.bak"):
        fpath = os.path.join(backend_dir, fname)
        size = os.path.getsize(fpath)
        print(f"  {fname} — {size:,} bytes")
        # Check if it has admin users
        try:
            c2 = sqlite3.connect(fpath)
            c2r = c2.cursor()
            c2r.execute("SELECT COUNT(*) FROM users WHERE role='admin'")
            admin_count = c2r.fetchone()[0]
            c2r.execute("SELECT COUNT(*) FROM users WHERE email LIKE '%@lumora.io%'")
            lumora_count = c2r.fetchone()[0]
            print(f"    admin users: {admin_count}, @lumora.io users: {lumora_count}")
            c2.close()
        except Exception as e:
            print(f"    (could not query: {e})")
print()

# 7. Firestore check hint
print("=== FIRESTORE CHECK (code analysis) ===")
print("  The frontend also subscribes to Firestore: collection('admin', 'team', 'invitations')")
print("  If Firestore has stale @lumora.io invitation docs, they trigger REST re-fetch.")
print("  However GET /team is pure SQLite — Firestore cannot inject fake admins into team members list.")
print("  Fake admins can only appear from: users table OR admin_roles table.")

conn.close()
print("\nAudit complete.")
