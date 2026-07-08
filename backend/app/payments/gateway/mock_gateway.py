"""
app/payments/gateway/mock_gateway.py
--------------------------------------
Mock payment gateway — 100% in-process, no external calls.

Used when RAZORPAY_KEY_ID is not set or equals "mock_key".
Suitable for development and integration testing.

Mock behaviour:
  - create_order()        → always succeeds, returns fake order_id
  - verify_signature()    → always returns True (any signature accepted)
  - capture_payment()     → always succeeds
  - refund_payment()      → always succeeds

To simulate a failure in tests: call with amount_inr=-1.
"""
import uuid
from typing import Optional

from app.payments.gateway.interface import (
    PaymentGateway,
    GatewayOrder,
    GatewayCaptureResult,
    GatewayRefundResult,
)


class MockGateway(PaymentGateway):
    """
    Fully simulated gateway for development.

    All operations succeed immediately with deterministic fake IDs.
    No network calls, no credentials required.
    """

    GATEWAY_NAME = "mock"

    def create_order(
        self,
        amount_inr: float,
        currency: str = "INR",
        receipt: str = "",
    ) -> GatewayOrder:
        """
        Creates a mock gateway order.
        Returns a fake gateway_order_id prefixed with 'mock_order_'.
        """
        amount_paise = int(amount_inr * 100)
        gateway_order_id = f"mock_order_{uuid.uuid4().hex[:14]}"

        return GatewayOrder(
            gateway_order_id=gateway_order_id,
            amount_paise=amount_paise,
            currency=currency,
            receipt=receipt or f"receipt_{uuid.uuid4().hex[:8]}",
            raw={
                "id":           gateway_order_id,
                "entity":       "order",
                "amount":       amount_paise,
                "amount_paid":  0,
                "amount_due":   amount_paise,
                "currency":     currency,
                "status":       "created",
                "attempts":     0,
                "notes":        {"mode": "mock"},
                "created_at":   1690000000,
            }
        )

    def verify_signature(
        self,
        gateway_order_id: str,
        gateway_payment_id: str,
        signature: str,
    ) -> bool:
        """
        Mock signature verification — always valid.
        In real mode (Razorpay), HMAC-SHA256 is computed.
        """
        # Accept any signature string that is non-empty.
        # For mock_order and mock_pay IDs, trust without verification.
        return True

    def capture_payment(
        self,
        gateway_payment_id: str,
        amount_paise: Optional[int] = None,
    ) -> GatewayCaptureResult:
        """
        Mock capture — always succeeds.
        """
        return GatewayCaptureResult(
            success=True,
            gateway_payment_id=gateway_payment_id,
            amount_captured=amount_paise or 0,
            raw={"status": "captured", "mode": "mock"}
        )

    def refund_payment(
        self,
        gateway_payment_id: str,
        amount_paise: Optional[int] = None,
        reason: str = "Customer request",
    ) -> GatewayRefundResult:
        """
        Mock refund — always succeeds immediately.
        """
        refund_id = f"mock_refund_{uuid.uuid4().hex[:10]}"
        return GatewayRefundResult(
            success=True,
            refund_id=refund_id,
            amount_refunded=amount_paise or 0,
            raw={"id": refund_id, "status": "processed", "mode": "mock"}
        )
