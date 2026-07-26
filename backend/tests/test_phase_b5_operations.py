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
from app.services.email_providers import (
    BaseEmailProvider,
    GmailProvider,
    MockProvider,
    FailoverEmailProvider,
)
from app.services.email_service import _send_raw_with_retry
from app.admin_api.admin_users.routes import (
    get_email_dead_letter_queue,
    retry_dead_letter_email,
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
    admin = db.query(User).filter(User.email == "b5_admin@lumora.io").first()
    if not admin:
        admin = User(name="B5 Admin", email="b5_admin@lumora.io", role="admin", password_hash="hash123")
        db.add(admin)
        db.commit()
        db.refresh(admin)
        role = AdminRole(user_id=admin.id, role_level="super_admin", is_active=True)
        db.add(role)
        db.commit()
    return admin


class AlwaysFailingProvider(BaseEmailProvider):
    @property
    def name(self) -> str:
        return "always_failing"

    def send(self, to_email: str, subject: str, text_body: str, html_body: str, job_id: str, correlation_id: str, invitation_id: int = None):
        return False, "Simulated Transport Connection Refused", 10

    def check_health(self):
        return {"status": "unhealthy", "provider": self.name, "latency_ms": 10, "error": "Forced error"}


# 1. Test Failover Provider Fallback Execution
def test_failover_provider_chain_fallback():
    failing = AlwaysFailingProvider()
    working = MockProvider()
    chain = FailoverEmailProvider([failing, working])

    assert chain.check_health()["status"] == "unhealthy"

    ok, err, lat = chain.send(
        to_email="failover@lumora.io",
        subject="Test",
        text_body="Test",
        html_body="<b>Test</b>",
        job_id="job_123",
        correlation_id="corr_123",
    )
    assert ok is True
    assert err is None
    assert lat >= 0


# 2. Test DLQ Status Transition on Permanent Failover Failure
def test_dead_letter_queue_event_recording(monkeypatch):
    failing1 = AlwaysFailingProvider()
    failing2 = AlwaysFailingProvider()
    chain = FailoverEmailProvider([failing1, failing2])

    from app.services import email_providers
    monkeypatch.setattr(email_providers, "get_email_provider", lambda provider_name=None: chain)

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        inv = AdminInvitation(
            email=f"dlq_{uuid.uuid4().hex[:6]}@lumora.io",
            role_level="analyst",
            invite_token=f"dlq_tok_{uuid.uuid4().hex[:8]}",
            expires_at=now + timedelta(hours=48),
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)

        ok, err, lat = _send_raw_with_retry(
            to_email=inv.email,
            subject="DLQ Test",
            text_body="Test",
            html_body="<b>Test</b>",
            invitation_id=inv.id,
            max_retries=1,
        )
        assert ok is False
        assert err is not None

        dlq_logs = db.query(AdminEmailLog).filter(
            AdminEmailLog.invitation_id == inv.id,
            AdminEmailLog.event == "DEAD_LETTER_QUEUE",
        ).all()
        assert len(dlq_logs) == 1
        assert "DLQ Enqueued" in dlq_logs[0].error_message
    finally:
        db.close()


# 3. Test GET /email-dlq & POST /email-dlq/{id}/retry Endpoints
def test_email_dlq_endpoints():
    db = SessionLocal()
    try:
        admin = get_super_admin(db)
        now = datetime.now(timezone.utc)
        inv = AdminInvitation(
            email=f"retry_dlq_{uuid.uuid4().hex[:6]}@lumora.io",
            role_level="editor",
            invite_token=f"retry_tok_{uuid.uuid4().hex[:8]}",
            expires_at=now + timedelta(hours=48),
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)

        dlq_log = AdminEmailLog(
            invitation_id=inv.id,
            event="DEAD_LETTER_QUEUE",
            recipient=inv.email,
            provider="failover_chain",
            attempt=3,
            latency_ms=100,
            status_code=500,
            error_message="DLQ Enqueued: Forced Error",
        )
        db.add(dlq_log)
        db.commit()
        db.refresh(dlq_log)

        # GET DLQ list
        dlq_res = get_email_dead_letter_queue(db=db, admin_user=admin)
        assert dlq_res["total_dead_lettered"] >= 1

        # POST Retry DLQ job
        retry_res = retry_dead_letter_email(log_id=dlq_log.id, db=db, admin_user=admin)
        assert "re-queued successfully" in retry_res["message"]
    finally:
        db.close()


# 4. Test Distributed Idempotency Row Lock
def test_distributed_idempotency_row_lock():
    db = SessionLocal()
    try:
        admin = get_super_admin(db)
        now_utc = datetime.utcnow()
        inv = AdminInvitation(
            email=f"rowlock_{uuid.uuid4().hex[:6]}@lumora.io",
            role_level="analyst",
            invite_token=f"lock_tok_{uuid.uuid4().hex[:8]}",
            expires_at=now_utc + timedelta(hours=48),
            last_email_sent_at=now_utc - timedelta(seconds=10), # Only 10s ago
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)

        with pytest.raises(Exception) as exc_info:
            resend_invitation(invitation_id=inv.id, db=db, admin_user=admin)
        assert "429" in str(exc_info.value) or "wait" in str(exc_info.value).lower()
    finally:
        db.close()
