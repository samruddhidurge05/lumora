from fastapi import APIRouter, Depends, HTTPException, Body
from app.admin_api.payments.services import (
    get_payments_telemetry,
    get_payments_overview,
    get_vendor_payouts,
    get_refund_monitor_list,
    get_transactions_list,
    process_vendor_payout
)
from admin.validators.admin_auth import require_admin_role
from app.models.user import User

router = APIRouter()

@router.get("/telemetry")
def get_telemetry(admin_user: User = Depends(require_admin_role)):
    return get_payments_telemetry()

@router.get("/dashboard")
def get_dashboard(admin_user: User = Depends(require_admin_role)):
    return get_payments_telemetry()

@router.get("/overview")
def get_overview(admin_user: User = Depends(require_admin_role)):
    return get_payments_overview()

@router.get("/vendor-payouts")
def get_payouts(admin_user: User = Depends(require_admin_role)):
    return get_vendor_payouts()

@router.get("/refunds")
def get_refunds(admin_user: User = Depends(require_admin_role)):
    return get_refund_monitor_list()

@router.get("/transactions")
def get_transactions(admin_user: User = Depends(require_admin_role)):
    return get_transactions_list()

@router.post("/payout")
def post_payout(
    vendor_id: str = Body(..., embed=True),
    amount: float = Body(..., embed=True),
    admin_user: User = Depends(require_admin_role)
):
    try:
        return process_vendor_payout(vendor_id, amount)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
