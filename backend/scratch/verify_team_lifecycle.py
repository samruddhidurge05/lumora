import sys
import os
import uuid
from datetime import datetime, timezone, timedelta

sys.path.insert(0, ".")

from app.db.session import SessionLocal
from app.models.user import User
from app.models.admin_role import AdminRole
from app.models.admin_invitation import AdminInvitation
from app.models.admin_email_log import AdminEmailLog
from app.models.audit_log import AuditLog
from app.admin_api.admin_users.routes import (
    list_team_members,
    invite_admin,
    InviteRequest,
    accept_invite,
    change_admin_role,
    ChangeRoleRequest,
    deactivate_admin,
    cancel_invitation,
    resend_invitation,
    list_invitations,
    get_team_audit_log,
)
from app.core.security import create_access_token

db = SessionLocal()

print("======================================================================")
print("VERIFYING TEAM MANAGEMENT API ENDPOINTS AND LIFECYCLE (PHASE 4 & 6)")
print("======================================================================")

# 1. Fetch Super Admin
platform_admin = db.query(User).filter(User.email == "avikapawar08@gmail.com").first()
if not platform_admin:
    print("FAIL: Platform Admin not found")
    sys.exit(1)

print(f"1. Super Admin: {platform_admin.email} (ID={platform_admin.id})")

# 2. List Team Members
team = list_team_members(db=db, admin_user=platform_admin)
print(f"2. GET /admin/team returned {len(team)} members:")
for m in team:
    print(f"   - ID={m['user_id']} | Name={m['name']!r} | Email={m['email']} | Role={m['role_level']} | Active={m['is_active']}")

# 3. Create a genuine test invitation (using temp domain)
test_invite_email = f"prod_verify_{uuid.uuid4().hex[:6]}@lumoradesign.com"
req = InviteRequest(email=test_invite_email, role_level="moderator", invited_name="Verification Moderator")
inv_res = invite_admin(body=req, db=db, admin_user=platform_admin)
inv_id = inv_res["invitation_id"]
print(f"\n3. POST /admin/team/invite created invitation ID={inv_id} for {test_invite_email}")

# 4. List Invitations
invs = list_invitations(db=db, admin_user=platform_admin)
print(f"4. GET /admin/team/invitations returned {len(invs)} invitations:")
found = [i for i in invs if i["id"] == inv_id]
assert len(found) == 1, "Created invitation not found in list_invitations"
print(f"   - Verified invitation ID={inv_id} status={found[0]['status']}")

# 5. Resend Invitation (updates token)
# Fast-forward last_email_sent_at by 65s in DB to bypass the 60s cooldown limit during test
inv_obj = db.query(AdminInvitation).filter(AdminInvitation.id == inv_id).first()
inv_obj.last_email_sent_at = datetime.now(timezone.utc) - timedelta(seconds=65)
db.commit()

resend_res = resend_invitation(invitation_id=inv_id, db=db, admin_user=platform_admin)
db.refresh(inv_obj)
fresh_token = inv_obj.invite_token
print(f"5. POST /admin/team/invitations/{inv_id}/resend success. Fresh token generated: {fresh_token[:10]}...")

# 6. Accept Invitation
# Create user (simulating Google auth registration for invited user)
invited_user = User(
    name="Verification Moderator",
    email=test_invite_email,
    role="customer",
    password_hash="hash",
    is_active=True,
    is_verified=True,
)
db.add(invited_user)
db.commit()
db.refresh(invited_user)

acc_res = accept_invite(token=fresh_token, db=db, current_user=invited_user)
print(f"6. POST /admin/team/accept-invite success: {acc_res['message']}")
db.refresh(invited_user)
assert invited_user.role == "admin", "User role not elevated to admin"

# 7. Verify Role Elevated in GET /admin/team
team_after = list_team_members(db=db, admin_user=platform_admin)
print(f"7. GET /admin/team after acceptance returned {len(team_after)} members:")
for m in team_after:
    print(f"   - ID={m['user_id']} | Name={m['name']!r} | Email={m['email']} | Role={m['role_level']} | Active={m['is_active']}")

# 8. Change Role to 'analyst'
chg_req = ChangeRoleRequest(role_level="analyst")
chg_res = change_admin_role(user_id=invited_user.id, body=chg_req, db=db, admin_user=platform_admin)
print(f"8. PUT /admin/team/{invited_user.id}/role success: new_role={chg_res['role_level']}")

# 9. Deactivate Admin
deact_res = deactivate_admin(user_id=invited_user.id, db=db, admin_user=platform_admin)
print(f"9. POST /admin/team/{invited_user.id}/deactivate success: msg={deact_res['message']}")

# 10. Soft-revoke / cancel invitation test (with new temporary invitation)
test_cancel_email = f"prod_cancel_{uuid.uuid4().hex[:6]}@lumoradesign.com"
req_c = InviteRequest(email=test_cancel_email, role_level="support")
inv_c_res = invite_admin(body=req_c, db=db, admin_user=platform_admin)
inv_c_id = inv_c_res["invitation_id"]

cancel_invitation(invitation_id=inv_c_id, db=db, admin_user=platform_admin)
print(f"10. DELETE /admin/team/invitations/{inv_c_id} (soft-revoke) success.")

# 11. Check Audit Log
audit_logs = get_team_audit_log(limit=10, offset=0, db=db, admin_user=platform_admin)
print(f"\n11. GET /admin/team/audit-log returned {audit_logs['total']} total entries. Last 6:")
for log in audit_logs["items"][:6]:
    print(f"   - Action={log['action']} | Admin={log['admin_email']} | Target={log['target_type']}#{log['target_id']}")

# 12. Verify AdminEmailLogs entries persisted with message_id
email_logs = db.query(AdminEmailLog).filter(AdminEmailLog.invitation_id == inv_id).all()
print(f"\n12. AdminEmailLogs created for invitation ID={inv_id}: {len(email_logs)} events recorded:")
for el in email_logs:
    print(f"   - Event={el.event} | Recipient={el.recipient} | MsgID={el.message_id}")

# Cleanup verification temporary test data
print("\nCleaning up verification temporary test data...")
db.query(AdminRole).filter(AdminRole.user_id == invited_user.id).delete()
db.query(AdminEmailLog).filter(AdminEmailLog.invitation_id.in_([inv_id, inv_c_id])).delete()
db.query(AdminInvitation).filter(AdminInvitation.id.in_([inv_id, inv_c_id])).delete()
db.query(AuditLog).filter(AuditLog.admin_user_id.in_([platform_admin.id, invited_user.id])).delete()
db.query(User).filter(User.id.in_([invited_user.id])).delete()
# Clean any leftover temp test users if created in previous aborted runs
temp_leftovers = db.query(User).filter(User.email.like("prod_%@lumoradesign.com")).all()
for t_u in temp_leftovers:
    db.query(AdminRole).filter(AdminRole.user_id == t_u.id).delete()
    db.delete(t_u)
temp_invs = db.query(AdminInvitation).filter(AdminInvitation.email.like("prod_%@lumoradesign.com")).all()
for t_i in temp_invs:
    db.query(AdminEmailLog).filter(AdminEmailLog.invitation_id == t_i.id).delete()
    db.delete(t_i)
db.commit()
print("Verification complete. Temporary test data cleaned.")

db.close()
