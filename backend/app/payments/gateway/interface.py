"""
app/payments/gateway/interface.py
----------------------------------
Abstract gateway contract.

PaymentService ONLY knows these 4 operations.
It never imports Razorpay, Stripe, or any provider directly.

To add a new gateway:
    1. Create a new file, e.g. stripe_gateway.py
    2. Subclass PaymentGateway
    3. Implement all 4 methods
    4. Register in factory.py
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


# ─── Result Dataclasses ───────────────────────────────────────────────────────

@dataclass
class GatewayOrder:
    """
    Returned by create_order().
    gateway_order_id is what the frontend needs to open the payment UI.
    """
    gateway_order_id: str           # e.g. "order_abc123" (Razorpay) or "mock_order_xyz"
    amount_paise: int               # Always in smallest currency unit (paise for INR)
    currency: str                   # "INR"
    receipt: str                    # Internal receipt reference
    raw: dict = field(default_factory=dict)  # Full provider response for debugging


@dataclass
class GatewayCaptureResult:
    """
    Returned by capture_payment().
    success=True means money is confirmed captured.
    """
    success: bool
    gateway_payment_id: str
    amount_captured: int            # In paise
    error: Optional[str] = None     # Set if success=False
    raw: dict = field(default_factory=dict)


@dataclass
class GatewayRefundResult:
    """
    Returned by refund_payment().
    """
    success: bool
    refund_id: Optional[str] = None
    amount_refunded: int = 0        # In paise
    error: Optional[str] = None
    raw: dict = field(default_factory=dict)


# ─── Abstract Gateway Interface ───────────────────────────────────────────────

class PaymentGateway(ABC):
    """
    Abstract base for all payment gateways.

    PaymentService depends on this interface only.
    Concrete implementations: MockGateway, RazorpayGateway, StripeGateway, ...
    """

    @abstractmethod
    def create_order(
        self,
        amount_inr: float,
        currency: str,
        receipt: str,
    ) -> GatewayOrder:
        """
        Create a gateway-side order and return the gateway_order_id.

        The frontend uses gateway_order_id to open the payment UI (Razorpay Checkout).
        For mock mode, returns a fake order ID.
        """
        raise NotImplementedError

    def create_upi_qr(
        self,
        amount_inr: float,
        currency: str,
        receipt: str,
    ) -> dict:
        """
        Optional: Create a UPI QR code session.
        Returns a dict with upi_id, upi_intent_url, and qr_code_data.
        Gateways that don't support it can raise NotImplementedError or return None.
        """
        return {}

    @abstractmethod
    def verify_signature(
        self,
        gateway_order_id: str,
        gateway_payment_id: str,
        signature: str,
    ) -> bool:
        """
        Verify the payment signature sent by the frontend after customer pays.

        SECURITY: This must ALWAYS be done on the backend.
        Never trust frontend payment completion without signature verification.

        Returns True if signature is valid, False otherwise.
        """
        raise NotImplementedError

    @abstractmethod
    def capture_payment(
        self,
        gateway_payment_id: str,
        amount_paise: Optional[int] = None,
    ) -> GatewayCaptureResult:
        """
        Capture (settle) a payment that was authorized but not yet captured.

        Some gateways auto-capture; for those this is a no-op.
        For Razorpay in manual-capture mode, this is required.
        """
        raise NotImplementedError

    @abstractmethod
    def refund_payment(
        self,
        gateway_payment_id: str,
        amount_paise: Optional[int] = None,
        reason: str = "Customer request",
    ) -> GatewayRefundResult:
        """
        Initiate a full or partial refund.

        If amount_paise is None, full refund.
        If amount_paise < original amount, partial refund.
        """
        raise NotImplementedError
