from sqlalchemy.orm import Session
from sqlalchemy import or_, func, cast as sql_cast, String
from fastapi import HTTPException, status
from typing import Optional, Tuple

from app.models.order import Order, OrderItem
from app.models.refund_request import RefundRequest

def get_product_refund_status(
    db: Session,
    user_id: int,
    product_id: int
) -> Tuple[str, bool, Optional[str]]:
    """
    Returns (refund_status, can_download, message) for a user and product.

    refund_status values:
    - 'NONE': No refund request exists
    - 'REQUESTED': Refund requested / pending / under review
    - 'APPROVED': Refund approved / refunded
    - 'REJECTED': Refund request rejected by admin
    - 'CANCELLED': Refund request cancelled by user
    """
    # Find orders for this user that contain this product
    orders_items = db.query(OrderItem, Order).join(
        Order, OrderItem.order_id == Order.id
    ).filter(
        or_(Order.user_id == user_id, sql_cast(Order.user_id, String) == str(user_id)),
        or_(OrderItem.product_id == product_id, sql_cast(OrderItem.product_id, String) == str(product_id)),
        func.lower(Order.status).in_(["completed", "paid", "processing", "success", "refunded"])
    ).all()

    if not orders_items:
        return ("NONE", True, None)

    order_ids = [order.id for _, order in orders_items]

    # Check if any associated order has status 'refunded'
    for _, order in orders_items:
        if (order.status or "").lower() == "refunded":
            return ("APPROVED", False, "Download disabled for refunded product.")

    # Query refund requests for these orders
    refund_requests = db.query(RefundRequest).filter(
        RefundRequest.order_id.in_(order_ids)
    ).order_by(RefundRequest.created_at.desc()).all()

    if not refund_requests:
        return ("NONE", True, None)

    # Priority 1: if any request is APPROVED/REFUNDED -> permanently disabled
    for rr in refund_requests:
        status_upper = (rr.status or "").upper()
        if status_upper in ["APPROVED", "REFUNDED"]:
            return ("APPROVED", False, "Download disabled for refunded product.")

    # Priority 2: if any request is PENDING/REQUESTED/UNDER_REVIEW/PROCESSING -> disabled under review
    for rr in refund_requests:
        status_upper = (rr.status or "").upper()
        if status_upper in ["PENDING", "REQUESTED", "UNDER_REVIEW", "PROCESSING"]:
            return ("REQUESTED", False, "Download disabled while refund request is under review.")

    # Priority 3: Check latest decision (REJECTED or CANCELLED)
    latest_status = (refund_requests[0].status or "").upper()
    if latest_status == "REJECTED":
        return ("REJECTED", True, None)
    if latest_status == "CANCELLED":
        return ("CANCELLED", True, None)

    return ("NONE", True, None)


def check_download_permission(
    db: Session,
    user_id: int,
    product_id: int,
    is_owner: bool = False,
    is_admin: bool = False
) -> None:
    """
    Strict authorization check for download endpoints.
    Raises HTTP 403 if download permission is not granted due to refund request or lack of purchase.
    """
    if is_owner or is_admin:
        return

    # Check purchase ownership first
    owned = db.query(OrderItem).join(Order).filter(
        or_(Order.user_id == user_id, sql_cast(Order.user_id, String) == str(user_id)),
        or_(OrderItem.product_id == product_id, sql_cast(OrderItem.product_id, String) == str(product_id)),
        func.lower(Order.status).in_(["completed", "paid", "processing", "success", "refunded"])
    ).first()

    if not owned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must purchase this product to download it."
        )

    # Check refund status lock
    refund_status, can_download, msg = get_product_refund_status(db, user_id, product_id)
    if not can_download:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=msg or "Download disabled while refund request is under review."
        )
