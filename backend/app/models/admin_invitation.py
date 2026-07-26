from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.user import Base


class AdminInvitation(Base):
    __tablename__ = "admin_invitations"

    id           = Column(Integer, primary_key=True, index=True)
    email        = Column(String(255), nullable=False)
    role_level   = Column(String(50), nullable=False, default="admin")
    invite_token = Column(String(128), unique=True, nullable=False, index=True)
    invited_by   = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    expires_at   = Column(DateTime, nullable=False)
    accepted_at  = Column(DateTime, nullable=True)
    revoked_at   = Column(DateTime, nullable=True)   # soft-revoke (Req 3)
    invited_name = Column(String(150), nullable=True) # optional display name (Req 8)
    message      = Column(Text, nullable=True)        # optional personal message (Req 8)
    email_status = Column(String(50), nullable=False, default="created") # 'created'|'email_queued'|'email_sent'|'email_failed'
    last_email_sent_at = Column(DateTime, nullable=True)
    email_error_log    = Column(Text, nullable=True)
    resend_count       = Column(Integer, nullable=False, default=0)
    first_sent_at      = Column(DateTime, nullable=True)
    last_attempt_at    = Column(DateTime, nullable=True)
    next_retry_at      = Column(DateTime, nullable=True)
    provider           = Column(String(50), nullable=False, default="gmail_smtp")
    created_at   = Column(DateTime, default=datetime.utcnow)

    inviter = relationship("User", foreign_keys=[invited_by])
