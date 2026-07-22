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
    Enterprise-grade, idempotent affiliate attribution and commission creation.

    Guarantees:
    - Feature flag AFFILIATE_V2_ENABLED check (default: True).
    - Idempotency via DB UNIQUE(order_id) constraint & pre-query check.
    - Code resolution: resolves both base AffiliateProfile.referral_code and custom ReferralLink.referral_code.
    - Product eligibility re-validation: product.affiliate_enabled == True and product.status == 'published'.
    - Affiliate eligibility re-validation: profile.is_active == True and profile.status == 'active'.
    - Self-referral handling: flags commission as 'pending_review' with fraud_flags without blocking purchase.
    - Atomic SQL updates: updates aggregate profile totals safely without in-memory increments.
    - Dual-layer auditability: inserts immutable ReferralAttribution ledger row.
    """
    import os
    import logging
    from datetime import datetime
    from sqlalchemy.exc import IntegrityError
    from app.models.affiliate import AffiliateProfile, AffiliateCommission, ReferralAttribution, ReferralLink, ReferralClick
    from app.models.user import User
    from app.models.audit_log import AuditLog
    from app.utils.db_sync import get_product_by_id

    logger = logging.getLogger(__name__)

    v2_enabled = os.getenv("AFFILIATE_V2_ENABLED", "true").lower() == "true"
    if not v2_enabled:
        logger.info("[_create_affiliate_commissions] AFFILIATE_V2_ENABLED is false; skipping attribution.")
        return

    code_upper = affiliate_code.strip().upper()
    referral_link_id = None
    profile = None

    # 1. Resolve referral code: first try custom ReferralLink, then base AffiliateProfile
    custom_link = db.query(ReferralLink).filter(ReferralLink.referral_code == code_upper, ReferralLink.is_active == True).first()
    if custom_link:
        referral_link_id = custom_link.id
        profile = db.query(AffiliateProfile).filter(AffiliateProfile.id == custom_link.affiliate_id).first()
    else:
        profile = db.query(AffiliateProfile).filter(AffiliateProfile.referral_code == code_upper).first()

    # 2. Re-validate affiliate status
    if not profile or not profile.is_active or (profile.status and profile.status not in ("active", "approved")):
        logger.info(f"[_create_affiliate_commissions] Inactive or missing affiliate profile for code={code_upper}")
        return

    # 3. Permanent Order tagging
    order.affiliate_id = profile.id
    order.referral_link_id = referral_link_id
    order.referral_code_used = code_upper

    # 4. Idempotency check: if commission already exists for order_id, abort safely
    existing_comm = db.query(AffiliateCommission).filter(AffiliateCommission.order_id == order.id).first()
    if existing_comm:
        logger.info(f"[_create_affiliate_commissions] Commission already exists for order_id={order.id}")
        return

    # 5. Fraud Detection: Self-referral check
    is_self_referral = (profile.user_id == buyer_user_id)
    fraud_flags = {"self_referral": True} if is_self_referral else None
    comm_initial_status = "pending_review" if is_self_referral else "pending"

    # 6. Calculate commission per eligible product item
    total_commission = 0.0
    total_sale_amount = 0.0
    commissions_created = 0
    buyer_user = db.query(User).filter(User.id == buyer_user_id).first()
    customer_name = buyer_user.name if buyer_user else "Customer"
    customer_email = buyer_user.email if buyer_user else ""

    for item in order.items:
        product = get_product_by_id(db, item.product_id)
        if not product:
            continue

        # Product eligibility check
        is_published = (getattr(product, "status", "published") == "published")
        is_affiliate_enabled = getattr(product, "affiliate_enabled", True)
        if not is_published or not is_affiliate_enabled:
            continue

        sale_amount = float(item.price_paid or 0)
        total_sale_amount += sale_amount

        # Custom vs Default commission calculation
        comm_value = getattr(product, "commission_value", None)
        comm_mode = getattr(product, "commission_mode", None) or getattr(product, "commission_type", None) or "percentage"

        if comm_value is not None and float(comm_value) > 0:
            if comm_mode == "fixed":
                commission_amt = float(comm_value)
            else:
                commission_amt = round(sale_amount * float(comm_value) / 100.0, 2)
        else:
            commission_amt = round(sale_amount * float(profile.commission_rate or 20.0) / 100.0, 2)

        commission_amt = max(0.0, commission_amt)

        try:
            # 7. Insert ReferralAttribution Immutable Ledger
            attribution = ReferralAttribution(
                order_id=order.id,
                customer_id=buyer_user_id,
                affiliate_id=profile.id,
                affiliate_code=code_upper,
                referral_link_id=referral_link_id,
                product_id=item.product_id,
                status="pending_review" if is_self_referral else "attributed",
                fraud_flags=fraud_flags,
                created_at=datetime.utcnow()
            )
            db.add(attribution)
            db.flush()

            # 8. Create AffiliateCommission
            commission = AffiliateCommission(
                affiliate_id=profile.id,
                order_id=order.id,
                product_id=item.product_id,
                product_name=product.title or getattr(product, "name", f"Product {item.product_id}"),
                sale_amount=sale_amount,
                commission_amt=commission_amt,
                commission_type=comm_mode,
                commission_rate=float(comm_value or profile.commission_rate or 20.0),
                customer_name=customer_name,
                customer_email=customer_email,
                commission_status=comm_initial_status,
                status=comm_initial_status,
                referral_attribution_id=attribution.id,
                referral_link_id=referral_link_id,
                created_at=datetime.utcnow()
            )
            db.add(commission)
            db.flush()

            attribution.commission_id = commission.id
            total_commission += commission_amt
            commissions_created += 1

            # Update legacy AffiliateReferral record if present
            try:
                from app.models.affiliate import AffiliateReferral
                referral = db.query(AffiliateReferral).filter(
                    AffiliateReferral.affiliate_id == profile.id,
                    AffiliateReferral.product_id == item.product_id,
                    (
                        (AffiliateReferral.customer_id == buyer_user_id) |
                        (AffiliateReferral.referral_code == code_upper)
                    )
                ).order_by(AffiliateReferral.created_at.desc()).first()

                if referral:
                    referral.customer_id = buyer_user_id
                    referral.order_id = order.id
                    referral.status = "PURCHASED"
                    referral.converted_at = datetime.utcnow()
            except Exception as ref_err:
                logger.warning(f"[_create_affiliate_commissions] Warning updating AffiliateReferral: {ref_err}")

            # 9. Atomic SQL Aggregate Update for Profile metrics
            db.query(AffiliateProfile).filter(AffiliateProfile.id == profile.id).update({
                AffiliateProfile.total_earnings: AffiliateProfile.total_earnings + commission_amt,
                AffiliateProfile.total_sales: AffiliateProfile.total_sales + 1,
                AffiliateProfile.pending_earnings: AffiliateProfile.pending_earnings + commission_amt,
            }, synchronize_session=False)

            # 10. Audit Logging
            db.add(AuditLog(
                admin_user_id=1,
                action="Commission Created",
                target_type="affiliate_commission",
                target_id=str(commission.id),
                metadata_json=f'{{"order_id": {order.id}, "amount": {commission_amt}, "status": "{comm_initial_status}"}}'
            ))

            db.commit()
            logger.info(f"[_create_affiliate_commissions] Created commission #{commission.id} for order #{order.id}")
            break # 1 commission per order

        except IntegrityError as ie:
            db.rollback()
            logger.warning(f"[_create_affiliate_commissions] IntegrityError caught (duplicate order_id={order.id}): {ie}")
            return
        except Exception as ex:
            db.rollback()
            logger.error(f"[_create_affiliate_commissions] Failed to create commission: {ex}")
            raise

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

    # -- Check Platform Pause State (Admin bypasses it) ---------------------
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

    # -- Affiliate Commission Creation ---------------------------------------
    aff_code = payment.affiliate_code
    if not aff_code:
        try:
            from app.models.affiliate import AffiliateReferral
            for item in order.items:
                ref = db.query(AffiliateReferral).filter(
                    AffiliateReferral.customer_id == current_user.id,
                    AffiliateReferral.product_id == item.product_id
                ).order_by(AffiliateReferral.created_at.desc()).first()
                if ref:
                    aff_code = ref.referral_code
                    break
        except Exception as ref_lookup_err:
            print(f"[ReferralLookup] Warning: Failed to query persistent referral for user {current_user.id}: {ref_lookup_err}")

    if aff_code:
        try:
            _create_affiliate_commissions(db, order, aff_code, current_user.id)
        except Exception as aff_err:
            import logging
            _aff_logger = logging.getLogger(__name__)
            _aff_logger.error(
                "Affiliate commission creation failed for order %s (code %s): %s - order preserved",
                order.id, aff_code, aff_err,
            )
    # ------------------------------------------------------------------------

    # -- Best-effort Firestore sync -------------------------------------------
    # Platform Pause policy (Option A / Requirement 13): checkout is blocked
    # when `isPlatformPaused` is true (see check above); only orders that pass
    # that gate reach this point.  We mirror every committed order to Firestore
    # so the admin RC console (Dashboard, Analytics, Orders, Payments) sees it
    # in real time.  SQLite is the canonical source of truth - a sync failure
    # must never roll back the committed order (Requirements 2.1, 2.3, 12.2).
    try:
        from admin.firestore.admin_firestore import sync_order_to_firestore
        sync_order_to_firestore(order)
    except Exception as fs_err:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(
            "Firestore order sync failed for order %s: %s - order preserved in SQLite",
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
