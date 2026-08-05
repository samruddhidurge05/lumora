import sys
import os
sys.path.insert(0, '.')

from app.db.session import SessionLocal
from app.models.user import User
from app.models.admin_role import AdminRole
from app.core.security import get_password_hash
from datetime import datetime, timezone

db = SessionLocal()
now = datetime.utcnow()

# Seed default system admin (admin@lumora.co)
admin_email = "admin@lumora.co"
user = db.query(User).filter(User.email == admin_email).first()

if not user:
    user = User(
        name="Lumora Admin",
        email=admin_email,
        password_hash=get_password_hash("LumoraAdmin2024!"),
        role="admin",
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"Created system admin user: {user.email} (id={user.id})")
else:
    print(f"System admin user exists: {user.email} (id={user.id})")

# Ensure AdminRole exists for system admin
role = db.query(AdminRole).filter(AdminRole.user_id == user.id).first()
if not role:
    role = AdminRole(
        user_id=user.id,
        role_level="super_admin",
        is_active=True,
        activated_at=now,
    )
    db.add(role)
    db.commit()
    print(f"Created AdminRole for system admin: level=super_admin")
else:
    if not role.is_active or role.role_level != "super_admin":
        role.role_level = "super_admin"
        role.is_active = True
        db.commit()
        print(f"Updated AdminRole for system admin: level=super_admin")
    else:
        print("System admin AdminRole is already active and correct.")

db.close()
