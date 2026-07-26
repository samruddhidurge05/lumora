import os
import sys
import uuid
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import text

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.database import engine
from app.db.session import SessionLocal
from app.models import Base, User, AdminRole, AdminInvitation, AdminEmailLog
from app.admin_api.admin_users.routes import (
    accept_invite,
    invite_admin,
    resend_invitation,
    InviteRequest,
)
from app.core.security import create_access_token


def setup_test_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.execute(text("SELECT provider FROM admin_invitations LIMIT 1"))
    except Exception:
        db.rollback()
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
    finally:
        db.close()

setup_test_db()


def get_super_admin(db):
    admin = db.query(User).filter(User.email == "sec_super_admin@lumora.io").first()
    if not admin:
        admin = User(name="Sec Admin", email="sec_super_admin@lumora.io", role="admin", password_hash="hash123")
        db.add(admin)
        db.commit()
        db.refresh(admin)
        role = AdminRole(user_id=admin.id, role_level="super_admin", is_active=True)
        db.add(role)
        db.commit()
    return admin


# 1. Test Security Boundary: Non-Super Admin Attempting Admin Invitations
def test_security_non_super_admin_invite_blocked():
    db = SessionLocal()
    try:
        editor_user = User(name="Editor User", email=f"editor_{uuid.uuid4().hex[:6]}@lumora.io", role="admin", password_hash="hash123")
        db.add(editor_user)
        db.commit()
        db.refresh(editor_user)

        role = AdminRole(user_id=editor_user.id, role_level="editor", is_active=True)
        db.add(role)
        db.commit()

        body = InviteRequest(email=f"target_{uuid.uuid4().hex[:6]}@lumora.io", role_level="analyst")

        with pytest.raises(Exception) as exc_info:
            invite_admin(body=body, db=db, admin_user=editor_user)
        assert "403" in str(exc_info.value) or "Super admin" in str(exc_info.value)
    finally:
        db.close()


# 2. Test Security Boundary: Cross-Account Invitation Acceptance Prevention
def test_security_cross_account_acceptance_blocked():
    db = SessionLocal()
    try:
        victim_email = f"victim_{uuid.uuid4().hex[:6]}@lumora.io"
        attacker_email = f"attacker_{uuid.uuid4().hex[:6]}@lumora.io"

        attacker = User(name="Attacker", email=attacker_email, role="customer", password_hash="hash")
        db.add(attacker)

        now = datetime.now(timezone.utc)
        inv = AdminInvitation(
            email=victim_email,
            role_level="editor",
            invite_token=f"sec_tok_{uuid.uuid4().hex[:8]}",
            expires_at=now + timedelta(hours=48),
        )
        db.add(inv)
        db.commit()

        with pytest.raises(Exception) as exc_info:
            accept_invite(token=inv.invite_token, db=db, current_user=attacker)
        assert "403" in str(exc_info.value) or "sent to" in str(exc_info.value).lower()
    finally:
        db.close()


# 3. Test Security Boundary: Revoked Token Acceptance Prevention
def test_security_revoked_token_acceptance_blocked():
    db = SessionLocal()
    try:
        email = f"revoked_sec_{uuid.uuid4().hex[:6]}@lumora.io"
        user = User(name="User", email=email, role="customer", password_hash="hash")
        db.add(user)

        now = datetime.now(timezone.utc)
        inv = AdminInvitation(
            email=email,
            role_level="analyst",
            invite_token=f"rev_tok_{uuid.uuid4().hex[:8]}",
            expires_at=now + timedelta(hours=48),
            revoked_at=now - timedelta(minutes=5),
        )
        db.add(inv)
        db.commit()

        with pytest.raises(Exception) as exc_info:
            accept_invite(token=inv.invite_token, db=db, current_user=user)
        assert "400" in str(exc_info.value) or "revoked" in str(exc_info.value).lower()
    finally:
        db.close()


# 4. Test Security Boundary: Expired Token Acceptance Prevention
def test_security_expired_token_acceptance_blocked():
    db = SessionLocal()
    try:
        email = f"expired_sec_{uuid.uuid4().hex[:6]}@lumora.io"
        user = User(name="User", email=email, role="customer", password_hash="hash")
        db.add(user)

        now = datetime.now(timezone.utc)
        inv = AdminInvitation(
            email=email,
            role_level="analyst",
            invite_token=f"exp_tok_{uuid.uuid4().hex[:8]}",
            expires_at=now - timedelta(hours=1),
        )
        db.add(inv)
        db.commit()

        with pytest.raises(Exception) as exc_info:
            accept_invite(token=inv.invite_token, db=db, current_user=user)
        assert "400" in str(exc_info.value) or "expired" in str(exc_info.value).lower()
    finally:
        db.close()
