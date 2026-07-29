from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from datetime import datetime

from app.models.user import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    admin_user_id   = Column(Integer, ForeignKey("users.id"), nullable=True)
    action          = Column(String(100), nullable=False)
    # Category groups events for filtering: Security, Product, Financial, Affiliate, etc.
    category        = Column(String(50), nullable=True)
    target_type     = Column(String(50), nullable=True)
    target_id       = Column(String(100), nullable=True)
    metadata_json   = Column("metadata", Text, nullable=True)
    # Snapshot of actor identity at log time (JSON: name, email, role)
    actor_metadata  = Column(Text, nullable=True)
    ip_address      = Column(String(45), nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

