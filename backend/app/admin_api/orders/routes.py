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
from app.models.user import User
from app.services.audit_log_service import log_admin_action
from sqlalchemy.orm import Session
from typing import Optional

router = APIRouter()

@router.get("/")
def get_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    admin_user: User = Depends(require_admin_role)
):
    return get_orders_list(page=page, page_size=page_size, status=status)

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
    try:
        result = modify_order_status(order_id, status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    try:
        log_admin_action(
            db=db,
            admin_user_id=admin_user.id,
            action="order_status_change",
            target_type="order",
            target_id=str(order_id),
            metadata={"new_status": status},
        )
    except Exception:
        pass  # Non-blocking — audit log failure never breaks the main operation
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
