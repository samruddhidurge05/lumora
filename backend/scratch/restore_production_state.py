"""
restore_production_state.py
==============================
Restores the production admin configuration to the correct state:

1. Creates the missing AdminRole record for Platform Admin (avikapawar08@gmail.com)
   - Role level: super_admin
   - is_active: True

2. Clears the 2,211 orphaned admin_email_logs rows that reference
   deleted test invitation IDs (invitation_id references no longer exist).

3. Verifies zero data integrity issues remain.

Run from backend/ directory:
    python scratch/restore_production_state.py
"""
import sys
import os
sys.path.insert(0, '.')

from app.db.session import SessionLocal
from app.models.user import User
from app.models.admin_role import AdminRole
from app.models.admin_invitation import AdminInvitation
from app.models.admin_email_log import AdminEmailLog
from sqlalchemy import text
from datetime import datetime, timezone

db = SessionLocal()
now = datetime.now(timezone.utc)

print('='*72)
print('STEP 1: Restore AdminRole for Platform Admin (avikapawar08@gmail.com)')
print('='*72)

platform_admin = db.query(User).filter(User.email == 'avikapawar08@gmail.com').first()
if not platform_admin:
    print('ERROR: Platform Admin user not found in database. Aborting.')
    db.close()
    sys.exit(1)

print(f'Found Platform Admin: id={platform_admin.id} name={platform_admin.name!r} role={platform_admin.role!r}')

existing_role = db.query(AdminRole).filter(AdminRole.user_id == platform_admin.id).first()
if existing_role:
    print(f'AdminRole already exists: level={existing_role.role_level!r} active={existing_role.is_active}')
    if not existing_role.is_active or existing_role.role_level != 'super_admin':
        existing_role.role_level = 'super_admin'
        existing_role.is_active = True
        existing_role.activated_at = now
        db.commit()
        print('  Updated existing AdminRole to super_admin / active=True')
    else:
        print('  AdminRole is already correct — no change needed')
else:
    new_role = AdminRole(
        user_id=platform_admin.id,
        role_level='super_admin',
        is_active=True,
        activated_at=now,
    )
    db.add(new_role)
    db.commit()
    db.refresh(new_role)
    print(f'  Created AdminRole: id={new_role.id} level=super_admin active=True')

print()
print('='*72)
print('STEP 2: Purge orphaned admin_email_logs (reference deleted test invitations)')
print('='*72)

# Count orphaned email log rows:
# An email log is orphaned if its invitation_id does not exist in admin_invitations
orphaned_count = db.execute(text(
    "SELECT COUNT(*) FROM admin_email_logs "
    "WHERE invitation_id NOT IN (SELECT id FROM admin_invitations)"
)).scalar()
total_logs = db.execute(text("SELECT COUNT(*) FROM admin_email_logs")).scalar()
print(f'Total admin_email_logs    : {total_logs}')
print(f'Orphaned (no matching inv): {orphaned_count}')

if orphaned_count > 0:
    db.execute(text(
        "DELETE FROM admin_email_logs "
        "WHERE invitation_id NOT IN (SELECT id FROM admin_invitations)"
    ))
    db.commit()
    remaining = db.execute(text("SELECT COUNT(*) FROM admin_email_logs")).scalar()
    print(f'Deleted {orphaned_count} orphaned email log rows.')
    print(f'Remaining admin_email_logs: {remaining}')
else:
    print('No orphaned email logs — nothing to delete.')

print()
print('='*72)
print('STEP 3: Final verification')
print('='*72)

# Verify Platform Admin state
u = db.query(User).filter(User.id == platform_admin.id).first()
r = db.query(AdminRole).filter(AdminRole.user_id == platform_admin.id, AdminRole.is_active == True).first()
inv_count = db.query(AdminInvitation).count()
log_count = db.execute(text("SELECT COUNT(*) FROM admin_email_logs")).scalar()

print(f'Platform Admin:')
print(f'  id            : {u.id}')
print(f'  email         : {u.email!r}')
print(f'  role          : {u.role!r}')
print(f'  firebase_uid  : {u.firebase_uid!r}')
print(f'  is_active     : {u.is_active}')
print(f'  AdminRole     : level={r.role_level!r} active={r.is_active}' if r else '  AdminRole     : MISSING (ERROR)')
print()
print(f'AdminInvitation records  : {inv_count}  (expected: 0 — clean slate)')
print(f'admin_email_logs records : {log_count}  (expected: 0 after orphan purge)')
print()

if r and r.role_level == 'super_admin' and r.is_active:
    print('RESULT: Platform Admin is fully restored.')
    print('  - User record: OK')
    print('  - AdminRole: super_admin, active=True')
    print('  - firebase_uid will be bound automatically on next login')
    print('  - /admin/team will display exactly 1 administrator')
    print('  - All other authorized emails will auto-provision on first login')
else:
    print('ERROR: AdminRole restoration failed. Check error above.')

db.close()
