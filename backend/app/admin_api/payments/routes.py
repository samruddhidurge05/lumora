from fastapi import APIRouter, HTTPException, Body
from app.admin_api.payments.services import (
    get_payments_telemetry,
    get_payments_overview,
    get_vendor_payouts,
    get_refund_monitor_list,
    get_transactions_list,
    process_vendor_payout
)

router = APIRouter()

@router.get("/telemetry")
def get_telemetry():
    return get_payments_telemetry()

@router.get("/dashboard")
def get_dashboard():
    return get_payments_telemetry()

@router.get("/overview")
def get_overview():
    return get_payments_overview()

@router.get("/vendor-payouts")
def get_payouts():
    return get_vendor_payouts()

@router.get("/refunds")
def get_refunds():
    return get_refund_monitor_list()

@router.get("/transactions")
def get_transactions():
    return get_transactions_list()

@router.post("/payout")
def post_payout(
    vendor_id: str = Body(..., embed=True),
    amount: float = Body(..., embed=True)
):
    try:
        return process_vendor_payout(vendor_id, amount)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
