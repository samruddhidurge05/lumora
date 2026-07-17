from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.dependencies import get_current_user_required
from app.models.user import User
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.api.orders.schemas import OrderCreate, OrderResponse
from app.services.purchase_service import PurchaseService

router = APIRouter()


def _create_affiliate_commissions(db: Session, order, affiliate_code: str, buyer_user_id: int) -> None:
    """
    Create AffiliateCommission records in SQLite for each eligible product
    in this order that was referred by the given affiliate_code.

    Idempotency: if a commission already exists for (affiliate_id, order_id)
    we skip creation — safe to call multiple times for the same order.

    Self-referral prevention: if the affiliate IS the buyer, no commission
    is created.

    Business rules:
    - Commission rate: uses product.commission_value if affiliate_enabled,
      falls back to the affiliate profile's default commission_rate.
    - Commission type: "fixed" or "percentage" per product setting.
    - Products with affiliate_enabled=False are skipped.
    """
    from app.models.affiliate import AffiliateProfile, AffiliateCommission
    from app.models.product import Product

    code_upper = affiliate_code.strip().upper()

    # 1. Find the AffiliateProfile by referral_code
    profile = db.query(AffiliateProfile).filter(
        AffiliateProfile.referral_code == code_upper,
        AffiliateProfile.is_active == True,
    ).first()

    if not profile:
        return  # Unknown or inactive affiliate code — skip silently

    # 2. Self-referral prevention
    if profile.user_id == buyer_user_id:
        return

    # 3. Idempotency: if ANY commission already exists for this affiliate+order, abort
    existing = db.query(AffiliateCommission).filter(
        AffiliateCommission.affiliate_id == profile.id,
        AffiliateCommission.order_id == order.id,
    ).first()
    if existing:
        return  # Already processed — prevent duplicates

    # 4. Create one commission record per order item
    total_commission = 0.0
    commissions_created = 0

    for item in order.items:
        from app.utils.db_sync import get_product_by_id
        product = get_product_by_id(db, item.product_id)
        if not product:
            continue

        sale_amount = float(item.price_paid or 0)

        # Calculate commission amount.
        # If the vendor configured a custom commission (affiliate_enabled + value > 0),
        # use that. Otherwise fall back to the affiliate profile's default rate.
        # Note: we always create a commission when a referral code is present —
        # the platform earns commission on every referred sale.
        if (
            product.affiliate_enabled
            and product.commission_value is not None
            and float(product.commission_value) > 0
        ):
            if product.commission_type == "fixed":
                commission_amt = float(product.commission_value)
            else:
                commission_amt = round(sale_amount * float(product.commission_value) / 100, 2)
        else:
            # Use the affiliate profile's platform default commission rate
            commission_amt = round(sale_amount * float(profile.commission_rate) / 100, 2)

        commission_amt = max(0.0, commission_amt)

        commission = AffiliateCommission(
            affiliate_id=profile.id,
            order_id=order.id,
            product_id=item.product_id,
            product_name=product.title or product.name or f"Product {item.product_id}",
            sale_amount=sale_amount,
            commission_amt=commission_amt,
            status="pending",
        )
        db.add(commission)
        total_commission += commission_amt
        commissions_created += 1

    if commissions_created == 0:
        return  # No eligible products in this order

    # 5. Update aggregate totals on the affiliate profile
    profile.total_earnings += total_commission
    profile.total_sales += commissions_created

    db.commit()

