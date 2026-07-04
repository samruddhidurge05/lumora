from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.dependencies import get_current_user_required
from app.models.user import User
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.api.orders.schemas import OrderCreate, OrderResponse

router = APIRouter()

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
        from app.shared.firebase.connection import db, firebase_connected
        if firebase_connected and db is not None:
            from admin.firestore.admin_firestore import get_platform_settings
            settings = get_platform_settings()
            if settings.get("isPlatformPaused", False):
                is_paused = True
                pause_msg = settings.get("pauseMessage") or "Platform is temporarily paused."
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

    # Calculate and store affiliate commissions if referral code exists
    affiliate_profile = None
    if order_in.affiliate_code:
        from app.models.affiliate import AffiliateProfile
        from app.models.user import User as UserModel
        from app.shared.firebase.connection import firebase_connected
        
        code_upper = order_in.affiliate_code.upper()
        # Find profile
        affiliate_profile = db.query(AffiliateProfile).filter(
            AffiliateProfile.referral_code == code_upper
        ).first()
        
        # Verify affiliate is active
        if affiliate_profile:
            if not affiliate_profile.is_active:
                affiliate_profile = None
            else:
                # Check user account status
                aff_user = db.query(UserModel).filter(UserModel.id == affiliate_profile.user_id).first()
                if not aff_user or not aff_user.is_active:
                    affiliate_profile = None
                
                if affiliate_profile and firebase_connected:
                    try:
                        from admin_controls.affiliate.firestore import get_affiliate_status_from_firestore
                        fs_status = get_affiliate_status_from_firestore(str(affiliate_profile.user_id))
                        if fs_status in ("suspended", "disabled", "rejected"):
                            affiliate_profile = None
                    except Exception:
                        pass

    # Validate items and vendors first
    from sqlalchemy import cast, String
    from app.core.exceptions import LumoraException
    
    for item in order_in.items:
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        if not prod:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product {item.product_id} not found")
            
        # Verify vendor is active (if vendor exists as a User)
        vendor_user = db.query(User).filter(cast(User.id, String) == prod.vendor_id).first()
        if vendor_user and not vendor_user.is_active:
            raise LumoraException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="VENDOR_DISABLED",
                message=f"Purchasing products from suspended vendor '{prod.seller}' is prohibited."
            )

    # Create the Order
    order = Order(
        user_id=current_user.id,
        total_amount=order_in.total_amount,
        payment_method=order_in.payment_method,
        payment_id=order_in.payment_id,
        promo_code=order_in.promo_code,
        discount_amount=order_in.discount_amount,
        notes=order_in.notes,
        status="completed" # By default mock completes
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # Create Order Items, calculate commissions, and update stats
    for item in order_in.items:
        if item.price_paid < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Price paid for item {item.product_id} cannot be negative."
            )
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        if not prod:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product {item.product_id} not found")
        
        order_item = OrderItem(
            order_id=order.id,
            product_id=item.product_id,
            price_paid=item.price_paid,
            download_url=prod.file_url or f"/downloads/product-{prod.id}.zip"
        )
        db.add(order_item)
        
        # Calculate commission if referral active
        if affiliate_profile and prod.affiliate_enabled:
            from app.models.affiliate import AffiliateCommission
            
            if prod.commission_type == "percentage":
                rate = prod.commission_value if prod.commission_value is not None else affiliate_profile.commission_rate
                commission_amt = round((item.price_paid * rate) / 100.0, 2)
            elif prod.commission_type == "fixed":
                commission_amt = round(prod.commission_value or 0.0, 2)
            else:
                rate = affiliate_profile.commission_rate or 10.0
                commission_amt = round((item.price_paid * rate) / 100.0, 2)
                
            commission = AffiliateCommission(
                affiliate_id=affiliate_profile.id,
                order_id=order.id,
                product_id=prod.id,
                product_name=prod.title,
                sale_amount=item.price_paid,
                commission_amt=commission_amt,
                status="pending"  # remains pending until order completed
            )
            db.add(commission)
            
            # Increment affiliate metrics
            affiliate_profile.total_sales += 1
            affiliate_profile.total_earnings = round((affiliate_profile.total_earnings or 0.0) + commission_amt, 2)
            db.add(affiliate_profile)

        # Update product downloads count
        prod.downloads += 1
        db.add(prod)

    db.commit()
    db.refresh(order)
    
    # Sync to Firestore mirror
    from admin.firestore.admin_firestore import sync_order_to_firestore
    sync_order_to_firestore(order, db)
    
    return order

@router.get("/me", response_model=List[OrderResponse])
def get_my_orders(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    orders = db.query(Order).filter(Order.user_id == current_user.id).order_by(Order.created_at.desc()).all()
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

    # Resource ownership & Role check:
    # Customer can view own orders, Admin can view all.
    # Vendor can view orders containing products they own.
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

    return order
