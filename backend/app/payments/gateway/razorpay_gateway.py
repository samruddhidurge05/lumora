"""
app/payments/gateway/razorpay_gateway.py
------------------------------------------
Razorpay gateway implementation — PRODUCTION READY.

To activate:
    1. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env
    2. Change PAYMENT_GATEWAY=razorpay in backend/.env
    3. Restart the backend server

The factory (factory.py) will automatically switch from MockGateway to
RazorpayGateway when PAYMENT_GATEWAY=razorpay or when real credentials
are detected. No other code changes are needed.
"""
import logging
import os
from typing import Optional

from app.payments.gateway.interface import (
    PaymentGateway,
    GatewayOrder,
    GatewayCaptureResult,
    GatewayRefundResult,
)

logger = logging.getLogger(__name__)


class RazorpayGateway(PaymentGateway):
    """
    Production Razorpay payment gateway.

    Reads credentials from environment variables:
        RAZORPAY_KEY_ID     — public key  (rzp_test_... or rzp_live_...)
        RAZORPAY_KEY_SECRET — secret key
        PAYMENT_CURRENCY    — currency code (default: INR)
    """

    GATEWAY_NAME = "razorpay"

    def __init__(self):
        self.key_id = os.getenv("RAZORPAY_KEY_ID", "")
        self.key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
        self.currency = os.getenv("PAYMENT_CURRENCY", "INR")

        if not self.key_id or not self.key_secret:
            raise EnvironmentError(
                "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set "
                "when PAYMENT_GATEWAY=razorpay"
            )

        # Lazy import — razorpay package only required when live gateway is active
        try:
            import razorpay as _rzp_sdk
            self._client = _rzp_sdk.Client(auth=(self.key_id, self.key_secret))
        except ImportError as exc:
            raise ImportError(
                "razorpay package is not installed. "
                "Run: pip install razorpay>=1.4.1"
            ) from exc

        logger.info(
            "[RazorpayGateway] Initialized with key_id=%s... currency=%s",
            self.key_id[:12],
            self.currency,
        )

    # ── 1. Create Order ───────────────────────────────────────────────────────

    def create_order(
        self,
        amount_inr: float,
        currency: str = "INR",
        receipt: str = "",
    ) -> GatewayOrder:
        """
        Create a Razorpay order and return the gateway_order_id.

        Args:
            amount_inr: Total amount in INR (e.g. 999.0 for ₹999)
            currency:   Currency code — always INR for Indian payments
            receipt:    Internal receipt ID for audit trail

        Returns:
            GatewayOrder with gateway_order_id used by the frontend
            to open the Razorpay Checkout popup.
        """
        # Razorpay requires amount in paise (₹1 = 100 paise)
        amount_paise = int(round(amount_inr * 100))

        try:
            raw_order = self._client.order.create(data={
                "amount": amount_paise,
                "currency": currency or self.currency,
                "receipt": receipt or f"lumora_{amount_paise}",
                "payment_capture": 1,   # Auto-capture on authorization
            })
            logger.info(
                "[RazorpayGateway] Order created: order_id=%s amount_paise=%d",
                raw_order["id"],
                amount_paise,
            )
            return GatewayOrder(
                gateway_order_id=raw_order["id"],
                amount_paise=raw_order["amount"],
                currency=raw_order["currency"],
                receipt=raw_order.get("receipt", receipt),
                raw=dict(raw_order),
            )
        except Exception as exc:
            logger.error("[RazorpayGateway] create_order failed: %s", exc)
            raise

    # ── 2. Verify Signature ───────────────────────────────────────────────────

    def verify_signature(
        self,
        gateway_order_id: str,
        gateway_payment_id: str,
        signature: str,
    ) -> bool:
        """
        Verify the HMAC-SHA256 signature sent by the Razorpay frontend SDK.

        SECURITY: This is the critical fraud-prevention step.
        Never skip this check. Never trust frontend payment IDs without it.

        Razorpay signs: "{order_id}|{payment_id}" with RAZORPAY_KEY_SECRET
        using HMAC-SHA256 and hex-encodes the result.
        """
        if not gateway_order_id or not gateway_payment_id or not signature:
            logger.warning(
                "[RazorpayGateway] verify_signature called with missing params: "
                "order_id=%r payment_id=%r signature_present=%s",
                gateway_order_id,
                gateway_payment_id,
                bool(signature),
            )
            return False

        try:
            # Use the official SDK utility — it does the HMAC internally
            params = {
                "razorpay_order_id": gateway_order_id,
                "razorpay_payment_id": gateway_payment_id,
                "razorpay_signature": signature,
            }
            self._client.utility.verify_payment_signature(params)
            logger.info(
                "[RazorpayGateway] Signature verified OK for payment_id=%s",
                gateway_payment_id,
            )
            return True
        except Exception as exc:
            logger.warning(
                "[RazorpayGateway] Signature verification FAILED for "
                "order_id=%s payment_id=%s: %s",
                gateway_order_id,
                gateway_payment_id,
                exc,
            )
            return False

    # ── 3. Capture Payment ────────────────────────────────────────────────────

    def capture_payment(
        self,
        gateway_payment_id: str,
        amount_paise: Optional[int] = None,
    ) -> GatewayCaptureResult:
        """
        Capture an authorized payment.

        Note: With payment_capture=1 in create_order(), Razorpay
        auto-captures on authorization. This method is provided for
        completeness and for manual-capture configurations.
        """
        try:
            payment = self._client.payment.fetch(gateway_payment_id)
            current_status = payment.get("status", "")

            # If already captured, return success immediately (idempotent)
            if current_status == "captured":
                logger.info(
                    "[RazorpayGateway] Payment %s already captured — idempotent return",
                    gateway_payment_id,
                )
                return GatewayCaptureResult(
                    success=True,
                    gateway_payment_id=gateway_payment_id,
                    amount_captured=payment.get("amount", 0),
                    raw=dict(payment),
                )

            capture_amount = amount_paise or payment.get("amount", 0)
            # Razorpay SDK capture() expects: capture(payment_id, amount, data={})
            # where amount is an integer (paise) passed as positional arg
            result = self._client.payment.capture(gateway_payment_id, capture_amount, {"currency": "INR"})
            success = result.get("status") == "captured"

            if not success:
                logger.warning(
                    "[RazorpayGateway] Capture did not return 'captured' status: %s",
                    result,
                )

            return GatewayCaptureResult(
                success=success,
                gateway_payment_id=gateway_payment_id,
                amount_captured=result.get("amount", 0),
                error=None if success else f"Unexpected status: {result.get('status')}",
                raw=dict(result),
            )
        except Exception as exc:
            logger.error(
                "[RazorpayGateway] capture_payment failed for %s: %s",
                gateway_payment_id,
                exc,
            )
            return GatewayCaptureResult(
                success=False,
                gateway_payment_id=gateway_payment_id,
                amount_captured=0,
                error=str(exc),
                raw={"error": str(exc)},
            )

    # ── 4. Refund Payment ─────────────────────────────────────────────────────

    def refund_payment(
        self,
        gateway_payment_id: str,
        amount_paise: Optional[int] = None,
        reason: str = "Customer request",
    ) -> GatewayRefundResult:
        """
        Initiate a full or partial refund.

        If amount_paise is None → full refund.
        If amount_paise < original amount → partial refund.
        """
        try:
            # Razorpay SDK: refund is accessed via payment.refund(payment_id, data)
            refund_payload: dict = {}
            if amount_paise is not None:
                refund_payload["amount"] = amount_paise
            if reason:
                refund_payload["notes"] = {"reason": reason}

            refund = self._client.payment.refund(gateway_payment_id, refund_payload)
            success = refund.get("entity") == "refund"

            logger.info(
                "[RazorpayGateway] Refund %s for payment %s amount_paise=%s",
                "SUCCESS" if success else "FAILED",
                gateway_payment_id,
                amount_paise or "full",
            )

            return GatewayRefundResult(
                success=success,
                refund_id=refund.get("id"),
                amount_refunded=refund.get("amount", 0),
                error=None if success else f"Unexpected entity: {refund.get('entity')}",
                raw=dict(refund),
            )
        except Exception as exc:
            logger.error(
                "[RazorpayGateway] refund_payment failed for %s: %s",
                gateway_payment_id,
                exc,
            )
            return GatewayRefundResult(
                success=False,
                refund_id=None,
                amount_refunded=0,
                error=str(exc),
                raw={"error": str(exc)},
            )

    # ── 5. UPI QR (optional override) ─────────────────────────────────────────

    def create_upi_qr(
        self,
        amount_inr: float,
        currency: str = "INR",
        receipt: str = "",
    ) -> dict:
        """
        Create a Razorpay UPI QR code for the UPI QR payment method.

        Returns a dict compatible with the UpiQrDisplay frontend component.
        Falls back gracefully if Razorpay QR is not configured.
        """
        try:
            # Create a standard order first and use the order ID as the QR reference
            order = self.create_order(amount_inr, currency, receipt)
            # Return UPI QR intent — Razorpay order link is used for QR generation
            return {
                "gateway_order_id": order.gateway_order_id,
                "amount_paise": order.amount_paise,
                "currency": order.currency,
                "gateway_key": self.key_id,
            }
        except Exception as exc:
            logger.error("[RazorpayGateway] create_upi_qr failed: %s", exc)
            return {}