@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_new_order(
    order_in: OrderCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    if order_in.total_amount < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Total amount cannot be negative."
        )
    if not order_in.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order must contain at least one item."
        )

    # ── Check Platform Pause State (Admin bypasses it) ─────────────────────
    if current_user.role != "admin":
        is_paused = False
        pause_msg = "Platform is temporarily paused."
        from app.shared.firebase.connection import db as fs_db, firebase_connected
        if firebase_connected and fs_db is not None:
            from admin.firestore.admin_firestore import get_platform_settings
            settings_data = get_platform_settings()
            if settings_data.get("isPlatformPaused", False):
                is_paused = True
                pause_msg = settings_data.get("pauseMessage") or "Platform is temporarily paused."
        else:
            from admin.routes.settings import _local_platform_state
            if _local_platform_state.get("isPlatformPaused", False):
                is_paused = True
                pause_msg = _local_platform_state.get("pauseMessage") or "Platform is temporarily paused."
                
        if is_paused:
            from app.core.exceptions import LumoraException
            raise LumoraException(
                status_code=403,
                code="PLATFORM_PAUSED",
                message=pause_msg
            )

    # 1. Validate items and vendor statuses
    from sqlalchemy import cast, String
    from app.core.exceptions import LumoraException
    
    for item in order_in.items:
        from app.utils.db_sync import get_product_by_id
        prod = get_product_by_id(db, item.product_id)
        if not prod:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product {item.product_id} not found")
            
        # Verify vendor is active
        vendor_user = db.query(User).filter(cast(User.id, String) == prod.vendor_id).first()
        if vendor_user and not vendor_user.is_active:
            raise LumoraException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="VENDOR_DISABLED",
                message=f"Purchasing products from suspended vendor '{prod.seller}' is prohibited."
            )

    if not order_in.payment_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="payment_id is required to create an order."
        )

    from app.repositories.payment_repo import PaymentRepository
    repo = PaymentRepository(db)
    payment = repo.find_by_payment_ref(order_in.payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment record {order_in.payment_id} not found."
        )
    if payment.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Payment record does not belong to you."
        )

    from app.core.config import settings
    items_payload = [{"product_id": i.product_id, "price_paid": i.price_paid} for i in order_in.items]

    # If the payment is PENDING and the gateway is mock, auto-confirm it
    if payment.status == "PENDING" and (payment.gateway == "mock" or settings.PAYMENT_GATEWAY == "mock"):
        from app.services.payment_service import payment_service
        order = payment_service.confirm_payment(
            db=db,
            payment_ref=payment.payment_ref,
            customer_id=current_user.id,
            gateway_payment_id="mock_pay_id",
            gateway_signature="mock_sig",
            items_payload=items_payload,
            payment_method=payment.payment_method or "upi",
            skip_signature_verify=True
        )
    elif payment.status == "SUCCESS":
        # Return existing order linked to the payment
        order = db.query(Order).filter(Order.id == payment.order_id).first()
        if not order:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Order link is missing for this completed payment. Contact support."
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Payment status is '{payment.status}'. Orders can only be completed for successful payments."
        )

    # ── Affiliate Commission Creation ───────────────────────────────────────
    # If this payment was made via an affiliate referral, create commission
    # records in SQLite so the affiliate dashboard reflects real earnings.
    # This is idempotent: we check for existing commissions for this order
    # before creating new ones to prevent duplicates.
    if payment.affiliate_code:
        try:
            _create_affiliate_commissions(db, order, payment.affiliate_code, current_user.id)
        except Exception as aff_err:
            import logging
            _aff_logger = logging.getLogger(__name__)
            _aff_logger.error(
                "Affiliate commission creation failed for order %s (code %s): %s — order preserved",
                order.id, payment.affiliate_code, aff_err,
            )
    # ────────────────────────────────────────────────────────────────────────

    # ── Best-effort Firestore sync ───────────────────────────────────────────
    # Platform Pause policy (Option A / Requirement 13): checkout is blocked
    # when `isPlatformPaused` is true (see check above); only orders that pass
    # that gate reach this point.  We mirror every committed order to Firestore
    # so the admin RC console (Dashboard, Analytics, Orders, Payments) sees it
    # in real time.  SQLite is the canonical source of truth — a sync failure
    # must never roll back the committed order (Requirements 2.1, 2.3, 12.2).
    try:
        from admin.firestore.admin_firestore import sync_order_to_firestore
        sync_order_to_firestore(order)
    except Exception as fs_err:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(
            "Firestore order sync failed for order %s: %s — order preserved in SQLite",
            order.id,
            fs_err,
        )

    # 3. Dynamically set short-lived secure download links for the response
    from app.api.products_router import generate_download_token
    for item in order.items:
        token = generate_download_token(current_user.id, item.product_id)
        item.download_url = f"/api/products/{item.product_id}/download-file?token={token}"

    # Structured log
    from app.utils.logger import log_structured_event
    log_structured_event(
        user_id=current_user.id,
        role=current_user.role,
        action="checkout_completed",
        module="orders",
        status="success",
        details=f"Order ORD-{order.id} verified/created successfully.",
    )

    return order


@router.get("/me", response_model=List[OrderResponse])
def get_my_orders(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    orders = db.query(Order).filter(Order.user_id == current_user.id).order_by(Order.created_at.desc()).all()
    
    # Dynamically inject 15-minute token URLs for the user's vaults/downloads
    from app.api.products_router import generate_download_token
    for o in orders:
        if o.status == "completed":
            for item in o.items:
                token = generate_download_token(current_user.id, item.product_id)
                item.download_url = f"/api/products/{item.product_id}/download-file?token={token}"
                
    return orders

@router.get("/{order_id}", response_model=OrderResponse)
def get_order_by_id(
    order_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    is_owner = (order.user_id == current_user.id)
    is_admin = (current_user.role == "admin")
    is_authorized_vendor = False

    if not is_owner and not is_admin and current_user.role == "vendor":
        user_uid = str(current_user.id)
        # Check if vendor owns any product in this order
        vendor_products = db.query(Product.id).filter(
            (Product.vendor_id == user_uid) | (Product.seller == current_user.name)
        ).all()
        vendor_prod_ids = {p[0] for p in vendor_products}
        order_prod_ids = {item.product_id for item in order.items}
        if vendor_prod_ids.intersection(order_prod_ids):
            is_authorized_vendor = True

    if not (is_owner or is_admin or is_authorized_vendor):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this order")

    # Inject 15-minute secure download token
    if order.status == "completed":
        from app.api.products_router import generate_download_token
        for item in order.items:
            token = generate_download_token(current_user.id, item.product_id)
            item.download_url = f"/api/products/{item.product_id}/download-file?token={token}"

    return order
