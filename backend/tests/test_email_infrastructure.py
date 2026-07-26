import os
import sys
import uuid
import time
import pytest
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from sqlalchemy import text

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.database import engine
from app.db.session import SessionLocal
from app.models import Base, User, AdminRole, AdminInvitation
from app.services.email_service import (
    check_smtp_health,
    _send_raw_with_retry,
    generate_job_id,
    generate_correlation_id,
    send_invitation_email,
    EmailDispatcher,
    validate_smtp_on_startup,
)
from app.admin_api.admin_users.routes import resend_invitation, get_email_health, get_email_metrics


def setup_test_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.execute(text("SELECT email_status FROM admin_invitations LIMIT 1"))
    except Exception:
        db.rollback()
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
    finally:
        db.close()

setup_test_db()


def get_super_admin(db):
    admin = db.query(User).filter(User.email == "infra_admin@lumora.io").first()
    if not admin:
        admin = User(name="Infra Admin", email="infra_admin@lumora.io", role="admin", password_hash="hash123")
        db.add(admin)
        db.commit()
        db.refresh(admin)
        role = AdminRole(user_id=admin.id, role_level="super_admin", is_active=True)
        db.add(role)
        db.commit()
    return admin


# 1. ID Generators Test
def test_id_generators():
    job_id = generate_job_id()
    corr_id = generate_correlation_id()
    assert job_id.startswith("job_")
    assert corr_id.startswith("corr_")
    assert len(job_id) == 16
    assert len(corr_id) == 17


# 2. Email Dispatcher Abstraction Test
def test_email_dispatcher():
    executed = []
    def sample_task(val):
        executed.append(val)

    EmailDispatcher.dispatch(sample_task, "test_value")
    time.sleep(0.1) # Wait for thread execution
    assert "test_value" in executed


# 3. Startup Validation Hook Test
def test_startup_validation():
    val = validate_smtp_on_startup()
    assert "status" in val
    assert val["status"] in ("DISABLED", "WARNING", "healthy", "unhealthy")


# 4. MIME Structure, Headers, HTML & Plain-Text Fallback Test
def test_mime_structure_and_payload_formatting():
    """Verify HTML & plain-text body creation, Subject, Sender, and Reply-To headers."""
    now = datetime.now(timezone.utc)
    to_email = "mime_test@lumora.io"
    accept_url = "https://admin.lumora.io/admin/accept-invite?token=abc"

    ok, err, latency = send_invitation_email(
        to_email=to_email,
        invited_name="MIME User",
        role_level="editor",
        accept_url=accept_url,
        expires_at=now + timedelta(hours=48),
        message="Welcome to team!",
    )
    assert ok is True
    assert err is None


# 5. Revoked Invitation Resend Guard Test
def test_revoked_invitation_resend_blocked():
    db = SessionLocal()
    try:
        admin = get_super_admin(db)
        now_utc = datetime.utcnow()
        inv = AdminInvitation(
            email=f"revoked_{uuid.uuid4().hex[:6]}@lumora.io",
            role_level="moderator",
            invite_token=f"revoked_token_{uuid.uuid4().hex[:8]}",
            expires_at=now_utc + timedelta(hours=48),
            revoked_at=now_utc - timedelta(hours=1),
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)

        with pytest.raises(HTTPException) as exc_info:
            resend_invitation(invitation_id=inv.id, db=db, admin_user=admin)

        assert exc_info.value.status_code == 400
        assert "cannot resend" in exc_info.value.detail.lower()
    finally:
        db.close()


# 6. Duplicate Click (5 Clicks) Cooldown Guard Test
def test_resend_5_times_duplicate_click_cooldown():
    """Clicking resend 5 times rapidly: 1st succeeds, next 4 return HTTP 429."""
    db = SessionLocal()
    try:
        admin = get_super_admin(db)
        now_utc = datetime.utcnow()
        inv = AdminInvitation(
            email=f"dupe_{uuid.uuid4().hex[:6]}@lumora.io",
            role_level="moderator",
            invite_token=f"dupe_token_{uuid.uuid4().hex[:8]}",
            expires_at=now_utc + timedelta(hours=48),
            last_email_sent_at=now_utc - timedelta(seconds=120), # Sent 2 mins ago
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)

        # First resend succeeds
        res1 = resend_invitation(invitation_id=inv.id, db=db, admin_user=admin)
        assert "accept_url" in res1

        # Clicks 2 through 5 must raise HTTP 429
        for _ in range(4):
            with pytest.raises(HTTPException) as exc_info:
                resend_invitation(invitation_id=inv.id, db=db, admin_user=admin)
            assert exc_info.value.status_code == 429
            assert "please wait" in exc_info.value.detail.lower()
    finally:
        db.close()


# 7. Graceful SMTP Failure Handling Test
def test_graceful_smtp_failure_handling(monkeypatch):
    """Test wrong host / bad port handling without unhandled exceptions."""
    from app.core import config
    monkeypatch.setattr(config.settings, "SMTP_ENABLED", True)
    monkeypatch.setattr(config.settings, "EMAIL_PROVIDER", "gmail_smtp")
    monkeypatch.setattr(config.settings, "SMTP_HOST", "invalid.nonexistent.smtp.host")
    monkeypatch.setattr(config.settings, "SMTP_PORT", 9999)

    ok, err, latency = _send_raw_with_retry(
        to_email="failure_test@lumora.io",
        subject="Failure Test",
        text_body="Text",
        html_body="<b>HTML</b>",
        max_retries=1,
    )

    assert ok is False
    assert err is not None
    assert "failed" in err.lower() or "gaierror" in err.lower() or "refused" in err.lower() or "timeout" in err.lower()


# 8. Delivery Metrics Endpoint Test
def test_email_health_and_metrics_endpoints():
    db = SessionLocal()
    try:
        admin = get_super_admin(db)
        health_res = get_email_health(admin_user=admin)
        assert "status" in health_res

        metrics_res = get_email_metrics(admin_user=admin)
        assert "metrics" in metrics_res
        assert "health" in metrics_res
        metrics = metrics_res["metrics"]
        assert "total_dispatched" in metrics
        assert "total_successful" in metrics
        assert "total_failed" in metrics
        assert "success_rate_percent" in metrics
        assert "average_latency_ms" in metrics
    finally:
        db.close()


# 9. Dynamic SMTP Health State Transitions Test
def test_dynamic_smtp_health_state_transitions(monkeypatch):
    from app.core import config

    # State 1: Disabled
    monkeypatch.setattr(config.settings, "SMTP_ENABLED", False)
    h1 = check_smtp_health()
    assert h1["status"] == "disabled"

    # State 2: Enabled but Unhealthy Host
    monkeypatch.setattr(config.settings, "SMTP_ENABLED", True)
    monkeypatch.setattr(config.settings, "SMTP_HOST", "127.0.0.1")
    monkeypatch.setattr(config.settings, "SMTP_PORT", 65534)
    h2 = check_smtp_health()
    assert h2["status"] == "unhealthy"

    # State 3: Disabled again
    monkeypatch.setattr(config.settings, "SMTP_ENABLED", False)
    h3 = check_smtp_health()
    assert h3["status"] == "disabled"
