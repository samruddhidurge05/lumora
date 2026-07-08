"""
app/payments/webhooks/razorpay_webhook.py
-------------------------------------------
Razorpay webhook handler — STUB.

STATUS: Not implemented. All methods raise NotImplementedError.

When Razorpay account is available:

  Step 1: Set RAZORPAY_WEBHOOK_SECRET in .env
          (Configure it in Razorpay Dashboard → Webhooks → Secret)

  Step 2: Implement verify_webhook_signature():
            import hmac, hashlib
            expected = hmac.new(
                self.webhook_secret.encode(),
                payload_bytes,
                hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(expected, signature)

  Step 3: Implement parse_event() to extract event data from Razorpay payload

  Step 4: Implement on_payment_captured() to call PaymentService.confirm_payment()
          for payments still in PENDING state (handles browser-close scenarios)

  Step 5: Wire into POST /api/payments/webhook/razorpay route in routes.py

The route already exists and returns 200. Only the handler needs implementation.
"""
import os
import logging
from typing import Any, Dict

from app.payments.webhooks.interface import WebhookHandler, WebhookEvent

logger = logging.getLogger(__name__)


class RazorpayWebhookHandler(WebhookHandler):
    """
    Razorpay webhook handler stub.

    The route POST /api/payments/webhook/razorpay currently logs the
    payload and returns 200 (so Razorpay doesn't keep retrying).

    Full implementation is gated on receiving Razorpay credentials.
    """

    SUPPORTED_EVENTS = {
        "payment.authorized",
        "payment.captured",
        "payment.failed",
        "payment.refunded",
        "refund.processed",
    }

    def __init__(self):
        self.webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

    def verify_webhook_signature(self, payload_bytes: bytes, signature: str) -> bool:
        # TODO: Implement HMAC-SHA256 verification. See module docstring.
        raise NotImplementedError("Razorpay webhook signature verification not yet implemented.")

    def parse_event(self, payload: Dict[str, Any]) -> WebhookEvent:
        # TODO: Map Razorpay payload structure to WebhookEvent.
        raise NotImplementedError("Razorpay webhook parse_event not yet implemented.")

    def on_payment_authorized(self, event: WebhookEvent) -> None:
        # TODO: Log authorization; no action needed in auto-capture mode.
        raise NotImplementedError

    def on_payment_captured(self, event: WebhookEvent) -> None:
        # TODO: Call PaymentService.confirm_payment() if status is still PENDING.
        raise NotImplementedError

    def on_payment_failed(self, event: WebhookEvent) -> None:
        # TODO: Call PaymentService._set_failed() and send failure notification.
        raise NotImplementedError

    def on_payment_refunded(self, event: WebhookEvent) -> None:
        # TODO: Update payment status to REFUND_PENDING → REFUNDED.
        raise NotImplementedError

    def on_refund_processed(self, event: WebhookEvent) -> None:
        # TODO: Confirm refund completed; send customer notification.
        raise NotImplementedError
