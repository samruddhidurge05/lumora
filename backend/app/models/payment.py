"""
app/models/payment.py
---------------------
Production-ready Payment model for Lumora Digital Marketplace.

Design decisions:
  - product_ids are NOT stored here. Traverse Payment → Order → OrderItems → Products.
    Avoid duplicating data that already exists in the order relationship.
  - idempotency_key prevents duplicate payments when customer submits multiple times.
  - verified_at / completed_at / refunded_at provide accurate audit timestamps.
  - failure_reason stores gateway error codes for debugging and customer support.
  - retry_count tracks how many times a customer retried a failed payment.
"""
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, Text, Index
)
from sqlalchemy.orm import relationship
from app.models.user import Base
from datetime import datetime


class Payment(Base):
    __tablename__ = "payments"

    # ── Primary Key ──────────────────────────────────────────────────────────
    id                  = Column(Integer, primary_key=True, index=True)

    # ── Lumora Internal IDs ───────────────────────────────────────────────────
    # payment_ref is a human-readable Lumora reference e.g. "LUM-20260708-abc123"
    payment_ref         = Column(String(64),  unique=True, index=True, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    # order_id is nullable because Payment is created BEFORE the Order.
    # Once payment succeeds, order_id is populated.
    order_id            = Column(Integer, ForeignKey("orders.id"), nullable=True, index=True)
    customer_id         = Column(Integer, ForeignKey("users.id"),  nullable=False, index=True)

    # Denormalized vendor_id for fast vendor dashboard queries.
    # Comma-separated when multiple vendors in one cart (multi-vendor order).
    vendor_ids          = Column(Text, nullable=True)

    # ── Gateway ───────────────────────────────────────────────────────────────
    gateway             = Column(String(30),  default="mock", nullable=False)   # mock | razorpay | stripe
    gateway_order_id    = Column(String(120), nullable=True, index=True)        # Razorpay order_id
    gateway_payment_id  = Column(String(120), nullable=True, index=True)        # Razorpay payment_id
    gateway_signature   = Column(String(256), nullable=True)                    # Razorpay signature

    # ── Financials ────────────────────────────────────────────────────────────
    currency            = Column(String(10),  default="INR", nullable=False)
    amount              = Column(Float,       nullable=False)                   # Total charged
    discount_amount     = Column(Float,       default=0.0)
    tax_amount          = Column(Float,       default=0.0)

    # ── Method ────────────────────────────────────────────────────────────────
    payment_method      = Column(String(30),  nullable=True)                    # upi | card | netbanking | wallet

    # ── Status ───────────────────────────────────────────────────────────────
    # PENDING → PROCESSING → SUCCESS | FAILED | CANCELLED | EXPIRED
    # SUCCESS → REFUND_PENDING → REFUNDED | PARTIALLY_REFUNDED
    status              = Column(String(30),  default="PENDING", nullable=False, index=True)
    failure_reason      = Column(Text,        nullable=True)                    # Gateway error or Lumora rejection reason
    retry_count         = Column(Integer,     default=0)

    # ── Idempotency ───────────────────────────────────────────────────────────
    # Frontend sends a unique key per checkout session.
    # Backend rejects duplicate payment initiation for the same key.
    idempotency_key     = Column(String(128), unique=True, index=True, nullable=True)

    # ── Items snapshot ────────────────────────────────────────────────────────
    # JSON-encoded list of {"product_id": int, "price_paid": float}
    # Stored at initiate time so confirm can rebuild the order without the cart.
    items_json          = Column(Text, nullable=True)

    # ── Promo / Affiliate ─────────────────────────────────────────────────────
    promo_code          = Column(String(50),  nullable=True)
    affiliate_code      = Column(String(50),  nullable=True)

    # ── Audit Timestamps ──────────────────────────────────────────────────────
    created_at          = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    verified_at         = Column(DateTime, nullable=True)    # When signature was verified
    completed_at        = Column(DateTime, nullable=True)    # When order was confirmed
    refunded_at         = Column(DateTime, nullable=True)    # When refund was processed
    expires_at          = Column(DateTime, nullable=True)    # When PENDING payment expires

    # ── Relationships ─────────────────────────────────────────────────────────
    order    = relationship("Order", foreign_keys=[order_id])
    customer = relationship("User",  foreign_keys=[customer_id])

    # ── Composite Indexes ─────────────────────────────────────────────────────
    __table_args__ = (
        Index("ix_payments_customer_status", "customer_id", "status"),
        Index("ix_payments_gateway_order",   "gateway",     "gateway_order_id"),
    )

    def __repr__(self) -> str:
        return f"<Payment {self.payment_ref} status={self.status} amount={self.amount}>"

