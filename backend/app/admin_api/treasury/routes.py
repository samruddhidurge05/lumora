"""
app/admin_api/treasury/routes.py
----------------------------------
Platform Treasury API — Phase 1 (read-only accounting + withdrawal history).

All balance figures come from the backend treasury_service.
The frontend NEVER performs financial calculations.

Endpoints:
    GET  /api/admin/treasury/summary          — Dashboard KPI cards
    GET  /api/admin/treasury/withdrawals      — Paginated withdrawal history
    GET  /api/admin/treasury/ledger           — Immutable ledger entries
    GET  /api/admin/treasury/withdrawals/{id} — Single withdrawal detail

Phase 2 (deferred): POST /withdraw, POST approve/complete/cancel
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.core.permissions import require_permission
from admin.validators.admin_auth import require_admin_role
from app.services.treasury_service import (
    get_treasury_summary,
    get_withdrawal_list,
    get_ledger_entries,
)
from app.models.platform_withdrawal import PlatformWithdrawal
from app.models.audit_log import AuditLog

_logger = logging.getLogger("lumora.treasury.routes")

router = APIRouter()


# ── RBAC helpers ──────────────────────────────────────────────────────────────

def _require_treasury_read(
    current_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
) -> User:
    """
    Allow access to treasury read endpoints for:
      super_admin  — full access
      admin        — view-only
      finance      — view + approve
    Analyst and lower → 403 via require_admin_role base check.
    """
    from app.models.admin_role import AdminRole
    from fastapi import HTTPException, status

    role_rec = (
        db.query(AdminRole)
        .filter(AdminRole.user_id == current_user.id, AdminRole.is_active == True)
        .first()
    )
    # If no role record exists the user is a legacy admin — grant access
    if role_rec is None:
        return current_user

    # Deny analyst
    if role_rec.role_level == "analyst":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Analyst role does not have access to treasury data.",
        )
    return current_user


# ── GET /summary ──────────────────────────────────────────────────────────────

@router.get("/summary")
def treasury_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_treasury_read),
):
    """
    Return all Platform Treasury KPI metrics for the dashboard cards.

    Available Balance = Platform Revenue
                      - Affiliate Liability
                      - Pending Withdrawals
                      - Completed Withdrawals

    Platform Revenue is NEVER modified by withdrawals.
    """
    summary = get_treasury_summary(db)
    return {"success": True, "data": summary}


# ── GET /withdrawals ──────────────────────────────────────────────────────────

@router.get("/withdrawals")
def list_withdrawals(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_treasury_read),
):
    """
    Return paginated platform withdrawal history.
    Includes requester/approver names, destination details, and timestamps.
    """
    result = get_withdrawal_list(db, page=page, page_size=page_size, status_filter=status)
    return {"success": True, **result}


# ── GET /withdrawals/{id} ─────────────────────────────────────────────────────

@router.get("/withdrawals/{withdrawal_id}")
def get_withdrawal_detail(
    withdrawal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_treasury_read),
):
    """Return full detail for a single withdrawal, including audit trail."""
    import json
    from fastapi import HTTPException, status

    row = db.query(PlatformWithdrawal).filter(PlatformWithdrawal.id == withdrawal_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Withdrawal not found.")

    from app.models.user import User as UserModel
    req_user  = db.query(UserModel).filter(UserModel.id == row.requested_by).first()
    appr_user = db.query(UserModel).filter(UserModel.id == row.approved_by).first() if row.approved_by else None

    dest = {}
    try:
        dest = json.loads(row.destination_account) if row.destination_account else {}
    except Exception:
        pass

    # Pull audit log entries for this withdrawal
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
            "id":                   row.id,
            "withdrawal_number":    row.withdrawal_number,
            "amount":               row.amount,
            "currency":             row.currency,
            "status":               row.status,
            "destination_type":     row.destination_type,
            "destination":          dest,
            "notes":                row.notes,
            "failure_reason":       row.failure_reason,
            "transaction_reference": row.transaction_reference,
            "requested_by":  {"name": req_user.name, "email": req_user.email} if req_user else None,
            "approved_by":   {"name": appr_user.name, "email": appr_user.email} if appr_user else None,
            "requested_at":  row.requested_at.isoformat() + "Z" if row.requested_at else None,
            "approved_at":   row.approved_at.isoformat() + "Z" if row.approved_at else None,
            "completed_at":  row.completed_at.isoformat() + "Z" if row.completed_at else None,
            "created_at":    row.created_at.isoformat() + "Z" if row.created_at else None,
            "audit_trail":   audit_trail,
        },
    }


# ── GET /ledger ───────────────────────────────────────────────────────────────

@router.get("/ledger")
def list_ledger(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    ledger_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_treasury_read),
):
    """
    Return paginated immutable treasury ledger entries.
    Entries are append-only — this endpoint is read-only.
    """
    result = get_ledger_entries(db, page=page, page_size=page_size, ledger_type=ledger_type)
    return {"success": True, **result}
