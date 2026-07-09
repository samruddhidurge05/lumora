from fastapi import APIRouter, Depends, HTTPException, Body
from app.admin_api.customers.services import (
    get_customers_list,
    get_customer_by_id,
    modify_customer
)
from admin.validators.admin_auth import require_admin_role
from app.models.user import User

router = APIRouter()

@router.get("/")
def get_customers(admin_user: User = Depends(require_admin_role)):
    return get_customers_list()

@router.get("/{customer_id}")
def get_customer(customer_id: str, admin_user: User = Depends(require_admin_role)):
    try:
        return get_customer_by_id(customer_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.put("/{customer_id}")
def put_customer(
    customer_id: str,
    data: dict = Body(...),
    admin_user: User = Depends(require_admin_role)
):
    try:
        return modify_customer(customer_id, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
