"""
app/models/platform_treasury_ledger.py
----------------------------------------
Immutable double-entry treasury ledger for Lumora Platform.

Every financial event (revenue earned, affiliate commission expense,
platform withdrawal, refund, manual adjustment) creates a NEW row.
Existing rows are NEVER modified or deleted.

Running balance is a denormalized snapshot for fast dashboard queries.
For audit integrity, recompute from scratch by summing all signed amounts.
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.user import Base


class PlatformTreasuryLedger(Base):
    """
    Immutable double-entry ledger for platform treasury events.

    Ledger types:
      revenue_earned     — Platform fee earned on a completed order
      refund             — Order refunded (negative amount)
      commission_expense — Affiliate commission approved (liability recognized)
      affiliate_expense  — Affiliate payout completed (liability settled)
      vendor_adjustment  — Manual adjustment for vendor-related correction
      platform_withdrawal — Platform owner withdrawal (negative amount)
      chargeback         — Payment chargeback received
      manual_adjustment  — Admin manual balance correction
    """
    __tablename__ = "platform_treasury_ledgers"

    id              = Column(Integer, primary_key=True, index=True)

    ledger_type     = Column(String(50), nullable=False, index=True)
    # One of: revenue_earned | refund | commission_expense | affiliate_expense
    #         vendor_adjustment | platform_withdrawal | chargeback | manual_adjustment

    amount          = Column(Float, nullable=False)
    # Positive = credit (revenue earned), Negative = debit (expense/withdrawal)

    running_balance = Column(Float, nullable=True)
    # Denormalized snapshot of running platform revenue balance at time of entry.
    # Used for fast queries only; source of truth is SUM(amount) over all rows.

    reference_type  = Column(String(50), nullable=True, index=True)
    # Entity that triggered this entry: 'order' | 'withdrawal' | 'refund' | 'affiliate_payout'

    reference_id    = Column(String(64), nullable=True, index=True)
    # ID or business reference number of the triggering entity

    description     = Column(Text, nullable=True)
    # Human-readable description of the ledger entry

    created_by      = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    creator = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        Index("ix_treasury_ledger_type_date", "ledger_type", "created_at"),
        Index("ix_treasury_ledger_ref", "reference_type", "reference_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<PlatformTreasuryLedger id={self.id} "
            f"type={self.ledger_type} amount={self.amount} "
            f"balance={self.running_balance}>"
        )
