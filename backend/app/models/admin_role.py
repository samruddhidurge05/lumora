from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.user import Base


class AdminRole(Base):
    __tablename__ = "admin_roles"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    role_level      = Column(String(50), nullable=False, default="admin")
    # role_level: super_admin | admin | moderator | support | finance | marketing | analyst
    permissions     = Column(Text, nullable=True)  # JSON array of explicit permissions
    invited_by      = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_active       = Column(Boolean, nullable=False, default=True)
    activated_at    = Column(DateTime, nullable=True)
    deactivated_at  = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user    = relationship("User", foreign_keys=[user_id], backref="admin_role")
    inviter = relationship("User", foreign_keys=[invited_by])
