import os
import sys
import pytest
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.database import engine
from app.db.session import SessionLocal
from app.models import Base, User, AdminRole, AdminInvitation
from app.admin_api.admin_users.routes import (
    invite_admin, deactivate_admin, change_admin_role, InviteRequest, ChangeRoleRequest, _is_super_admin
)


def get_or_create_super_admin(db):
    admin = db.query(User).filter(User.email == "super_test@lumora.io").first()
    if not admin:
        admin = User(name="Super Test", email="super_test@lumora.io", role="admin", password_hash="hash123")
        db.add(admin)
        db.commit()
        db.refresh(admin)
        role = AdminRole(user_id=admin.id, role_level="super_admin", is_active=True)
        db.add(role)
        db.commit()
    else:
        role = db.query(AdminRole).filter(AdminRole.user_id == admin.id).first()
        if not role:
            role = AdminRole(user_id=admin.id, role_level="super_admin", is_active=True)
            db.add(role)
            db.commit()
        else:
            role.role_level = "super_admin"
            role.is_active = True
            db.commit()
    return admin


def test_is_super_admin_role_isolation():
    """Verify that _is_super_admin returns True ONLY for super_admin role_level and False for moderators/support."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        super_user = get_or_create_super_admin(db)
        assert _is_super_admin(super_user, db) is True

        # Create moderator user
        mod_user = db.query(User).filter(User.email == "moderator_test@lumora.io").first()
        if not mod_user:
            mod_user = User(name="Mod Test", email="moderator_test@lumora.io", role="admin", password_hash="hash123")
            db.add(mod_user)
            db.commit()
            db.refresh(mod_user)
            role = AdminRole(user_id=mod_user.id, role_level="moderator", is_active=True)
            db.add(role)
            db.commit()

        assert _is_super_admin(mod_user, db) is False

        # Verify moderator calling invite_admin raises 403 Forbidden
        req = InviteRequest(email="new_test@lumora.io", role_level="admin")
        with pytest.raises(HTTPException) as exc_info:
            invite_admin(body=req, db=db, admin_user=mod_user)
        assert exc_info.value.status_code == 403
    finally:
        db.close()


def test_invite_active_team_member_blocked():
    """Verify that inviting an email of an active admin member returns HTTP 400."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        admin = get_or_create_super_admin(db)

        # Create active member user
        member = db.query(User).filter(User.email == "existing_admin@lumora.io").first()
        if not member:
            member = User(name="Existing Admin", email="existing_admin@lumora.io", role="admin", password_hash="hash123")
            db.add(member)
            db.commit()
            db.refresh(member)
            m_role = AdminRole(user_id=member.id, role_level="admin", is_active=True)
            db.add(m_role)
            db.commit()

        req = InviteRequest(email="EXISTING_ADMIN@lumora.io", role_level="admin")
        with pytest.raises(HTTPException) as exc_info:
            invite_admin(body=req, db=db, admin_user=admin)
        assert exc_info.value.status_code == 400
        assert "already an active admin" in exc_info.value.detail.lower()
    finally:
        db.close()


def test_invite_existing_pending_invitation_renewed():
    """Verify that inviting an email with pending invitation renews existing row without duplicates."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        admin = get_or_create_super_admin(db)
        test_email = "pending_invite@lumora.io"

        # First invite
        req1 = InviteRequest(email=test_email, role_level="moderator")
        res1 = invite_admin(body=req1, db=db, admin_user=admin)
        inv_id_1 = res1["invitation_id"]

        # Second invite for same email
        req2 = InviteRequest(email=test_email.upper(), role_level="support")
        res2 = invite_admin(body=req2, db=db, admin_user=admin)
        inv_id_2 = res2["invitation_id"]

        assert inv_id_1 == inv_id_2
        assert res2["role_level"] == "support"

        inv_count = db.query(AdminInvitation).filter(AdminInvitation.email == test_email).count()
        assert inv_count == 1
    finally:
        db.close()


def test_last_super_admin_deactivation_blocked():
    """Verify that deactivating the sole active super_admin is blocked with HTTP 400."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Ensure only 1 active super_admin
        super_admins = db.query(AdminRole).filter(AdminRole.role_level == "super_admin", AdminRole.is_active == True).all()
        if len(super_admins) > 1:
            for sa in super_admins[1:]:
                sa.is_active = False
            db.commit()

        last_sa = db.query(AdminRole).filter(AdminRole.role_level == "super_admin", AdminRole.is_active == True).first()
        caller = db.query(User).filter(User.id != last_sa.user_id, User.role == "admin").first()
        if not caller:
            caller = User(name="Caller Admin", email="caller_admin@lumora.io", role="admin", password_hash="hash123")
            db.add(caller)
            db.commit()
            c_role = AdminRole(user_id=caller.id, role_level="super_admin", is_active=True)
            db.add(c_role)
            db.commit()

        with pytest.raises(HTTPException) as exc_info:
            deactivate_admin(user_id=last_sa.user_id, db=db, admin_user=caller)
        assert exc_info.value.status_code == 400
        assert "last active super_admin" in exc_info.value.detail.lower()
    finally:
        db.close()
