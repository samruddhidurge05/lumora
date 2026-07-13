"""
app/repositories/payment_repo.py
----------------------------------
Payment repository — database queries ONLY.

Rule: No business logic here. No HTTP exceptions. No gateway calls.
      Business logic belongs in PaymentService.

Methods grouped by caller:
    PaymentService   → create_payment, find_by_*, update_status, find_expired_pending
    Customer routes  → customer_history
    Vendor routes    → vendor_history
    Admin routes     → admin_history, get_all_failed, get_all_pending
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.payment import Payment
from app.repositories.base import BaseRepository


# Sentinel value: pass CLEAR to update_status() to explicitly set a field to NULL.
# Passing None (the default) means "do not touch this field".
# This distinction is important for retry logic which must clear stale gateway IDs.
class _ClearSentinel:
    """Signals that a field should be explicitly set to NULL in the database."""
    def __repr__(self) -> str:
        return "CLEAR"

CLEAR = _ClearSentinel()


class PaymentRepository(BaseRepository[Payment]):

    def __init__(self, db: Session):
        super().__init__(Payment, db)

    # ─── Create ──────────────────────────────────────────────────────────────

    def create_payment(
        self,
        customer_id: int,
        amount: float,
        currency: str = "INR",
        gateway: str = "mock",
        idempotency_key: Optional[str] = None,
        promo_code: Optional[str] = None,
        affiliate_code: Optional[str] = None,
        discount_amount: float = 0.0,
        tax_amount: float = 0.0,
        vendor_ids: Optional[str] = None,
        expires_minutes: int = 30,
        items: Optional[list] = None,
    ) -> Payment:
        """
        Create a new PENDING payment record.

        Called by PaymentService.initiate_payment() BEFORE calling the gateway.
        The payment_ref is a human-readable Lumora reference: LUM-YYYYMMDD-{hex8}
        items is stored as JSON so confirm can rebuild the order without the cart.
        """
        import json as _json
        today = datetime.utcnow()
        payment_ref = f"LUM-{today.strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

        payment = Payment(
            payment_ref=payment_ref,
            customer_id=customer_id,
            amount=amount,
            currency=currency,
            gateway=gateway,
            status="PENDING",
            idempotency_key=idempotency_key,
            promo_code=promo_code,
            affiliate_code=affiliate_code,
            discount_amount=discount_amount,
            tax_amount=tax_amount,
            vendor_ids=vendor_ids,
            expires_at=today + timedelta(minutes=expires_minutes),
            items_json=_json.dumps(items) if items else None,
        )
        self.db.add(payment)
        return payment

    # ─── Find ────────────────────────────────────────────────────────────────

    def find_by_payment_ref(self, payment_ref: str) -> Optional[Payment]:
        """Look up a payment by its Lumora reference (LUM-YYYYMMDD-XXXXXXXX)."""
        return (
            self.db.query(Payment)
            .filter(Payment.payment_ref == payment_ref)
            .first()
        )

    def find_by_idempotency_key(self, key: str) -> Optional[Payment]:
        """
        Check if a payment already exists for this idempotency key.
        Prevents duplicate payments when customer presses Pay multiple times.
        """
        return (
            self.db.query(Payment)
            .filter(Payment.idempotency_key == key)
            .first()
        )

    def find_by_gateway_order_id(self, gateway_order_id: str) -> Optional[Payment]:
        """
        Find payment by the gateway's order ID (e.g., Razorpay order_id).
        Used by webhook handlers to look up the payment when Razorpay notifies us.
        """
        return (
            self.db.query(Payment)
            .filter(Payment.gateway_order_id == gateway_order_id)
            .first()
        )

    def find_by_order_id(self, order_id: int) -> Optional[Payment]:
        """Find the payment associated with a completed order."""
        return (
            self.db.query(Payment)
            .filter(Payment.order_id == order_id)
            .first()
        )

    # ─── Update ──────────────────────────────────────────────────────────────

    def update_status(
        self,
        payment: Payment,
        new_status: str,
        failure_reason: Optional[str] = None,
        gateway_payment_id=None,   # Pass CLEAR to set to NULL, None to leave unchanged
        gateway_order_id=None,     # Pass CLEAR to set to NULL, None to leave unchanged
        gateway_signature=None,    # Pass CLEAR to set to NULL, None to leave unchanged
        order_id: Optional[int] = None,
        payment_method: Optional[str] = None,
    ) -> Payment:
        """
        Transition payment to a new status and stamp the relevant timestamp.

        Field update rules:
            - Pass a value       → set field to that value
            - Pass None          → do NOT touch this field (leave as-is)
            - Pass CLEAR         → explicitly set field to NULL in the database

        The CLEAR sentinel is used by retry_payment() to wipe stale
        gateway_payment_id and gateway_signature from a failed attempt.

        Valid transitions (enforced by PaymentService, not here):
            PENDING     → PROCESSING | CANCELLED | EXPIRED
            PROCESSING  → SUCCESS | FAILED
            SUCCESS     → REFUND_PENDING
            REFUND_PENDING → REFUNDED | PARTIALLY_REFUNDED
        """
        now = datetime.utcnow()
        payment.status = new_status
        payment.updated_at = now

        # failure_reason: None means clear (unique case — retry always clears it)
        # We treat explicit None as "clear" here since a PENDING payment should
        # never have a stale failure_reason from a previous FAILED state.
        payment.failure_reason = failure_reason

        # For gateway fields: None = "don't touch", CLEAR = "set to NULL"
        if isinstance(gateway_payment_id, _ClearSentinel):
            payment.gateway_payment_id = None
        elif gateway_payment_id is not None:
            payment.gateway_payment_id = gateway_payment_id

        if isinstance(gateway_order_id, _ClearSentinel):
            payment.gateway_order_id = None
        elif gateway_order_id is not None:
            payment.gateway_order_id = gateway_order_id

        if isinstance(gateway_signature, _ClearSentinel):
            payment.gateway_signature = None
        elif gateway_signature is not None:
            payment.gateway_signature = gateway_signature

        if order_id is not None:
            payment.order_id = order_id

        if payment_method is not None:
            payment.payment_method = payment_method

        # Stamp the appropriate audit timestamp
        if new_status == "PROCESSING":
            payment.verified_at = now
        elif new_status == "SUCCESS":
            payment.completed_at = now
        elif new_status in ("REFUNDED", "PARTIALLY_REFUNDED"):
            payment.refunded_at = now

        self.db.add(payment)
        return payment

    def increment_retry(self, payment: Payment) -> Payment:
        """Increment retry_count when customer retries a failed payment."""
        payment.retry_count = (payment.retry_count or 0) + 1
        payment.updated_at = datetime.utcnow()
        self.db.add(payment)
        return payment

    # ─── History Queries ─────────────────────────────────────────────────────

    def customer_history(
        self,
        customer_id: int,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
    ) -> List[Payment]:
        """All payments for a customer, newest first."""
        q = self.db.query(Payment).filter(Payment.customer_id == customer_id)
        if status:
            q = q.filter(Payment.status == status.upper())
        return q.order_by(desc(Payment.created_at)).offset(skip).limit(limit).all()

    def vendor_history(
        self,
        vendor_id: str,
        skip: int = 0,
        limit: int = 20,
    ) -> List[Payment]:
        """
        All SUCCESS payments where vendor_ids contains this vendor.
        vendor_ids is stored as comma-separated vendor IDs (e.g. "3,7,12").
        """
        return (
            self.db.query(Payment)
            .filter(
                Payment.status == "SUCCESS",
                Payment.vendor_ids.contains(vendor_id),
            )
            .order_by(desc(Payment.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def admin_history(
        self,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
        gateway: Optional[str] = None,
    ) -> List[Payment]:
        """All payments for admin dashboard, with optional filters."""
        q = self.db.query(Payment)
        if status:
            q = q.filter(Payment.status == status.upper())
        if gateway:
            q = q.filter(Payment.gateway == gateway.lower())
        return q.order_by(desc(Payment.created_at)).offset(skip).limit(limit).all()

    # ─── Operational Queries ─────────────────────────────────────────────────

    def get_expired_pending(self) -> List[Payment]:
        """
        Return all PENDING payments whose expires_at has passed.
        Used by a background job or startup task to expire stale checkouts.
        """
        now = datetime.utcnow()
        return (
            self.db.query(Payment)
            .filter(
                Payment.status == "PENDING",
                Payment.expires_at != None,
                Payment.expires_at < now,
            )
            .all()
        )

    def get_all_failed(self, limit: int = 100) -> List[Payment]:
        """Recent FAILED payments — used for admin monitoring."""
        return (
            self.db.query(Payment)
            .filter(Payment.status == "FAILED")
            .order_by(desc(Payment.created_at))
            .limit(limit)
            .all()
        )

    def get_all_pending(self, limit: int = 100) -> List[Payment]:
        """Active PENDING payments — used for admin monitoring."""
        return (
            self.db.query(Payment)
            .filter(Payment.status == "PENDING")
            .order_by(desc(Payment.created_at))
            .limit(limit)
            .all()
        )
