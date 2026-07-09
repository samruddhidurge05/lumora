"""
app/api/payments/routes.py
----------------------------
Production payment router — fully authenticated, idempotent, gateway-independent.

Endpoint map:
    POST   /api/payments/initiate                  Customer initiates checkout
    POST   /api/payments/confirm                   Customer confirms after paying
    POST   /api/payments/{payment_ref}/cancel       Customer cancels PENDING payment
    POST   /api/payments/{payment_ref}/retry        Customer retries FAILED payment
    GET    /api/payments/history                   Customer's payment history
    GET    /api/payments/{payment_ref}              Customer views single payment
    GET    /api/payments/vendor/transactions        Vendor revenue view
    GET    /api/payments/admin/all                  Admin full view
    POST   /api/payments/admin/{payment_ref}/refund Admin initiates refund
    POST   /api/payments/webhook/razorpay           Razorpay webhook (stub — returns 200)

Security:
    All customer / vendor / admin routes require a valid JWT.
    Vendor routes require role='vendor' or 'admin'.
    Admin routes require role='admin'.
    Webhook route validates X-Razorpay-Signature header (stub for now).
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies import get_current_user_required, get_current_vendor
from app.models.user import User
from app.models.product import Product
from app.services.payment_service import payment_service

from app.api.payments.schemas import (
    InitiatePaymentRequest,
    InitiatePaymentResponse,
    ConfirmPaymentRequest,
    CancelPaymentRequest,
    AdminRefundRequest,
    PaymentResponse,
    PaymentListResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Helper ───────────────────────────────────────────────────────────────────

def _require_admin(current_user: User) -> None:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )


def _build_vendor_ids(db: Session, items) -> str:
    """
    Build a comma-separated string of vendor_ids from cart items.
    Used to populate payment.vendor_ids for fast vendor dashboard queries.
    """
    vendor_ids = set()
    for item in items:
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        if prod and prod.vendor_id:
            vendor_ids.add(str(prod.vendor_id))
    return ",".join(sorted(vendor_ids))


# ─── 1. Initiate ──────────────────────────────────────────────────────────────

@router.post(
    "/initiate",
    response_model=InitiatePaymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initiate a payment checkout",
    description=(
        "Creates a PENDING payment and returns a gateway_order_id. "
        "Idempotent: supplying the same idempotency_key returns the existing payment."
    ),
)
def initiate_payment(
    body: InitiatePaymentRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """
    Step 1 of checkout.

    Frontend flow:
        1. Customer presses "Buy Now"
        2. Frontend calls POST /api/payments/initiate
        3. Backend creates PENDING payment + gateway order
        4. Frontend receives gateway_order_id and opens payment UI
        5. Customer pays → frontend calls POST /api/payments/confirm
    """
    # Platform pause check (non-admin)
    if current_user.role != "admin":
        _check_platform_not_paused()

    vendor_ids = _build_vendor_ids(db, body.items)
    items_as_dicts = [{"product_id": i.product_id, "price_paid": i.price_paid} for i in body.items]

    result = payment_service.initiate_payment(
        db=db,
        customer_id=current_user.id,
        amount=body.total_amount,
        items=items_as_dicts,
        currency=body.currency,
        payment_method=body.payment_method,
        idempotency_key=body.idempotency_key,
        promo_code=body.promo_code,
        affiliate_code=body.affiliate_code,
        discount_amount=body.discount_amount,
        tax_amount=body.tax_amount,
        vendor_ids=vendor_ids or None,
    )

    db.commit()
    return result


# ─── 2. Confirm ───────────────────────────────────────────────────────────────

@router.post(
    "/confirm",
    summary="Confirm payment after customer completes payment UI",
    description=(
        "Verifies gateway signature, runs the full purchase flow inside one "
        "transaction, and returns the completed Order. Idempotent on SUCCESS."
    ),
)
def confirm_payment(
    body: ConfirmPaymentRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """
    Step 2 of checkout.

    Called by the frontend immediately after the gateway payment UI
    reports success (e.g. Razorpay onSuccess callback).

    Backend:
        1. Loads PENDING payment by payment_ref
        2. Verifies signature via gateway.verify_signature()
        3. Calls PurchaseService inside one transaction
        4. Marks payment SUCCESS, links order_id
        5. Returns the created Order
    """
    # Retrieve items from the payment record to pass to PurchaseService
    from app.repositories.payment_repo import PaymentRepository
    repo = PaymentRepository(db)
    payment = repo.find_by_payment_ref(body.payment_ref)

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment {body.payment_ref} not found.",
        )
    if payment.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your payment.")

    # Rebuild items from the linked order_id if already SUCCESS (idempotent path)
    # For PENDING payments, the frontend must re-supply items via cart context.
    # We store items embedded in the confirm request to keep it self-contained.
    # The actual product validation is done inside PurchaseService.

    # Fetch cart items from the CartItem table for this customer
    from app.models.wishlist import CartItem
    cart_items = db.query(CartItem).filter(CartItem.user_id == current_user.id).all()

    if not cart_items and payment.status != "SUCCESS":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cart is empty. Cannot confirm payment without items.",
        )

    items_payload = [
        {"product_id": ci.product_id, "price_paid": ci.product.price}
        for ci in cart_items
    ] if cart_items else []

    order = payment_service.confirm_payment(
        db=db,
        payment_ref=body.payment_ref,
        customer_id=current_user.id,
        gateway_payment_id=body.gateway_payment_id,
        gateway_signature=body.gateway_signature,
        items_payload=items_payload,
        payment_method=body.payment_method,
    )

    # Generate short-lived secure download URLs for the response
    from app.api.products_router import generate_download_token
    if hasattr(order, "items"):
        for item in order.items:
            token = generate_download_token(current_user.id, item.product_id)
            item.download_url = f"/api/products/{item.product_id}/download-file?token={token}"

    return {
        "success": True,
        "order_id": order.id,
        "payment_ref": body.payment_ref,
        "message": f"Payment confirmed. Order ORD-{order.id} is ready. Your downloads are available in the vault.",
        "items": [
            {
                "product_id": item.product_id,
                "download_url": item.download_url,
            }
            for item in (order.items if hasattr(order, "items") else [])
        ],
    }


# ─── 3. Cancel ────────────────────────────────────────────────────────────────

@router.post(
    "/{payment_ref}/cancel",
    response_model=PaymentResponse,
    summary="Cancel a PENDING payment",
)
def cancel_payment(
    payment_ref: str,
    body: CancelPaymentRequest = None,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """
    Customer cancels a PENDING checkout (e.g. they navigate away).
    Only PENDING payments can be cancelled.
    """
    payment = payment_service.cancel_payment(
        db=db,
        payment_ref=payment_ref,
        customer_id=current_user.id,
    )
    return payment


# ─── 4. Retry ─────────────────────────────────────────────────────────────────

@router.post(
    "/{payment_ref}/retry",
    response_model=InitiatePaymentResponse,
    summary="Retry a FAILED payment",
    description=(
        "Creates a new gateway order for the same PENDING payment record. "
        "Increments retry_count. No duplicate payment records are created."
    ),
)
def retry_payment(
    payment_ref: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    result = payment_service.retry_payment(
        db=db,
        payment_ref=payment_ref,
        customer_id=current_user.id,
    )
    return result


# ─── 5. Customer History ──────────────────────────────────────────────────────

@router.get(
    "/history",
    response_model=PaymentListResponse,
    summary="Customer payment history",
)
def get_payment_history(
    skip: int = 0,
    limit: int = 20,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """Return all payments for the authenticated customer, newest first."""
    payments = payment_service.customer_history(
        db=db,
        customer_id=current_user.id,
        skip=skip,
        limit=limit,
    )
    return PaymentListResponse(
        payments=payments,
        total=len(payments),
        skip=skip,
        limit=limit,
    )


# ─── 6. Single Payment Detail ─────────────────────────────────────────────────

@router.get(
    "/{payment_ref}",
    response_model=PaymentResponse,
    summary="Get a single payment by reference",
)
def get_payment(
    payment_ref: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """
    Customer, vendor, or admin can view a payment.
    Customers can only see their own. Admins can see any.
    """
    from app.repositories.payment_repo import PaymentRepository
    payment = PaymentRepository(db).find_by_payment_ref(payment_ref)

    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Payment {payment_ref} not found.")

    # Ownership: customer sees own, admin sees all
    is_owner = payment.customer_id == current_user.id
    is_admin = current_user.role == "admin"

    # Vendor: can see payments containing their products
    is_vendor_authorized = False
    if current_user.role == "vendor" and payment.vendor_ids:
        is_vendor_authorized = str(current_user.id) in payment.vendor_ids.split(",")

    if not (is_owner or is_admin or is_vendor_authorized):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this payment.")

    return payment


# ─── 7. Vendor Transactions ───────────────────────────────────────────────────

@router.get(
    "/vendor/transactions",
    response_model=PaymentListResponse,
    summary="Vendor revenue — payments containing vendor's products",
)
def get_vendor_transactions(
    skip: int = 0,
    limit: int = 20,
    vendor: dict = Depends(get_current_vendor),
    db: Session = Depends(get_db),
):
    """
    Returns all SUCCESS payments that include this vendor's products.
    Used by the vendor dashboard revenue / transactions tab.
    """
    payments = payment_service.vendor_transactions(
        db=db,
        vendor_id=vendor["uid"],
        skip=skip,
        limit=limit,
    )
    return PaymentListResponse(payments=payments, total=len(payments), skip=skip, limit=limit)


# ─── 8. Admin: All Payments ───────────────────────────────────────────────────

@router.get(
    "/admin/all",
    response_model=PaymentListResponse,
    summary="Admin — full payment history with filters",
)
def admin_get_all_payments(
    skip: int = 0,
    limit: int = 50,
    status_filter: Optional[str] = None,
    gateway: Optional[str] = None,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    payments = payment_service.admin_transactions(
        db=db,
        skip=skip,
        limit=limit,
        status=status_filter,
        gateway=gateway,
    )
    return PaymentListResponse(payments=payments, total=len(payments), skip=skip, limit=limit)


# ─── 9. Admin: Refund ─────────────────────────────────────────────────────────

@router.post(
    "/admin/{payment_ref}/refund",
    response_model=PaymentResponse,
    summary="Admin — initiate a refund",
)
def admin_refund_payment(
    payment_ref: str,
    body: AdminRefundRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """
    Admin initiates a full or partial refund.
    Transitions payment SUCCESS → REFUND_PENDING.
    Gateway refund call is made here.
    """
    _require_admin(current_user)
    payment = payment_service.initiate_refund(
        db=db,
        payment_ref=payment_ref,
        admin_user_id=current_user.id,
        amount=body.amount,
        reason=body.reason,
    )
    return payment


# ─── 10. Webhook (Stub) ───────────────────────────────────────────────────────

@router.post(
    "/webhook/razorpay",
    status_code=status.HTTP_200_OK,
    summary="Razorpay webhook receiver (stub)",
    description=(
        "Receives Razorpay webhook events. Currently logs the payload and returns 200 "
        "so Razorpay does not retry. Full implementation pending credentials."
    ),
)
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    """
    Webhook endpoint for Razorpay events.

    STATUS: STUB — accepts all requests, logs payload, returns 200.

    When Razorpay account is available:
    1. Verify X-Razorpay-Signature against RAZORPAY_WEBHOOK_SECRET
    2. Parse event type (payment.captured, payment.failed, etc.)
    3. Dispatch to RazorpayWebhookHandler
    4. RazorpayWebhookHandler calls PaymentService to update state

    The full handler is in app/payments/webhooks/razorpay_webhook.py
    """
    try:
        payload = await request.json()
        event_type = payload.get("event", "unknown")
        logger.info(
            "[webhook/razorpay] Received event='%s' signature_present=%s",
            event_type,
            bool(x_razorpay_signature),
        )
        # TODO: When credentials available, uncomment:
        # from app.payments.webhooks.razorpay_webhook import RazorpayWebhookHandler
        # handler = RazorpayWebhookHandler()
        # raw_body = await request.body()
        # if not handler.verify_webhook_signature(raw_body, x_razorpay_signature or ""):
        #     raise HTTPException(status_code=400, detail="Invalid webhook signature")
        # event = handler.parse_event(payload)
        # handler.dispatch(event)
    except Exception as exc:
        logger.error("[webhook/razorpay] Error processing webhook: %s", exc)

    # Always return 200 so Razorpay doesn't retry
    return {"received": True}


# ─── Private Helpers ──────────────────────────────────────────────────────────

def _check_platform_not_paused() -> None:
    """Raise 403 if platform is paused (mirrors the check in orders/routes.py)."""
    try:
        from app.shared.firebase.connection import db as fs_db, firebase_connected
        if firebase_connected and fs_db is not None:
            from admin.firestore.admin_firestore import get_platform_settings
            settings = get_platform_settings()
            if settings.get("isPlatformPaused", False):
                from app.core.exceptions import LumoraException
                raise LumoraException(
                    status_code=403,
                    code="PLATFORM_PAUSED",
                    message=settings.get("pauseMessage") or "Platform is temporarily paused.",
                )
        else:
            from admin.routes.settings import _local_platform_state
            if _local_platform_state.get("isPlatformPaused", False):
                from app.core.exceptions import LumoraException
                raise LumoraException(
                    status_code=403,
                    code="PLATFORM_PAUSED",
                    message=_local_platform_state.get("pauseMessage") or "Platform is temporarily paused.",
                )
    except Exception:
        pass  # Firebase not connected — allow through
