"""
backend/app/models/admin_email_log.py
--------------------------------------
SQLAlchemy model for immutable, append-only email audit logs.
Tracks every delivery event across the invitation lifecycle.
"""
from datetime import datetime, timezone
from typing import Any, Optional
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.models.user import Base


def _utc_now():
    return datetime.now(timezone.utc)


class AdminEmailLog(Base):
    """
    Immutable, append-only log entry for email events.
    Events: CREATED, QUEUED, SENDING, RETRYING, SENT, FAILED, ACCEPTED, REVOKED, EXPIRED.
    """
    __tablename__ = "admin_email_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    invitation_id = Column(Integer, ForeignKey("admin_invitations.id", ondelete="CASCADE"), nullable=False, index=True)
    event = Column(String(50), nullable=False, index=True)
    job_id = Column(String(36), nullable=True, index=True)
    correlation_id = Column(String(36), nullable=True, index=True)
    recipient = Column(String(255), nullable=False)
    provider = Column(String(50), nullable=False, default="gmail_smtp")
    attempt = Column(Integer, nullable=False, default=1)
    latency_ms = Column(Integer, nullable=False, default=0)
    status_code = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    message_id = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now, index=True)

    # Relationship back to invitation
    invitation = relationship("AdminInvitation", backref="email_logs")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "invitation_id": self.invitation_id,
            "event": self.event,
            "job_id": self.job_id,
            "correlation_id": self.correlation_id,
            "message_id": self.message_id,
            "recipient": self.recipient,
            "provider": self.provider,
            "attempt": self.attempt,
            "latency_ms": self.latency_ms,
            "status_code": self.status_code,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
