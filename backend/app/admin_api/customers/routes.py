from fastapi import APIRouter, HTTPException, Body
from app.admin_api.customers.services import (
    get_customers_list,
    get_customer_by_id,
    modify_customer
)

router = APIRouter()

@router.get("/")
def get_customers():
    return get_customers_list()

@router.get("/{customer_id}")
def get_customer(customer_id: str):
    try:
        return get_customer_by_id(customer_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.put("/{customer_id}")
def put_customer(customer_id: str, data: dict = Body(...)):
    try:
        return modify_customer(customer_id, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
