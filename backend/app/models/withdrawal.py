from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.user import Base
from datetime import datetime


class Withdrawal(Base):
    """
    Vendor withdrawal requests.
    Replaces the in-memory _WITHDRAWALS dict in vendors/services.py.
    vendor_id stores the string uid (str(user.id)) used across the vendor API.
    """
    __tablename__ = "withdrawals"

    id           = Column(Integer, primary_key=True, index=True)
    vendor_id    = Column(String(120), nullable=False, index=True)
    amount       = Column(Float, nullable=False)
    method       = Column(String(30), default="upi")        # upi | bank_transfer
    upi_id       = Column(String(120), nullable=True)
    bank_account = Column(String(120), nullable=True)
    status       = Column(String(20), default="pending")    # pending | processing | completed | rejected
    eta          = Column(String(30), default="Instant")
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
