from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from app.models.user import Base
from datetime import datetime


class Coupon(Base):
    __tablename__ = "coupons"

    id              = Column(Integer, primary_key=True, index=True)
    code            = Column(String(50), unique=True, nullable=False, index=True)
    discount_type   = Column(String(20), default="percent")  # percent | flat
    discount_value  = Column(Float, default=0.0)
    min_order_value = Column(Float, default=0.0)
    max_uses        = Column(Integer, default=100)
    uses_count      = Column(Integer, default=0)
    is_active       = Column(Boolean, default=True)
    expires_at      = Column(DateTime, nullable=True)
    description     = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
