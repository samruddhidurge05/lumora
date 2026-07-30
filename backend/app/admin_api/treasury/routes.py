"""
app/admin_api/treasury/routes.py
----------------------------------
Platform Treasury API — Phase 1 (preserved) + Phase 2 (settlement workflow).

Phase 1 endpoints (unchanged):
    GET  /api/admin/treasury/summary
    GET  /api/admin/treasury/withdrawals
    GET  /api/admin/treasury/withdrawals/{id}
    GET  /api/admin/treasury/ledger

Phase 2 endpoints (new):
    POST /api/admin/treasury/settlement/request
    POST /api/admin/treasury/settlement/{id}/approve
    POST /api/admin/treasury/settlement/{id}/complete
    POST /api/admin/treasury/settlement/{id}/cancel
    GET  /api/admin/treasury/timeline
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, Body, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from admin.validators.admin_auth import require_admin_role
from app.services.treasury_service import (
    get_treasury_summary,
    get_withdrawal_list,
    get_ledger_entries,
    get_treasury_timeline,
    create_settlement_request,
    approve_settlement,
    complete_settlement,
    cancel_settlement,
)
from app.models.platform_withdrawal import PlatformWithdrawal
from app.models.audit_log import AuditLog
from app.admin_api.treasury.webhook import webhook_router

_logger = logging.getLogger("lumora.treasury.routes")

router = APIRouter()
router.include_router(webhook_router, prefix="/webhook", tags=["Treasury Webhooks"])


# ── RBAC helpers ──────────────────────────────────────────────────────────────

def _get_role_level(current_user: User, db: Session) -> str:
    """Return the role_level string for the current admin user."""
    from app.models.admin_role import AdminRole
    role_rec = (
        db.query(AdminRole)
        .filter(AdminRole.user_id == current_user.id, AdminRole.is_active == True)
        .first()
    )
    if role_rec is None:
        return "super_admin"   # legacy admin — full access
    return role_rec.role_level or "admin"


def _require_treasury_read(
    current_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
) -> User:
    from fastapi import HTTPException, status
    role_level = _get_role_level(current_user, db)
    if role_level == "analyst":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Analyst role does not have access to treasury data.",
        )
    return current_user


def _require_treasury_approve(
    current_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
) -> User:
    """Require super_admin or finance to approve/complete settlements."""
    from fastapi import HTTPException, status
    role_level = _get_role_level(current_user, db)
    if role_level not in ("super_admin", "finance"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admin or Finance roles can approve/complete settlements.",
        )
    return current_user


def _require_super_admin(
    current_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
) -> User:
    """Require super_admin for settlement creation and cancellation."""
    from fastapi import HTTPException, status
    role_level = _get_role_level(current_user, db)
    if role_level != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admin can request or cancel settlements.",
        )
    return current_user


# ── Pydantic request schemas ──────────────────────────────────────────────────

class SettlementRequestBody(BaseModel):
    amount:              float   = Field(..., gt=0, description="Settlement amount in INR")
    destination_type:    str     = Field(default="bank_account")
    destination_account: dict    = Field(default_factory=dict)
    notes:               Optional[str] = None


class CompleteSettlementBody(BaseModel):
    transaction_reference: str = Field(..., min_length=1, description="Bank UTR / gateway reference")


class CancelSettlementBody(BaseModel):
    reason: Optional[str] = None


# ── Phase 1: GET /summary ─────────────────────────────────────────────────────

@router.get("/summary")
def treasury_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_treasury_read),
):
    """
    Return all Platform Treasury KPI metrics.
    Available Balance = Revenue − Affiliate Liability − Pending WD − Completed WD.
    Platform Revenue is NEVER modified.
    """
    summary = get_treasury_summary(db)
    return {"success": True, "data": summary}


# ── Phase 1: GET /withdrawals ─────────────────────────────────────────────────

@router.get("/withdrawals")
def list_withdrawals(
    page:      int           = Query(1, ge=1),
    page_size: int           = Query(20, ge=1, le=100),
    status:    Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_treasury_read),
):
    result = get_withdrawal_list(db, page=page, page_size=page_size, status_filter=status)
    return {"success": True, **result}


# ── Phase 1: GET /withdrawals/{id} ────────────────────────────────────────────

@router.get("/withdrawals/{withdrawal_id}")
def get_withdrawal_detail(
    withdrawal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_treasury_read),
):
    from fastapi import HTTPException, status as http_status

    row = db.query(PlatformWithdrawal).filter(PlatformWithdrawal.id == withdrawal_id).first()
    if not row:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Settlement not found.")

    from app.models.user import User as UserModel
    req_user  = db.query(UserModel).filter(UserModel.id == row.requested_by).first()
    appr_user = db.query(UserModel).filter(UserModel.id == row.approved_by).first() if row.approved_by else None
    comp_user = db.query(UserModel).filter(UserModel.id == row.completed_by).first() if getattr(row, "completed_by", None) else None

    dest = {}
    try:
        dest = json.loads(row.destination_account) if row.destination_account else {}
    except Exception:
        pass

    audit_rows = (
        db.query(AuditLog)
        .filter(
            AuditLog.target_type == "platform_withdrawal",
            AuditLog.target_id   == str(withdrawal_id),
        )
        .order_by(AuditLog.created_at.asc())
        .all()
    )
    audit_trail = [
        {
            "action":     a.action,
            "ip_address": a.ip_address,
            "created_at": a.created_at.isoformat() + "Z" if a.created_at else None,
        }
        for a in audit_rows
    ]

    return {
        "success": True,
        "data": {
            "id":                    row.id,
            "withdrawal_number":     row.withdrawal_number,
            "amount":                row.amount,
            "currency":              row.currency,
            "status":                row.status,
            "destination_type":      row.destination_type,
            "destination":           dest,
            "notes":                 row.notes,
            "failure_reason":        row.failure_reason,
            "transaction_reference": row.transaction_reference,
            "requested_by":  {"name": req_user.name, "email": req_user.email} if req_user else None,
            "approved_by":   {"name": appr_user.name, "email": appr_user.email} if appr_user else None,
            "completed_by":  {"name": comp_user.name, "email": comp_user.email} if comp_user else None,
            "requested_at":  row.requested_at.isoformat()  + "Z" if row.requested_at  else None,
            "approved_at":   row.approved_at.isoformat()   + "Z" if row.approved_at   else None,
            "completed_at":  row.completed_at.isoformat()  + "Z" if row.completed_at  else None,
            "created_at":    row.created_at.isoformat()    + "Z" if row.created_at    else None,
            "audit_trail":   audit_trail,
        },
    }


# ── Phase 1: GET /ledger ──────────────────────────────────────────────────────

@router.get("/ledger")
def list_ledger(
    page:        int           = Query(1, ge=1),
    page_size:   int           = Query(50, ge=1, le=200),
    ledger_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_treasury_read),
):
    result = get_ledger_entries(db, page=page, page_size=page_size, ledger_type=ledger_type)
    return {"success": True, **result}


# ── Phase 2: GET /timeline ────────────────────────────────────────────────────

@router.get("/timeline")
def treasury_timeline(
    page:      int = Query(1, ge=1),
    page_size: int = Query(40, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_treasury_read),
):
    """Chronological unified treasury event feed (ledger + audit)."""
    result = get_treasury_timeline(db, page=page, page_size=page_size)
    return {"success": True, **result}


# ── Phase 2: POST /settlement/request ────────────────────────────────────────

@router.post("/settlement/request")
def request_settlement(
    body: SettlementRequestBody,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_super_admin),
):
    """
    Create a new settlement request.
    Only super_admin can initiate. Validates available balance atomically.
    Creates PlatformWithdrawal + ledger entry + audit log.
    """
    ip = request.client.host if request.client else None
    row = create_settlement_request(
        db,
        amount              = body.amount,
        destination_type    = body.destination_type,
        destination_account = body.destination_account,
        notes               = body.notes,
        requested_by        = current_user.id,
        ip_address          = ip,
    )
    updated_summary = get_treasury_summary(db)
    return {
        "success": True,
        "message": f"Settlement {row.withdrawal_number} requested successfully.",
        "settlement": {
            "id":                row.id,
            "withdrawal_number": row.withdrawal_number,
            "amount":            row.amount,
            "status":            row.status,
            "requested_at":      row.requested_at.isoformat() + "Z",
        },
        "updated_summary": updated_summary,
    }


# ── Phase 2: POST /settlement/{id}/approve ────────────────────────────────────

@router.post("/settlement/{withdrawal_id}/approve")
def approve_settlement_endpoint(
    withdrawal_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_treasury_approve),
):
    ip  = request.client.host if request.client else None
    row = approve_settlement(db, withdrawal_id=withdrawal_id, approved_by=current_user.id, ip_address=ip)
    updated_summary = get_treasury_summary(db)
    return {
        "success": True,
        "message": f"Settlement {row.withdrawal_number} approved.",
        "settlement": {"id": row.id, "status": row.status, "approved_at": row.approved_at.isoformat() + "Z"},
        "updated_summary": updated_summary,
    }


# ── Phase 2: POST /settlement/{id}/complete ───────────────────────────────────

@router.post("/settlement/{withdrawal_id}/complete")
def complete_settlement_endpoint(
    withdrawal_id: int,
    body: CompleteSettlementBody,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_treasury_approve),
):
    ip  = request.client.host if request.client else None
    row = complete_settlement(
        db,
        withdrawal_id         = withdrawal_id,
        transaction_reference = body.transaction_reference,
        completed_by          = current_user.id,
        ip_address            = ip,
    )
    updated_summary = get_treasury_summary(db)
    return {
        "success": True,
        "message": f"Settlement {row.withdrawal_number} marked as completed.",
        "settlement": {
            "id":                    row.id,
            "status":                row.status,
            "completed_at":          row.completed_at.isoformat() + "Z",
            "transaction_reference": row.transaction_reference,
        },
        "updated_summary": updated_summary,
    }


# ── Phase 2: POST /settlement/{id}/cancel ────────────────────────────────────

@router.post("/settlement/{withdrawal_id}/cancel")
def cancel_settlement_endpoint(
    withdrawal_id: int,
    body: CancelSettlementBody,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_super_admin),
):
    ip  = request.client.host if request.client else None
    row = cancel_settlement(
        db,
        withdrawal_id  = withdrawal_id,
        reason         = body.reason,
        cancelled_by   = current_user.id,
        ip_address     = ip,
    )
    updated_summary = get_treasury_summary(db)
    return {
        "success": True,
        "message": f"Settlement {row.withdrawal_number} cancelled.",
        "settlement": {"id": row.id, "status": row.status},
        "updated_summary": updated_summary,
    }
