import os
import sys
import uuid
import time
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import text

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.database import engine
from app.db.session import SessionLocal
from app.models import Base, User, AdminRole, AdminInvitation, AdminEmailLog
from app.services.email_providers import (
    BaseEmailProvider,
    GmailProvider,
    MockProvider,
    SendGridProvider,
    ResendProvider,
    SESProvider,
    get_email_provider,
)
from app.services.email_service import record_email_event, send_invitation_email
from app.admin_api.admin_users.routes import (
    get_invitation_history,
    get_email_logs,
    resend_invitation,
)


def setup_test_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.execute(text("SELECT provider FROM admin_invitations LIMIT 1"))
        db.execute(text("SELECT id FROM admin_email_logs LIMIT 1"))
    except Exception:
        db.rollback()
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
    finally:
        db.close()

setup_test_db()


def get_super_admin(db):
    admin = db.query(User).filter(User.email == "phase_b_admin@lumora.io").first()
    if not admin:
        admin = User(name="Phase B Admin", email="phase_b_admin@lumora.io", role="admin", password_hash="hash123")
        db.add(admin)
        db.commit()
        db.refresh(admin)
        role = AdminRole(user_id=admin.id, role_level="super_admin", is_active=True)
        db.add(role)
        db.commit()
    return admin


# 1. Test Provider Abstraction Factory & Implementations
def test_provider_abstraction_factory(monkeypatch):
    from app.core import config

    # Mock Provider when disabled
    monkeypatch.setattr(config.settings, "SMTP_ENABLED", False)
    p_mock = get_email_provider()
    assert isinstance(p_mock, MockProvider)
    assert p_mock.name == "mock"
    assert p_mock.check_health()["status"] == "healthy"

    # Explicit Gmail Provider
    monkeypatch.setattr(config.settings, "SMTP_ENABLED", True)
    p_gmail = get_email_provider("gmail_smtp")
    assert isinstance(p_gmail, GmailProvider)
    assert p_gmail.name == "gmail_smtp"

    # Stub Providers
    assert isinstance(get_email_provider("sendgrid"), SendGridProvider)
    assert isinstance(get_email_provider("resend"), ResendProvider)
    assert isinstance(get_email_provider("aws_ses"), SESProvider)


# 2. Test Append-Only AdminEmailLog Event Recording
def test_admin_email_log_audit_trail():
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        inv = AdminInvitation(
            email=f"audit_{uuid.uuid4().hex[:6]}@lumora.io",
            role_level="editor",
            invite_token=f"audit_tok_{uuid.uuid4().hex[:8]}",
            expires_at=now + timedelta(hours=48),
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)

        # Record events
        record_email_event(inv.id, "CREATED", inv.email, provider="mock")
        record_email_event(inv.id, "QUEUED", inv.email, provider="mock")
        record_email_event(inv.id, "SENDING", inv.email, provider="mock", attempt=1)
        record_email_event(inv.id, "SENT", inv.email, provider="mock", attempt=1, latency_ms=12, status_code=200)

        logs = db.query(AdminEmailLog).filter(AdminEmailLog.invitation_id == inv.id).order_by(AdminEmailLog.created_at.asc()).all()
        assert len(logs) == 4
        assert logs[0].event == "CREATED"
        assert logs[1].event == "QUEUED"
        assert logs[2].event == "SENDING"
        assert logs[3].event == "SENT"
        assert logs[3].latency_ms == 12
    finally:
        db.close()


# 3. Test AdminInvitation Persistence Metadata
def test_admin_invitation_resend_metadata_updates():
    db = SessionLocal()
    try:
        admin = get_super_admin(db)
        now_utc = datetime.utcnow()
        inv = AdminInvitation(
            email=f"resend_meta_{uuid.uuid4().hex[:6]}@lumora.io",
            role_level="analyst",
            invite_token=f"meta_tok_{uuid.uuid4().hex[:8]}",
            expires_at=now_utc + timedelta(hours=48),
            last_email_sent_at=now_utc - timedelta(seconds=120),
            resend_count=0,
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)

        # First resend
        resend_invitation(invitation_id=inv.id, db=db, admin_user=admin)
        db.refresh(inv)

        assert inv.resend_count >= 1
        assert inv.last_attempt_at is not None
        assert inv.first_sent_at is not None
        assert inv.provider == "gmail_smtp"
    finally:
        db.close()


# 4. Test GET /admin/team/invitations/{id}/history Endpoint
def test_get_invitation_history_endpoint():
    db = SessionLocal()
    try:
        admin = get_super_admin(db)
        now = datetime.now(timezone.utc)
        inv = AdminInvitation(
            email=f"endpoint_hist_{uuid.uuid4().hex[:6]}@lumora.io",
            role_level="moderator",
            invite_token=f"endpoint_tok_{uuid.uuid4().hex[:8]}",
            expires_at=now + timedelta(hours=48),
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)

        record_email_event(inv.id, "QUEUED", inv.email, provider="gmail_smtp")
        record_email_event(inv.id, "SENT", inv.email, provider="gmail_smtp", latency_ms=15)

        hist = get_invitation_history(invitation_id=inv.id, db=db, admin_user=admin)
        assert hist["invitation_id"] == inv.id
        assert hist["email"] == inv.email
        assert len(hist["history"]) >= 2
    finally:
        db.close()


# 5. Test GET /admin/team/email-logs Endpoint
def test_get_email_logs_endpoint():
    db = SessionLocal()
    try:
        admin = get_super_admin(db)
        logs_res = get_email_logs(limit=10, offset=0, db=db, admin_user=admin)
        assert "total" in logs_res
        assert "limit" in logs_res
        assert "logs" in logs_res
        assert isinstance(logs_res["logs"], list)
    finally:
        db.close()
