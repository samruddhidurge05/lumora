"""
app/payments/gateway/razorpay_gateway.py
------------------------------------------
Razorpay gateway implementation.

STATUS: STUB — methods raise NotImplementedError.
This is intentional. When you receive your Razorpay account:

  Step 1: Set environment variables:
            RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
            RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxx

  Step 2: pip install razorpay (or add to requirements.txt)

  Step 3: Implement the 4 methods below.
          Each method has a comment showing the exact Razorpay SDK call.

  Step 4: Set PAYMENT_GATEWAY=razorpay in your .env

  That is ALL that changes. PaymentService, PurchaseService, routes —
  nothing else needs to be modified.

────────────────────────────────────────────────────────────────────────────────
IMPLEMENTATION GUIDE (fill these in when Razorpay is ready):

  create_order():
    import razorpay
    client = razorpay.Client(auth=(self.key_id, self.key_secret))
    order = client.order.create({
        "amount": int(amount_inr * 100),
        "currency": currency,
        "receipt": receipt,
    })
    return GatewayOrder(
        gateway_order_id=order["id"],
        amount_paise=order["amount"],
        currency=order["currency"],
        receipt=order["receipt"],
        raw=order,
    )

  verify_signature():
    import hmac, hashlib
    msg = f"{gateway_order_id}|{gateway_payment_id}".encode()
    expected = hmac.new(self.key_secret.encode(), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)

  capture_payment():
    client = razorpay.Client(auth=(self.key_id, self.key_secret))
    result = client.payment.capture(gateway_payment_id, amount_paise)
    return GatewayCaptureResult(
        success=(result.get("status") == "captured"),
        gateway_payment_id=gateway_payment_id,
        amount_captured=result.get("amount", 0),
        raw=result,
    )

  refund_payment():
    client = razorpay.Client(auth=(self.key_id, self.key_secret))
    data = {"amount": amount_paise} if amount_paise else {}
    refund = client.payment.refund(gateway_payment_id, data)
    return GatewayRefundResult(
        success=(refund.get("entity") == "refund"),
        refund_id=refund.get("id"),
        amount_refunded=refund.get("amount", 0),
        raw=refund,
    )
────────────────────────────────────────────────────────────────────────────────
"""
import os
from typing import Optional

from app.payments.gateway.interface import (
    PaymentGateway,
    GatewayOrder,
    GatewayCaptureResult,
    GatewayRefundResult,
)


class RazorpayGateway(PaymentGateway):
    """
    Razorpay payment gateway.

    Reads credentials from environment variables:
        RAZORPAY_KEY_ID     — public key  (rzp_test_... or rzp_live_...)
        RAZORPAY_KEY_SECRET — secret key
    """

    GATEWAY_NAME = "razorpay"

    def __init__(self):
        self.key_id     = os.getenv("RAZORPAY_KEY_ID", "")
        self.key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")

        if not self.key_id or not self.key_secret:
            raise EnvironmentError(
                "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set "
                "when PAYMENT_GATEWAY=razorpay"
            )

    # ── 4 Methods to implement ────────────────────────────────────────────────

    def create_order(
        self,
        amount_inr: float,
        currency: str = "INR",
        receipt: str = "",
    ) -> GatewayOrder:
        # TODO: Implement when Razorpay account is available.
        # See module docstring for exact implementation.
        raise NotImplementedError(
            "RazorpayGateway.create_order() is not yet implemented. "
            "See app/payments/gateway/razorpay_gateway.py for instructions."
        )

    def verify_signature(
        self,
        gateway_order_id: str,
        gateway_payment_id: str,
        signature: str,
    ) -> bool:
        # TODO: Implement when Razorpay account is available.
        raise NotImplementedError(
            "RazorpayGateway.verify_signature() is not yet implemented."
        )

    def capture_payment(
        self,
        gateway_payment_id: str,
        amount_paise: Optional[int] = None,
    ) -> GatewayCaptureResult:
        # TODO: Implement when Razorpay account is available.
        raise NotImplementedError(
            "RazorpayGateway.capture_payment() is not yet implemented."
        )

    def refund_payment(
        self,
        gateway_payment_id: str,
        amount_paise: Optional[int] = None,
        reason: str = "Customer request",
    ) -> GatewayRefundResult:
        # TODO: Implement when Razorpay account is available.
        raise NotImplementedError(
            "RazorpayGateway.refund_payment() is not yet implemented."
        )
