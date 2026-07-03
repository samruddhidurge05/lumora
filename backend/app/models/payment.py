from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.models.user import Base
from datetime import datetime


class Payment(Base):
    __tablename__ = "payments"

    id             = Column(Integer, primary_key=True, index=True)
    order_id       = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    gateway        = Column(String(30), default="mock")      # mock | razorpay | stripe
    gateway_ref    = Column(String(120), nullable=True)
    amount         = Column(Float, nullable=False)
    currency       = Column(String(10), default="INR")
    status         = Column(String(20), default="success")   # success | failed | pending | refunded
    method         = Column(String(30), nullable=True)       # upi | card | netbanking | wallet
    receipt        = Column(Text, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", foreign_keys=[order_id])
