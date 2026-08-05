"""
production_recovery_audit.py
==============================
Full production recovery audit for the Lumora Admin authentication system.
Checks all admin-related tables, validates the auto-provisioning config,
and verifies the AdminRole record for the Platform Admin is properly set.

Run from backend/ directory:
    python scratch/production_recovery_audit.py
"""
import sys
import os
sys.path.insert(0, '.')

from app.db.session import SessionLocal
from app.models.user import User
from app.models.admin_role import AdminRole
from app.models.admin_invitation import AdminInvitation
from app.models.audit_log import AuditLog
from datetime import datetime, timezone

db = SessionLocal()
now = datetime.now(timezone.utc)

SEPARATOR = '='*72

# ─── SECTION 1: Pre-authorized Admin Emails from auth.py ──────────────────
print(SEPARATOR)
print('SECTION 1: PRE-AUTHORIZED ADMIN EMAILS (from admin/routes/auth.py)')
print(SEPARATOR)
DEFAULT_ADMINS = "admin@lumora.co,avikapawar08@gmail.com,451.avikapawar@gmail.com,samruddhidurge05@gmail.com"
admin_emails_env = os.getenv("ADMIN_EMAILS", DEFAULT_ADMINS)
allowed = {e.strip().lower() for e in admin_emails_env.split(",") if e.strip()}
allowed.add("avikapawar08@gmail.com")
allowed.add("451.avikapawar@gmail.com")
print(f'Configured authorized admin emails ({len(allowed)}):')
for e in sorted(allowed):
    print(f'  {e}')

# ─── SECTION 2: Current DB state for each authorized email ────────────────
print()
print(SEPARATOR)
print('SECTION 2: DB RECORD STATE FOR EACH AUTHORIZED EMAIL')
print(SEPARATOR)
for email in sorted(allowed):
    user = db.query(User).filter(User.email == email).first()
    if user:
        roles = db.query(AdminRole).filter(AdminRole.user_id == user.id).all()
        firebase_status = 'BOUND' if user.firebase_uid else 'NOT BOUND'
        active_role = next((r for r in roles if r.is_active), None)
        print(f'  [{email}]')
        print(f'    User ID       : {user.id}')
        print(f'    Name          : {user.name!r}')
        print(f'    role field    : {user.role!r}')
        print(f'    firebase_uid  : {user.firebase_uid!r}  ({firebase_status})')
        print(f'    is_active     : {user.is_active}')
        print(f'    is_verified   : {user.is_verified}')
        print(f'    created_at    : {user.created_at}')
        print(f'    last_login_at : {getattr(user, "last_login_at", "N/A")}')
        if roles:
            for r in roles:
                print(f'    AdminRole     : level={r.role_level!r} active={r.is_active} activated={r.activated_at}')
        else:
            print(f'    AdminRole     : MISSING (will be auto-created on next login)')
    else:
        print(f'  [{email}]')
        print(f'    User record   : NOT IN DATABASE (will be auto-provisioned on first login)')
    print()

# ─── SECTION 3: Any admin Users NOT in the authorized list ────────────────
print(SEPARATOR)
print('SECTION 3: ADMIN USERS NOT IN AUTHORIZED EMAIL LIST (should be 0)')
print(SEPARATOR)
all_admin_users = db.query(User).filter(User.role == 'admin').all()
unexpected = [u for u in all_admin_users if u.email.lower() not in allowed]
if unexpected:
    print(f'WARNING: {len(unexpected)} unexpected admin user(s) found:')
    for u in unexpected:
        print(f'  ID={u.id} | {u.email!r} | firebase_uid={u.firebase_uid!r}')
else:
    print('OK: All admin-role users are in the authorized email list.')

# ─── SECTION 4: AdminRole Orphan Check ─────────────────────────────────────
print()
print(SEPARATOR)
print('SECTION 4: ORPHAN ADMINROLE CHECK')
print(SEPARATOR)
all_roles = db.query(AdminRole).all()
orphans = []
for r in all_roles:
    u = db.query(User).filter(User.id == r.user_id).first()
    if not u:
        orphans.append(r)
