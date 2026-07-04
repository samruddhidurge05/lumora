from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from datetime import datetime

from app.models.user import Base


class PlatformSetting(Base):
    __tablename__ = "platform_settings"

    key         = Column(String(100), primary_key=True)
    value       = Column(Text, nullable=False)
    updated_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
