"""
app/payments/webhooks/interface.py
------------------------------------
Abstract webhook handler contract.

When Razorpay sends an event (payment.captured, payment.failed, etc.)
to your webhook endpoint, the concrete handler processes it.

Webhook events supported by Razorpay (and prepared here):
    payment.authorized      — Customer authorized payment (not yet captured)
    payment.captured        — Payment captured (money received)
    payment.failed          — Payment failed
    payment.refunded        — Full refund processed
    refund.processed        — Refund confirmed by bank

Implementation note:
    Webhooks are an alternative confirmation path to verify_signature().
    They are important because:
    - Customer closes browser before confirm() is called
    - Network failure between frontend and backend
    - Razorpay captures payment after timeout

    When implemented, the webhook handler should call PaymentService.confirm_payment()
    if the payment is still in PENDING state.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class WebhookEvent:
    """
    Normalized webhook event payload.
    Provider-specific raw payload is in .raw.
    """
    event_type:     str             # e.g. "payment.captured"
    gateway:        str             # e.g. "razorpay"
    gateway_payment_id: Optional[str] = None
    gateway_order_id:   Optional[str] = None
    amount_paise:   int = 0
    currency:       str = "INR"
    raw:            Dict[str, Any] = field(default_factory=dict)


class WebhookHandler(ABC):
    """
    Abstract webhook handler.

    Concrete implementations:
        RazorpayWebhookHandler — reads X-Razorpay-Signature header, verifies, dispatches
    """

    @abstractmethod
    def verify_webhook_signature(self, payload_bytes: bytes, signature: str) -> bool:
        """
        Verify the webhook came from the gateway (not a spoofed request).
        Razorpay uses HMAC-SHA256 of raw payload bytes with WEBHOOK_SECRET.
        """
        raise NotImplementedError

    @abstractmethod
    def parse_event(self, payload: Dict[str, Any]) -> WebhookEvent:
        """
        Parse raw provider payload into a normalized WebhookEvent.
        """
        raise NotImplementedError

    @abstractmethod
    def on_payment_authorized(self, event: WebhookEvent) -> None:
        """Payment authorized but not yet captured."""
        raise NotImplementedError

    @abstractmethod
    def on_payment_captured(self, event: WebhookEvent) -> None:
        """Payment captured — money received. Trigger order fulfillment if not already done."""
        raise NotImplementedError

    @abstractmethod
    def on_payment_failed(self, event: WebhookEvent) -> None:
        """Payment failed. Update payment status to FAILED."""
        raise NotImplementedError

    @abstractmethod
    def on_payment_refunded(self, event: WebhookEvent) -> None:
        """Full refund initiated."""
        raise NotImplementedError

    @abstractmethod
    def on_refund_processed(self, event: WebhookEvent) -> None:
        """Refund confirmed by bank."""
        raise NotImplementedError
