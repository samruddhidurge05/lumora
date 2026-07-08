"""
app/payments/gateway/factory.py
---------------------------------
Gateway factory — selects the correct gateway based on environment.

Environment variable: PAYMENT_GATEWAY
  "mock"     → MockGateway      (default, no credentials needed)
  "razorpay" → RazorpayGateway  (requires RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET)

Usage (in PaymentService):
    from app.payments.gateway.factory import get_gateway
    gateway = get_gateway()
    order = gateway.create_order(...)
"""
import os
from app.payments.gateway.interface import PaymentGateway


def get_gateway() -> PaymentGateway:
    """
    Return the active payment gateway instance.

    Selection priority:
    1. PAYMENT_GATEWAY env var (explicit)
    2. If RAZORPAY_KEY_ID is set and is not "mock_key" → razorpay
    3. Default → mock

    This function is called once per request inside PaymentService.
    It is intentionally cheap — no heavy initialization on cold start.
    """
    gateway_name = os.getenv("PAYMENT_GATEWAY", "").strip().lower()

    # Explicit env var takes priority
    if gateway_name == "razorpay":
        from app.payments.gateway.razorpay_gateway import RazorpayGateway
        return RazorpayGateway()

    # Auto-detect: if real Razorpay credentials are present, use Razorpay
    razorpay_key = os.getenv("RAZORPAY_KEY_ID", "mock_key")
    if razorpay_key and razorpay_key not in ("mock_key", ""):
        from app.payments.gateway.razorpay_gateway import RazorpayGateway
        return RazorpayGateway()

    # Default: mock (development mode)
    from app.payments.gateway.mock_gateway import MockGateway
    return MockGateway()
