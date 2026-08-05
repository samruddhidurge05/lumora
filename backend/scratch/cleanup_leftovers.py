import sys
import os
sys.path.insert(0, ".")

from app.db.session import SessionLocal
from app.models.user import User
from app.models.admin_role import AdminRole
from app.models.admin_invitation import AdminInvitation
from app.models.admin_email_log import AdminEmailLog
from app.models.audit_log import AuditLog

db = SessionLocal()

print("Cleaning up any leftover temporary verification users...")
temp_users = db.query(User).filter(User.email.like("prod_%@lumoradesign.com")).all()
for u in temp_users:
    db.query(AdminRole).filter(AdminRole.user_id == u.id).delete()
    db.delete(u)

temp_invs = db.query(AdminInvitation).filter(AdminInvitation.email.like("prod_%@lumoradesign.com")).all()
for i in temp_invs:
    db.query(AdminEmailLog).filter(AdminEmailLog.invitation_id == i.id).delete()
    db.delete(i)

db.commit()

# Print Final State
admins = db.query(User).filter(User.role == "admin").all()
print("\n======================================================================")
print(f"FINAL PRODUCTION TEAM STATE ({len(admins)} Administrators)")
print("======================================================================")
for a in admins:
    role = db.query(AdminRole).filter(AdminRole.user_id == a.id).first()
    r_level = role.role_level if role else "None"
    r_active = role.is_active if role else False
    print(f"  - User ID={a.id} | Name={a.name!r} | Email={a.email} | Role={r_level} | Active={r_active}")

invs = db.query(AdminInvitation).all()
print(f"\nFinal Pending/Active Invitations: {len(invs)}")

email_logs = db.query(AdminEmailLog).all()
print(f"Final AdminEmailLogs: {len(email_logs)}")

db.close()
