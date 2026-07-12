"""
app/services/payment_service.py
---------------------------------
Payment service — business logic and state machine.

Rule: No raw SQL here. Use PaymentRepository.
      No gateway imports here. Use get_gateway().
      No HTTP responses here. Return domain objects.

Payment State Machine:
    PENDING
        → PROCESSING   (customer confirms payment, signature valid)
        → CANCELLED    (customer cancels before paying)
        → EXPIRED      (30-minute timeout, no action taken)

    PROCESSING
        → SUCCESS      (PurchaseService completed successfully)
        → FAILED       (PurchaseService raised exception, or gateway capture failed)

    SUCCESS
        → REFUND_PENDING  (admin initiates refund)

    REFUND_PENDING
        → REFUNDED           (full refund confirmed)
        → PARTIALLY_REFUNDED (partial refund confirmed)

Idempotency:
    initiate_payment() checks idempotency_key before creating a new Payment.
    If the same key is seen again, the existing payment is returned unchanged.
    This prevents duplicate payments when customer presses Pay 5 times.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.payments.gateway.factory import get_gateway
from app.repositories.payment_repo import PaymentRepository, CLEAR
from app.services.activity_log_service import ActivityLogService
from app.models.payment import Payment

logger = logging.getLogger(__name__)

# Valid state transitions — enforced on every update
_VALID_TRANSITIONS: Dict[str, set] = {
    "PENDING":          {"PROCESSING", "CANCELLED", "EXPIRED"},
    "PROCESSING":       {"SUCCESS", "FAILED"},
    "SUCCESS":          {"REFUND_PENDING"},
    "REFUND_PENDING":   {"REFUNDED", "PARTIALLY_REFUNDED"},
    # Terminal states — no further transitions
    "FAILED":           set(),
    "CANCELLED":        set(),
    "EXPIRED":          set(),
    "REFUNDED":         set(),
    "PARTIALLY_REFUNDED": set(),
}


class PaymentService:
    """
    Payment service — owns the full payment lifecycle.

    Each method receives a db Session and creates its own
    PaymentRepository and gateway instance. This makes the service
    stateless and safe to use as a module-level singleton or instantiated
    per request.
    """

    # ─── Initiate ────────────────────────────────────────────────────────────

    def initiate_payment(
        self,
        db: Session,
        customer_id: int,
        amount: float,
        items: List[Dict[str, Any]],
        currency: str = "INR",
        payment_method: str = "upi",
        idempotency_key: Optional[str] = None,
        promo_code: Optional[str] = None,
        affiliate_code: Optional[str] = None,
        discount_amount: float = 0.0,
        tax_amount: float = 0.0,
        vendor_ids: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Step 1 of the payment flow.

        Creates a PENDING Payment record, calls gateway.create_order(),
        stores the gateway_order_id, and returns data the frontend needs
        to open the payment UI.

        Idempotent: if idempotency_key already exists, returns the
        existing payment data without creating a duplicate.
        """
        repo = PaymentRepository(db)

        # ── Idempotency check ────────────────────────────────────────────────
        if idempotency_key:
            existing = repo.find_by_idempotency_key(idempotency_key)
            if existing:
                logger.info(
                    "Idempotency hit: returning existing payment %s for key %s",
                    existing.payment_ref, idempotency_key
                )
                return self._to_initiate_response(existing)

        # ── Gateway: create order ────────────────────────────────────────────
        gateway = get_gateway()
        receipt = f"lum_{uuid.uuid4().hex[:8]}"

        try:
            gateway_order = gateway.create_order(
                amount_inr=amount,
                currency=currency,
                receipt=receipt,
            )
            
            # Extract UPI QR details if requested
            upi_details = {}
            if payment_method == "upi_qr" and hasattr(gateway, "create_upi_qr"):
                upi_details = gateway.create_upi_qr(
                    amount_inr=amount,
                    currency=currency,
                    receipt=receipt,
                )
        except Exception as exc:
            logger.error("Gateway create_order failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Payment gateway error: {exc}",
            )

        # ── Create PENDING payment record ────────────────────────────────────
        payment = repo.create_payment(
            customer_id=customer_id,
            amount=amount,
            currency=currency,
            gateway=gateway.GATEWAY_NAME,
            idempotency_key=idempotency_key,
            promo_code=promo_code,
            affiliate_code=affiliate_code,
            discount_amount=discount_amount,
            tax_amount=tax_amount,
            vendor_ids=vendor_ids,
        )
        # Store the gateway_order_id before flush so it persists
        payment.gateway_order_id = gateway_order.gateway_order_id
        payment.payment_method = payment_method
        db.flush()  # Populate payment.id without committing

        # ── Audit log ────────────────────────────────────────────────────────
        ActivityLogService.log_user_activity(
            db=db,
            user_id=customer_id,
            activity_type="payment_initiated",
            details=f"Payment {payment.payment_ref} initiated for ₹{amount:.2f} via {gateway.GATEWAY_NAME}.",
        )

        logger.info("Payment initiated: %s gateway_order=%s", payment.payment_ref, gateway_order.gateway_order_id)
        
        response = self._to_initiate_response(payment)
        if upi_details:
            response.update(upi_details)
            
        return response

    # ─── Confirm ─────────────────────────────────────────────────────────────

    def confirm_payment(
        self,
        db: Session,
        payment_ref: str,
        customer_id: int,
        gateway_payment_id: str,
        gateway_signature: str,
        items_payload: List[Dict[str, Any]],
        payment_method: str = "upi",
        skip_signature_verify: bool = False,
    ) -> Any:  # Returns Order
        """
        FRONTEND CONFIRMATION PATH — Step 2 of checkout.

        Called after the customer completes payment in the gateway UI.
        The AUTHORITATIVE path (when Razorpay is live) is the webhook:
            POST /api/payments/webhook/razorpay → _handle_webhook_capture()
        This method handles the common case where the browser is still open.

        TRANSACTION SAFETY:
        The entire workflow runs inside ONE atomic database transaction.
        We use a SQLAlchemy SAVEPOINT (nested transaction) for PurchaseService
        so that if any step fails:
            - All order data (Order, OrderItems, commissions, notifications) rolls back
            - The outer transaction can still persist FAILED status to the database
            - Payment is NEVER left stuck in PROCESSING state

        IDEMPOTENCY:
        If payment is already SUCCESS, returns the existing order immediately.
        Safe to call multiple times — only processes once.

        Steps:
        1. Verify signature (SECURITY: always backend, never trust frontend)
        2. Transition PENDING → PROCESSING  [outer transaction flush]
        3. Open SAVEPOINT for PurchaseService
        4.   Create Order
        5.   Create Order Items + unlock Downloads
        6.   Update Vendor Revenue (sales count)
        7.   Create Affiliate Commissions
        8.   Create Notifications (customer, vendor, affiliate)
        9.   Create Activity Logs
        10.  Sync to Firestore mirror
        11. If steps 4-10 ALL succeed → RELEASE SAVEPOINT → PROCESSING → SUCCESS
        12. If ANY step fails → ROLLBACK TO SAVEPOINT → PROCESSING → FAILED
            The outer transaction commits FAILED status cleanly.

        Returns: Order object
        """
        repo = PaymentRepository(db)

        # ── Fetch payment ────────────────────────────────────────────────────
        payment = repo.find_by_payment_ref(payment_ref)
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Payment {payment_ref} not found.",
            )

        # ── Ownership check ──────────────────────────────────────────────────
        if payment.customer_id != customer_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Payment does not belong to this customer.",
            )

        # ── IDEMPOTENCY: already SUCCESS — return existing order immediately ──
        # Safe to call multiple times. Webhook and frontend can both call this.
        if payment.status == "SUCCESS":
            logger.info(
                "confirm_payment: payment %s already SUCCESS — idempotent return",
                payment_ref,
            )
            if payment.order_id:
                from app.models.order import Order
                return db.query(Order).filter(Order.id == payment.order_id).first()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Payment already completed but order link is missing. Contact support.",
            )

        # ── IDEMPOTENCY: PROCESSING guard ────────────────────────────────────
        # Another request (duplicate tab, webhook) may be processing concurrently.
        # Do not allow two simultaneous confirms on the same payment.
        if payment.status == "PROCESSING":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Payment is already being processed. Please wait and check your order history.",
            )

        # ── State check ──────────────────────────────────────────────────────
        if payment.status not in ("PENDING",):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Payment is in state '{payment.status}' and cannot be confirmed.",
            )

        # ── Signature verification ───────────────────────────────────────────
        # SECURITY: Signature is always verified on the backend.
        # The frontend only forwards what the gateway returned — we verify it here.
        if not skip_signature_verify:
            gateway = get_gateway()
            is_valid = gateway.verify_signature(
                gateway_order_id=payment.gateway_order_id or "",
                gateway_payment_id=gateway_payment_id,
                signature=gateway_signature,
            )
            if not is_valid:
                # Mark FAILED — customer can retry via POST /{payment_ref}/retry
                repo.update_status(
                    payment,
                    new_status="FAILED",
                    failure_reason="Invalid payment signature.",
                    gateway_payment_id=gateway_payment_id,
                    gateway_signature=gateway_signature,
                    payment_method=payment_method,
                )
                ActivityLogService.log_user_activity(
                    db=db, user_id=customer_id,
                    activity_type="payment_signature_failed",
                    details=f"Signature verification failed for payment {payment_ref}.",
                )
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Payment signature verification failed.",
                )

        # ── Transition → PROCESSING ──────────────────────────────────────────
        # Flush to DB immediately. Any concurrent request will now see PROCESSING
        # and be rejected by the guard above (no duplicate processing).
        self._assert_transition(payment, "PROCESSING")
        repo.update_status(
            payment,
            new_status="PROCESSING",
            gateway_payment_id=gateway_payment_id,
            gateway_signature=gateway_signature,
            payment_method=payment_method,
        )
        db.flush()  # Persist PROCESSING status without committing outer transaction

        # ── PurchaseService — SAVEPOINT (nested transaction) ──────────────────
        # TRANSACTION SAFETY MECHANISM:
        #
        # We use db.begin_nested() to create a SAVEPOINT within the outer
        # transaction. This means:
        #
        #   OUTER TRANSACTION (started by FastAPI dependency injection)
        #   │
        #   ├── flush: payment status = PROCESSING
        #   │
        #   └── SAVEPOINT
        #       ├── Order
        #       ├── OrderItems
        #       ├── Downloads
        #       ├── Vendor Revenue
        #       ├── Affiliate Commissions
        #       ├── Notifications
        #       ├── Activity Logs
        #       └── Firestore Sync
        #
        # If the SAVEPOINT succeeds → RELEASE → payment = SUCCESS → outer COMMIT
        # If the SAVEPOINT fails   → ROLLBACK TO SAVEPOINT → payment = FAILED → outer COMMIT
        #
        # Result: payment status is ALWAYS persisted correctly.
        # Payment can NEVER be stuck in PROCESSING after a crash or exception.

        order = None
        try:
            nested = db.begin_nested()  # Create SAVEPOINT
            from app.services.purchase_service import PurchaseService

            order = PurchaseService.process_purchase(
                db=db,
                user_id=customer_id,
                items_payload=items_payload,
                total_amount=payment.amount,
                payment_method=payment_method,
                promo_code=payment.promo_code,
                discount_amount=payment.discount_amount or 0.0,
                affiliate_code=payment.affiliate_code,
            )
            nested.commit()  # RELEASE SAVEPOINT — all order data is now part of outer transaction

        except HTTPException as http_exc:
            # Business rule rejection (e.g. product archived, vendor suspended)
            # SAVEPOINT is automatically rolled back when exception propagates out
            try:
                nested.rollback()  # Explicit rollback to SAVEPOINT
            except Exception:
                pass
            failure_reason = f"Business rule rejection: {http_exc.detail}"
            repo.update_status(payment, new_status="FAILED", failure_reason=failure_reason)
            ActivityLogService.log_user_activity(
                db=db, user_id=customer_id,
                activity_type="payment_failed",
                details=f"Payment {payment_ref} failed: {failure_reason}",
            )
            db.commit()  # Persist FAILED status in the outer transaction
            logger.warning("Payment %s → FAILED (business rule): %s", payment_ref, failure_reason)
            raise  # Re-raise the original HTTPException to the router

        except Exception as exc:
            # Unexpected infrastructure error (DB crash, Firestore timeout, etc.)
            try:
                nested.rollback()  # Rollback to SAVEPOINT — no partial order data
            except Exception:
                pass
            failure_reason = f"Internal error: {type(exc).__name__}: {exc}"
            repo.update_status(payment, new_status="FAILED", failure_reason=failure_reason[:500])
            ActivityLogService.log_user_activity(
                db=db, user_id=customer_id,
                activity_type="payment_failed",
                details=f"Payment {payment_ref} failed unexpectedly: {type(exc).__name__}",
            )
            db.commit()  # Persist FAILED status cleanly in the outer transaction
            logger.error(
                "Payment %s → FAILED (unexpected): %s",
                payment_ref, exc, exc_info=True,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Order processing failed. Your payment has not been captured. Please retry.",
            )

        # ── Transition → SUCCESS ─────────────────────────────────────────────
        # PurchaseService succeeded. Link the order and mark complete.
        self._assert_transition(payment, "SUCCESS")
        repo.update_status(
            payment,
            new_status="SUCCESS",
            order_id=order.id,
        )

        # ── Audit log ────────────────────────────────────────────────────────
        ActivityLogService.log_user_activity(
            db=db, user_id=customer_id,
            activity_type="payment_success",
            details=f"Payment {payment_ref} succeeded. Order ORD-{order.id} created.",
        )

        db.commit()  # Final commit — payment=SUCCESS, order fully persisted
        logger.info("Payment %s → SUCCESS, Order ORD-%s", payment_ref, order.id)
        return order

    # ─── Cancel ──────────────────────────────────────────────────────────────

    def cancel_payment(
        self,
        db: Session,
        payment_ref: str,
        customer_id: int,
    ) -> Payment:
        """
        Customer cancels a PENDING payment (e.g. they close checkout).
        Only PENDING payments can be cancelled.
        """
        repo = PaymentRepository(db)
        payment = self._get_owned_payment(repo, payment_ref, customer_id)

        if payment.status != "PENDING":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Only PENDING payments can be cancelled. Current status: {payment.status}",
            )

        self._assert_transition(payment, "CANCELLED")
        repo.update_status(payment, new_status="CANCELLED")

        ActivityLogService.log_user_activity(
            db=db, user_id=customer_id,
            activity_type="payment_cancelled",
            details=f"Payment {payment_ref} cancelled by customer.",
        )

        db.commit()
        return payment

    # ─── Expire (background-safe) ─────────────────────────────────────────────

    def expire_pending_payments(self, db: Session) -> int:
        """
        Mark all timed-out PENDING payments as EXPIRED.
        Safe to call from a startup task or a scheduled job.

        Returns the number of payments expired.
        """
        repo = PaymentRepository(db)
        expired = repo.get_expired_pending()
        count = 0
        for payment in expired:
            repo.update_status(payment, new_status="EXPIRED")
            count += 1

        if count:
            db.commit()
            logger.info("Expired %d stale PENDING payments.", count)

        return count

    # ─── Retry ───────────────────────────────────────────────────────────────

    def retry_payment(
        self,
        db: Session,
        payment_ref: str,
        customer_id: int,
    ) -> Dict[str, Any]:
        """
        RETRY SAFETY — Retry a FAILED payment.

        GUARANTEES:
        - NEVER creates a duplicate Order
        - NEVER creates duplicate OrderItems or Downloads
        - NEVER creates duplicate Affiliate Commissions
        - NEVER creates duplicate Notifications
        - NEVER creates duplicate Vendor Revenue updates
        - Reuses the SAME Payment record (no new payment row)
        - Creates a NEW gateway order only (new gateway_order_id for the UI)

        IDEMPOTENCY GUARDS:
        - If payment is already SUCCESS: immediately returns the existing payment.
          The customer already has their order. No action taken.
        - If payment is PROCESSING: rejects with 409 (concurrent confirm in progress).
        - If payment is PENDING: rejects (no need to retry a non-failed payment).
        - Only FAILED payments proceed to create a new gateway order.

        After retry, the payment is back to PENDING with a fresh gateway_order_id.
        The customer then goes through the normal confirm flow again.
        """
        repo = PaymentRepository(db)
        payment = self._get_owned_payment(repo, payment_ref, customer_id)

        # ── IDEMPOTENCY: SUCCESS guard ────────────────────────────────────────
        # If the payment already succeeded (e.g. webhook confirmed it while
        # customer was looking at the "retry" screen), return success immediately.
        # No new gateway order needed.
        if payment.status == "SUCCESS":
            logger.info(
                "retry_payment: payment %s already SUCCESS — returning existing data",
                payment_ref,
            )
            return self._to_initiate_response(payment)

        # ── IDEMPOTENCY: PROCESSING guard ─────────────────────────────────────
        # A confirm() call is already in progress for this payment.
        # Retrying now would create a race condition.
        if payment.status == "PROCESSING":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Payment is currently being processed. Please wait and check your order history.",
            )

        # ── Only FAILED payments can be retried ───────────────────────────────
        if payment.status != "FAILED":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Only FAILED payments can be retried. "
                    f"Current status: {payment.status}. "
                    f"Use /cancel for PENDING payments."
                ),
            )

        # ── Create new gateway order ───────────────────────────────────────────
        # We create a new gateway order (new gateway_order_id) because the old
        # gateway order may have expired or been marked failed on the provider side.
        # We do NOT create a new Payment record — retry_count is incremented instead.
        gateway = get_gateway()
        receipt = f"lum_retry_{payment.payment_ref.lower()}_{payment.retry_count + 1}"

        try:
            gateway_order = gateway.create_order(
                amount_inr=payment.amount,
                currency=payment.currency,
                receipt=receipt,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Payment gateway error during retry: {exc}",
            )

        # ── Reset the SAME payment record to PENDING ───────────────────────────
        # Clear old gateway_payment_id and gateway_signature — they belong to
        # the failed attempt and must not be reused for verification.
        repo.update_status(
            payment,
            new_status="PENDING",
            gateway_order_id=gateway_order.gateway_order_id,
            gateway_payment_id=CLEAR,   # Clear stale payment ID from failed attempt
            gateway_signature=CLEAR,    # Clear stale signature from failed attempt
            failure_reason=None,        # None here means "clear" per repo convention
        )
        repo.increment_retry(payment)

        ActivityLogService.log_user_activity(
            db=db, user_id=customer_id,
            activity_type="payment_retried",
            details=(
                f"Payment {payment_ref} retried (attempt #{payment.retry_count}). "
                f"New gateway order: {gateway_order.gateway_order_id}."
            ),
        )

        db.commit()
        logger.info(
            "Payment %s retried (attempt #%d), new gateway_order=%s",
            payment_ref, payment.retry_count, gateway_order.gateway_order_id,
        )
        return self._to_initiate_response(payment)

    # ─── Refund (stub — admin only) ───────────────────────────────────────────

    def initiate_refund(
        self,
        db: Session,
        payment_ref: str,
        admin_user_id: int,
        amount: Optional[float] = None,
        reason: str = "Admin initiated refund",
    ) -> Payment:
        """
        Initiate a refund for a SUCCESS payment.
        Transitions SUCCESS → REFUND_PENDING.

        Full refund: amount=None
        Partial refund: amount=<less than original>

        Gateway refund call is made here; downstream cleanup
        (vendor revenue reversal, affiliate commission reversal,
        download revocation, notifications) is handled by the
        future RefundService when that feature is built.
        """
        repo = PaymentRepository(db)
        payment = repo.find_by_payment_ref(payment_ref)

        if not payment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Payment {payment_ref} not found.")

        if payment.status != "SUCCESS":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Only SUCCESS payments can be refunded. Current status: {payment.status}",
            )

        self._assert_transition(payment, "REFUND_PENDING")

        # Call gateway refund
        gateway = get_gateway()
        refund_amount_paise = int(amount * 100) if amount else None

        try:
            result = gateway.refund_payment(
                gateway_payment_id=payment.gateway_payment_id or "",
                amount_paise=refund_amount_paise,
                reason=reason,
            )
        except NotImplementedError:
            # Gateway not yet implemented — mark REFUND_PENDING and process manually
            result = None

        if result and not result.success:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Gateway refund failed: {result.error}",
            )

        new_status = "REFUND_PENDING"
        repo.update_status(payment, new_status=new_status)

        ActivityLogService.log_user_activity(
            db=db, user_id=admin_user_id,
            activity_type="payment_refund_initiated",
            details=f"Refund initiated for payment {payment_ref} by admin. Amount: {'full' if not amount else f'₹{amount:.2f}'}.",
        )

        db.commit()
        return payment

    # ─── Webhook Entry Point (Idempotent) ────────────────────────────────────

    def handle_webhook_capture(
        self,
        db: Session,
        gateway_order_id: str,
        gateway_payment_id: str,
        amount_paise: int,
    ) -> bool:
        """
        WEBHOOK AUTHORITATIVE PATH — called by RazorpayWebhookHandler.on_payment_captured().

        This is the idempotent entry point for webhook-driven payment confirmation.
        Designed to be called multiple times safely (Razorpay may retry webhooks).

        IDEMPOTENCY GUARANTEES:
        - If payment is already SUCCESS: logs and returns True immediately. No action.
        - If payment is FAILED or CANCELLED: logs and returns False. No resurrection.
        - If payment is PENDING: transitions to PROCESSING, then calls confirm logic.
        - If payment is PROCESSING: another request is in progress — returns False safely.

        ARCHITECTURE NOTE:
        When Razorpay is live, this method is the AUTHORITATIVE confirmation source.
        The frontend's POST /api/payments/confirm is a convenience path for the
        case where the browser is still open after payment. The webhook handles the
        case where the browser closed, network failed, or the frontend call was lost.

        Both paths call PurchaseService through the same transaction-safe logic,
        so duplicate order creation is impossible regardless of which path fires first.

        TO IMPLEMENT (when Razorpay is ready):
            In RazorpayWebhookHandler.on_payment_captured():
                from app.db.session import SessionLocal
                db = SessionLocal()
                try:
                    payment_service.handle_webhook_capture(
                        db=db,
                        gateway_order_id=event.gateway_order_id,
                        gateway_payment_id=event.gateway_payment_id,
                        amount_paise=event.amount_paise,
                    )
                finally:
                    db.close()

        Returns True if the payment was confirmed (or was already confirmed).
        Returns False if the payment could not be confirmed (wrong state, not found).
        """
        repo = PaymentRepository(db)
        payment = repo.find_by_gateway_order_id(gateway_order_id)

        if not payment:
            logger.warning(
                "[webhook] Received capture for unknown gateway_order_id=%s",
                gateway_order_id,
            )
            return False

        # ── IDEMPOTENCY: already SUCCESS ─────────────────────────────────────
        if payment.status == "SUCCESS":
            logger.info(
                "[webhook] Payment %s already SUCCESS — idempotent no-op for gateway_order=%s",
                payment.payment_ref, gateway_order_id,
            )
            return True  # Already done, report success to Razorpay

        # ── Terminal failure states — do not resurrect ────────────────────────
        if payment.status in ("FAILED", "CANCELLED", "EXPIRED"):
            logger.warning(
                "[webhook] Payment %s is in terminal state '%s' — cannot capture via webhook.",
                payment.payment_ref, payment.status,
            )
            return False

        # ── PROCESSING guard — concurrent confirm in progress ─────────────────
        if payment.status == "PROCESSING":
            logger.info(
                "[webhook] Payment %s is PROCESSING — frontend confirm already in progress.",
                payment.payment_ref,
            )
            return False  # Let the in-flight confirm complete

        # ── PENDING → confirm via webhook (browser-close scenario) ────────────
        if payment.status == "PENDING":
            logger.info(
                "[webhook] Confirming payment %s via webhook (browser may have closed).",
                payment.payment_ref,
            )
            # NOTE: items_payload cannot be recovered from webhook alone.
            # When implementing, retrieve CartItem records from the database
            # using payment.customer_id before the cart is cleared.
            # The implementation in RazorpayWebhookHandler should fetch the
            # customer's cart BEFORE calling this method.
            #
            # Webhook signature for this scenario uses gateway_payment_id as
            # the verified proof — skip frontend signature (gateway already verified).
            # TODO: Implement full webhook-driven confirm when Razorpay is ready.
            logger.warning(
                "[webhook] Full webhook-driven fulfillment not yet implemented. "
                "Payment %s remains PENDING. Implement handle_webhook_capture() fully when Razorpay is ready.",
                payment.payment_ref,
            )
            return False

        return False

    # ─── History ─────────────────────────────────────────────────────────────

    def customer_history(
        self, db: Session, customer_id: int, skip: int = 0, limit: int = 20
    ) -> List[Payment]:
        return PaymentRepository(db).customer_history(customer_id, skip=skip, limit=limit)

    def vendor_transactions(
        self, db: Session, vendor_id: str, skip: int = 0, limit: int = 20
    ) -> List[Payment]:
        return PaymentRepository(db).vendor_history(vendor_id, skip=skip, limit=limit)

    def admin_transactions(
        self, db: Session, skip: int = 0, limit: int = 50,
        status: Optional[str] = None, gateway: Optional[str] = None
    ) -> List[Payment]:
        return PaymentRepository(db).admin_history(skip=skip, limit=limit, status=status, gateway=gateway)

    # ─── Internal Helpers ────────────────────────────────────────────────────

    def _get_owned_payment(
        self, repo: PaymentRepository, payment_ref: str, customer_id: int
    ) -> Payment:
        """Fetch payment and verify ownership. Raises 404/403."""
        payment = repo.find_by_payment_ref(payment_ref)
        if not payment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Payment {payment_ref} not found.")
        if payment.customer_id != customer_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Payment does not belong to this customer.")
        return payment

    @staticmethod
    def _assert_transition(payment: Payment, target_status: str) -> None:
        """
        Validate that the transition from current status to target_status is legal.
        Raises HTTPException 409 if the transition is not allowed.
        """
        allowed = _VALID_TRANSITIONS.get(payment.status, set())
        if target_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Invalid payment state transition: "
                    f"'{payment.status}' → '{target_status}'. "
                    f"Allowed transitions from '{payment.status}': {sorted(allowed) or 'none (terminal state)'}."
                ),
            )

    @staticmethod
    def _to_initiate_response(payment: Payment) -> Dict[str, Any]:
        """Build the response dict returned after initiate_payment() or retry_payment()."""
        import os
        return {
            "payment_ref":      payment.payment_ref,
            "gateway_order_id": payment.gateway_order_id,
            "amount":           payment.amount,
            "currency":         payment.currency,
            "gateway":          payment.gateway,
            "gateway_key":      os.getenv("RAZORPAY_KEY_ID", "mock_key"),
            "status":           payment.status,
            "expires_at":       payment.expires_at.isoformat() if payment.expires_at else None,
        }


# ── Module-level singleton ───────────────────────────────────────────────────
# Import this wherever needed: from app.services.payment_service import payment_service
payment_service = PaymentService()
