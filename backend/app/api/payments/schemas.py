"""
app/api/payments/schemas.py
-----------------------------
Pydantic request/response schemas for the payment API.

Design decisions:
  - InitiatePaymentRequest carries items so the backend can build
    vendor_ids and validate products before creating the gateway order.
  - ConfirmPaymentRequest uses payment_ref (Lumora ID), never the
    gateway order ID, so the backend is always in control of the lookup.
  - PaymentResponse never exposes gateway_signature (security).
  - idempotency_key is client-generated (UUID4 recommended). Frontend
    stores it in sessionStorage for the checkout session.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


# --- Nested schemas -----------------------------------------------------------

class CartItem(BaseModel):
    product_id: int
    price_paid: float = Field(gt=0, description="Price paid for this item in INR")


# --- Request schemas ----------------------------------------------------------

class InitiatePaymentRequest(BaseModel):
    """
    POST /api/payments/initiate

    Sent when customer presses "Buy Now" / "Pay".
    Backend creates a PENDING payment and calls gateway.create_order().
    Returns gateway_order_id that the frontend uses to open the payment UI.
    """
    items:          List[CartItem]   = Field(..., min_length=1)
    total_amount:   float            = Field(..., gt=0, description="Total in INR")
    currency:       str              = Field(default="INR")
    payment_method: str              = Field(default="upi", description="The selected payment method, e.g. upi_qr")
    idempotency_key: Optional[str]   = Field(
        default=None,
        description="Client-generated UUID for this checkout session. Prevents duplicate payments.",
        max_length=128,
    )
    promo_code:     Optional[str]    = None
    affiliate_code: Optional[str]    = None
    discount_amount: float           = Field(default=0.0, ge=0)
    tax_amount:     float            = Field(default=0.0, ge=0)

    @field_validator("currency")
    @classmethod
    def currency_upper(cls, v: str) -> str:
        return v.upper()


class ConfirmPaymentRequest(BaseModel):
    """
    POST /api/payments/confirm

    Sent after customer completes payment in the gateway UI.
    Backend verifies signature and calls PurchaseService.
    """
    payment_ref:        str   = Field(..., description="Lumora payment reference (LUM-YYYYMMDD-XXXXXXXX)")
    gateway_payment_id: str   = Field(..., description="Gateway's payment ID (e.g. pay_abc123 for Razorpay)")
    gateway_signature:  str   = Field(
        ...,
        description="HMAC signature from gateway. For mock mode, any non-empty string is accepted.",
    )
    payment_method:     str   = Field(default="upi", description="upi | card | netbanking | wallet | upi_qr")


class CancelPaymentRequest(BaseModel):
    """POST /api/payments/{payment_ref}/cancel - optional body for future reason tracking."""
    reason: Optional[str] = None


class AdminRefundRequest(BaseModel):
    """POST /api/payments/{payment_ref}/refund - admin only."""
    amount:  Optional[float] = Field(default=None, gt=0, description="Partial refund amount in INR. Omit for full refund.")
    reason:  str             = Field(default="Admin initiated refund")


# --- Response schemas ---------------------------------------------------------

class InitiatePaymentResponse(BaseModel):
    """Response from POST /api/payments/initiate and POST /api/payments/{ref}/retry."""
    payment_ref:      str
    gateway_order_id: Optional[str]
    amount:           float
    currency:         str
    gateway:          str
    gateway_key:      str            # Razorpay Key ID (for frontend Checkout JS)
    status:           str
    expires_at:       Optional[str]
    # UPI QR Code extension fields
    upi_id:           Optional[str] = None
    upi_intent_url:   Optional[str] = None
    qr_code_data:     Optional[str] = None

    class Config:
        from_attributes = True


class PaymentResponse(BaseModel):
    """Single payment detail. NOTE: gateway_signature is intentionally excluded."""
    id:                 int
    payment_ref:        str
    order_id:           Optional[int]
    customer_id:        int
    gateway:            str
    gateway_order_id:   Optional[str]
    gateway_payment_id: Optional[str]
    currency:           str
    amount:             float
    discount_amount:    float
    tax_amount:         float
    payment_method:     Optional[str]
    status:             str
    failure_reason:     Optional[str]
    retry_count:        int
    promo_code:         Optional[str]
    affiliate_code:     Optional[str]
    created_at:         datetime
    updated_at:         Optional[datetime]
    verified_at:        Optional[datetime]
    completed_at:       Optional[datetime]
    refunded_at:        Optional[datetime]
    expires_at:         Optional[datetime]

    class Config:
        from_attributes = True


class PaymentListResponse(BaseModel):
    payments: List[PaymentResponse]
    total:    int
    skip:     int
    limit:    int
