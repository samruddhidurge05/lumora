from sqlalchemy import Column, Integer, String, Text, DateTime
from app.models.user import Base
from datetime import datetime

class SQLReport(Base):
    __tablename__ = "reports"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(String(50), nullable=False)
    product_id  = Column(String(50), nullable=False)
    category    = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    status      = Column(String(50), default="Pending") # Pending | Resolved | Rejected
    reporter    = Column(String(150), nullable=True)
    title       = Column(String(250), nullable=True)
    severity    = Column(String(50), default="medium")
    assignee    = Column(String(150), default="Unassigned")
    created_at  = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