if orphans:
    print(f'WARNING: {len(orphans)} orphan AdminRole record(s) (no matching User):')
    for r in orphans:
        print(f'  AdminRole id={r.id} user_id={r.user_id} level={r.role_level}')
else:
    print(f'OK: No orphan AdminRole records. Total roles: {len(all_roles)}')

# ─── SECTION 5: AdminInvitation Check ─────────────────────────────────────
print()
print(SEPARATOR)
print('SECTION 5: ALL ADMIN INVITATIONS')
print(SEPARATOR)
invs = db.query(AdminInvitation).all()
if not invs:
    print('OK: No AdminInvitation records (clean slate).')
else:
    print(f'{len(invs)} invitation(s) found:')
    for inv in invs:
        exp = inv.expires_at
        if exp and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if inv.accepted_at:
            status = 'ACCEPTED'
        elif getattr(inv, 'revoked_at', None):
            status = 'REVOKED'
        elif exp and exp < now:
            status = 'EXPIRED'
        else:
            status = 'PENDING'
        print(f'  ID={inv.id} | {inv.email} | role={inv.role_level} | status={status}')

# ─── SECTION 6: AuditLog Check ─────────────────────────────────────────────
print()
print(SEPARATOR)
print('SECTION 6: AUDIT LOG STATE')
print(SEPARATOR)
total_logs = db.query(AuditLog).count()
print(f'Total AuditLog records: {total_logs}')
if total_logs > 0:
    recent = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(10).all()
    print('Most recent 10:')
    for log in recent:
        print(f'  {log.created_at} | {log.action} | user_id={log.admin_user_id}')

# ─── SECTION 7: AdminEmailLog Check ───────────────────────────────────────
print()
print(SEPARATOR)
print('SECTION 7: ADMIN EMAIL LOGS (invitation delivery history)')
print(SEPARATOR)
from sqlalchemy import text
email_log_count = db.execute(text("SELECT COUNT(*) FROM admin_email_logs")).scalar()
print(f'Total admin_email_logs records: {email_log_count}')
if email_log_count > 0:
    recent_logs = db.execute(text(
        "SELECT id, invitation_id, event, recipient, provider, created_at "
        "FROM admin_email_logs ORDER BY created_at DESC LIMIT 10"
    )).fetchall()
    print('Most recent 10:')
    for row in recent_logs:
        print(f'  id={row[0]} inv_id={row[1]} event={row[2]} recipient={row[3]} provider={row[4]} at={row[5]}')

# ─── SECTION 8: What needs to be restored ─────────────────────────────────
print()
print(SEPARATOR)
print('SECTION 8: RECOVERY ACTION PLAN')
print(SEPARATOR)
issues = []

# Check Platform Admin has no AdminRole
platform_admin = db.query(User).filter(User.email == 'avikapawar08@gmail.com').first()
if platform_admin:
    pa_role = db.query(AdminRole).filter(AdminRole.user_id == platform_admin.id, AdminRole.is_active == True).first()
    if not pa_role:
        issues.append(f'Platform Admin (id={platform_admin.id}) has no active AdminRole — needs super_admin role record')
    if not platform_admin.firebase_uid:
        issues.append(f'Platform Admin (id={platform_admin.id}) has firebase_uid=None — will be bound on next login')

# Check other pre-authorized emails
for email in sorted(allowed - {'avikapawar08@gmail.com'}):
    u = db.query(User).filter(User.email == email).first()
    if not u:
        issues.append(f'{email!r} — not in DB yet, will be auto-provisioned on first login (no action needed)')

if issues:
    print('Action items:')
    for i, issue in enumerate(issues, 1):
        print(f'  {i}. {issue}')
else:
    print('No recovery actions required.')

print()
print(SEPARATOR)
print('SECTION 9: SUMMARY')
print(SEPARATOR)
print(f'Admin-role users in DB         : {len(all_admin_users)}')
print(f'Active AdminRole records       : {sum(1 for r in all_roles if r.is_active)}')
print(f'AdminInvitation records        : {len(invs)}')
print(f'AuditLog records               : {total_logs}')
print(f'admin_email_logs records       : {email_log_count}')
print(f'Orphan AdminRole records       : {len(orphans)}')
print(f'Unexpected admin users         : {len(unexpected)}')

db.close()
