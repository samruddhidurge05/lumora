import logging

from fastapi import APIRouter, Depends, HTTPException, Body, Query
from app.admin_api.orders.services import (
    get_orders_list,
    get_order_by_id,
    modify_order_status,
    process_order_refund,
    process_order_dispute
)
from admin.validators.admin_auth import require_admin_role
from app.db.session import get_db
from app.models.order import Order
from app.models.user import User
from app.services.audit_log_service import log_admin_action
from sqlalchemy.orm import Session
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/")
def get_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    admin_user: User = Depends(require_admin_role)
):
    try:
        return get_orders_list(page=page, page_size=page_size, status=status)
    except Exception as e:
        logger.error("[admin/orders] get_orders_list raised: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{order_id}")
def get_order(order_id: str, admin_user: User = Depends(require_admin_role)):
    try:
        return get_order_by_id(order_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.put("/{order_id}/status")
def put_status(
    order_id: str,
    status: str = Body(..., embed=True),
    admin_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    # 1. Capture old status from SQLite for audit log
    order = None
    old_status = None
    try:
        order = db.query(Order).filter(Order.id == int(order_id)).first()
        old_status = order.status if order else None
    except (ValueError, TypeError):
        # order_id is non-numeric - Firestore may still accept it; proceed without SQLite lookup
        pass

    # 2. Update Firestore (existing behaviour)
    try:
        result = modify_order_status(order_id, status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 3. Update SQLite to match (bidirectional sync - Req 3.1, 3.2)
    if order is not None:
        order.status = status
        try:
            db.commit()
        except Exception as sqlite_err:
            db.rollback()
            logger.error(
                "SQLite order status update failed after Firestore succeeded "
                "(order %s, new_status %s): %s",
                order_id, status, sqlite_err,
            )
            raise HTTPException(
                status_code=500,
                detail=(
                    "Order status updated in Firestore but SQLite sync failed. "
                    "Inconsistency logged for reconciliation."
                ),
            )

    # 4. Write audit log with old + new status (non-blocking)
    try:
        log_admin_action(
            db=db,
            admin_user_id=admin_user.id,
            action="order_status_change",
            target_type="order",
            target_id=str(order_id),
            metadata={"old_status": old_status, "new_status": status},
        )
    except Exception:
        pass  # Non-blocking - audit log failure never breaks the main operation

    return result

@router.post("/{order_id}/refund")
def post_refund(
    order_id: str,
    admin_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    try:
        result = process_order_refund(order_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    try:
        log_admin_action(
            db=db,
            admin_user_id=admin_user.id,
            action="order_refund",
            target_type="order",
            target_id=str(order_id),
        )
    except Exception:
        pass  # Non-blocking
    return result

@router.post("/{order_id}/dispute")
def post_dispute(
    order_id: str,
    admin_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    try:
        result = process_order_dispute(order_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    try:
        log_admin_action(
            db=db,
            admin_user_id=admin_user.id,
            action="order_dispute",
            target_type="order",
            target_id=str(order_id),
        )
    except Exception:
        pass  # Non-blocking
    return result


@router.get("/{order_id}/download-info")
def get_order_download_info(
    order_id: str,
    admin_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    """
    Admin endpoint: returns a signed download URL for the first product in an order.
    Used by OrdersManagement.jsx to give admins access to order files.
    """
    from app.models.order import Order as OrderModel, OrderItem
    from app.models.product import Product as ProductModel
    from app.api.products_router import generate_download_token

    try:
        oid = int(order_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid order ID.")

    order = db.query(OrderModel).filter(OrderModel.id == oid).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found.")

    items = order.items if hasattr(order, "items") and order.items else []
    if not items:
        raise HTTPException(status_code=404, detail="No items found for this order.")

    first_item = items[0]
    product = db.query(ProductModel).filter(ProductModel.id == first_item.product_id).first()
    if not product or not product.file_url:
        raise HTTPException(status_code=404, detail="Product file not available.")

    token = generate_download_token(order.user_id, first_item.product_id)
    download_url = f"/api/products/{first_item.product_id}/download-file?token={token}"
    file_name = f"{(product.title or 'product').replace(' ', '_')}.zip"

    return {
        "orderId": order_id,
        "productId": str(first_item.product_id),
        "productName": product.title,
        "downloadUrl": download_url,
        "fileName": file_name,
    }
