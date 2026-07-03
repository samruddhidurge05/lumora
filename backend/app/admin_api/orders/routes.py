from fastapi import APIRouter, HTTPException, Body
from app.admin_api.orders.services import (
    get_orders_list,
    get_order_by_id,
    modify_order_status,
    process_order_refund,
    process_order_dispute
)

router = APIRouter()

@router.get("/")
def get_orders():
    return get_orders_list()

@router.get("/{order_id}")
def get_order(order_id: str):
    try:
        return get_order_by_id(order_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.put("/{order_id}/status")
def put_status(order_id: str, status: str = Body(..., embed=True)):
    try:
        return modify_order_status(order_id, status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{order_id}/refund")
def post_refund(order_id: str):
    try:
        return process_order_refund(order_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{order_id}/dispute")
def post_dispute(order_id: str):
    try:
        return process_order_dispute(order_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
