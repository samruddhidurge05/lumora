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

    # 1. Validate items and vendor statuses
    from sqlalchemy import cast, String
    from app.core.exceptions import LumoraException
    
    for item in order_in.items:
        prod = db.query(Product).filter(Product.id == item.product_id).first()
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

    # 2. Delegate purchase execution to PurchaseService (Atomically processes pay/orders/commission/notifications)
    items_payload = [{"product_id": i.product_id, "price_paid": i.price_paid} for i in order_in.items]
    try:
        order = PurchaseService.process_purchase(
            db=db,
            user_id=current_user.id,
            items_payload=items_payload,
            total_amount=order_in.total_amount,
            payment_method=order_in.payment_method or "upi",
            payment_id=order_in.payment_id,
            razorpay_order_id=order_in.razorpay_order_id,
            razorpay_signature=order_in.razorpay_signature,
            promo_code=order_in.promo_code,
            discount_amount=order_in.discount_amount,
            affiliate_code=order_in.affiliate_code,
            notes=order_in.notes
        )
        # Commit SQLite transaction
        db.commit()
    except Exception as e:
        db.rollback()
        raise e

    # 3. Dynamically set short-lived secure download links for the response
    from app.api.products_router import generate_download_token
    for item in order.items:
        token = generate_download_token(current_user.id, item.product_id)
        item.download_url = f"/api/products/{item.product_id}/download-file?token={token}"

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
