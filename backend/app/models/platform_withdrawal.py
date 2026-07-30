"""
app/models/platform_withdrawal.py
-----------------------------------
SQLAlchemy model for Lumora Platform Treasury Withdrawals.

Stores immutable withdrawal records for platform owner earnings.
Uses structured business reference format: PLT-WD-YYYYMMDD-XXXXXX
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.user import Base


class PlatformWithdrawal(Base):
    __tablename__ = "platform_withdrawals"

    id                    = Column(Integer, primary_key=True, index=True)
    withdrawal_number     = Column(String(64), unique=True, index=True, nullable=False)
    amount                = Column(Float, nullable=False)
    currency              = Column(String(10), default="INR", nullable=False)
    status                = Column(String(30), default="pending", nullable=False, index=True)
    # Statuses: pending | approved | processing | completed | failed | cancelled | rejected

    requested_by          = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    requested_at          = Column(DateTime, default=datetime.utcnow, nullable=False)

    approved_by           = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at           = Column(DateTime, nullable=True)

    completed_at          = Column(DateTime, nullable=True)
    transaction_reference = Column(String(120), nullable=True, index=True)  # Bank UTR / Gateway ID

    destination_type      = Column(String(50), default="bank_account", nullable=False)
    destination_account   = Column(Text, nullable=True)  # JSON snapshot of destination details

    notes                 = Column(Text, nullable=True)
    failure_reason        = Column(Text, nullable=True)

    created_at            = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at            = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    requester = relationship("User", foreign_keys=[requested_by])
    approver  = relationship("User", foreign_keys=[approved_by])

    __table_args__ = (
        Index("ix_platform_withdrawals_status_req", "status", "requested_at"),
    )

    def __repr__(self) -> str:
        return f"<PlatformWithdrawal {self.withdrawal_number} status={self.status} amount={self.amount}>"
