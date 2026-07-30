"""
app/services/treasury_service.py
----------------------------------
Platform Treasury Accounting Engine — Phase 1 + Phase 2.

Core accounting rule (immutable revenue model):

    Available Balance =
        Platform Revenue
      - Affiliate Liability          (approved commissions not yet paid)
      - Pending Withdrawals          (status: pending | approved | processing)
      - Completed Withdrawals        (status: completed)

Platform Revenue is NEVER modified.  Every financial event creates a new
PlatformTreasuryLedger row.  History is append-only and immutable.

Phase 1 exports (preserved):
    get_treasury_summary(db)
    get_withdrawal_list(db, ...)
    get_withdrawal_detail(db, id)
    write_ledger_entry(db, ...)
    generate_withdrawal_number(db)
    get_ledger_entries(db, ...)

Phase 2 additions:
    create_settlement_request(db, ...)
    approve_settlement(db, ...)
    complete_settlement(db, ...)
    cancel_settlement(db, ...)
    get_treasury_timeline(db, ...)
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import func, text
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.order import Order
from app.models.affiliate import AffiliateCommission
from app.models.platform_withdrawal import PlatformWithdrawal
from app.models.platform_treasury_ledger import PlatformTreasuryLedger
from app.models.audit_log import AuditLog

_logger = logging.getLogger("lumora.treasury")

# ── Constants ─────────────────────────────────────────────────────────────────
MINIMUM_RESERVE   = 5_000.0
MINIMUM_SETTLEMENT = 500.0          # ₹500 minimum per settlement
PENDING_STATUSES  = ("pending", "approved", "processing")


# ── Reference Number Generator ────────────────────────────────────────────────

def generate_withdrawal_number(db: Session) -> str:
    today  = datetime.utcnow().strftime("%Y%m%d")
    prefix = f"PLT-WD-{today}-"
    count  = (
        db.query(func.count(PlatformWithdrawal.id))
        .filter(PlatformWithdrawal.withdrawal_number.like(f"{prefix}%"))
        .scalar() or 0
    )
    return f"{prefix}{str(count + 1).zfill(6)}"


# ── Revenue Calculation ───────────────────────────────────────────────────────

def _calculate_platform_revenue(db: Session) -> float:
    result = (
        db.query(func.coalesce(func.sum(Order.total_amount), 0.0))
        .filter(Order.status.in_(["completed", "paid", "Completed", "Paid"]))
        .scalar()
    )
    return round(float(result or 0.0), 2)


def _calculate_affiliate_liability(db: Session) -> float:
    result = (
        db.query(func.coalesce(func.sum(AffiliateCommission.commission_amt), 0.0))
        .filter(AffiliateCommission.commission_status.in_(["approved", "ready_for_payout"]))
        .scalar()
    )
    return round(float(result or 0.0), 2)


def _calculate_pending_withdrawals(db: Session) -> float:
    result = (
        db.query(func.coalesce(func.sum(PlatformWithdrawal.amount), 0.0))
        .filter(PlatformWithdrawal.status.in_(list(PENDING_STATUSES)))
        .scalar()
    )
    return round(float(result or 0.0), 2)


def _calculate_completed_withdrawals(db: Session) -> float:
    result = (
        db.query(func.coalesce(func.sum(PlatformWithdrawal.amount), 0.0))
        .filter(PlatformWithdrawal.status == "completed")
        .scalar()
    )
    return round(float(result or 0.0), 2)


def _calculate_today_revenue(db: Session) -> float:
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    result = (
        db.query(func.coalesce(func.sum(Order.total_amount), 0.0))
        .filter(
            Order.status.in_(["completed", "paid", "Completed", "Paid"]),
            Order.created_at >= today_start,
        )
        .scalar()
    )
    return round(float(result or 0.0), 2)


def _calculate_current_month_withdrawn(db: Session) -> float:
    now        = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    result = (
        db.query(func.coalesce(func.sum(PlatformWithdrawal.amount), 0.0))
        .filter(
            PlatformWithdrawal.status == "completed",
            PlatformWithdrawal.completed_at >= month_start,
        )
        .scalar()
    )
    return round(float(result or 0.0), 2)


def _get_last_withdrawal(db: Session) -> Optional[dict]:
    row = (
        db.query(PlatformWithdrawal)
        .filter(PlatformWithdrawal.status == "completed")
        .order_by(PlatformWithdrawal.completed_at.desc())
        .first()
    )
    if not row:
        return None
    return {
        "withdrawal_number": row.withdrawal_number,
        "amount":            row.amount,
        "completed_at":      row.completed_at.isoformat() + "Z" if row.completed_at else None,
        "destination_type":  row.destination_type,
    }


# ── Main Summary ──────────────────────────────────────────────────────────────

def get_treasury_summary(db: Session) -> dict:
    platform_revenue      = _calculate_platform_revenue(db)
    affiliate_liability   = _calculate_affiliate_liability(db)
    pending_withdrawals   = _calculate_pending_withdrawals(db)
    completed_withdrawals = _calculate_completed_withdrawals(db)

    available_balance = round(
        platform_revenue - affiliate_liability - pending_withdrawals - completed_withdrawals, 2
    )
    available_balance = max(available_balance, 0.0)

    net_platform_earnings = round(platform_revenue - affiliate_liability, 2)
    net_withdrawable      = max(round(available_balance - MINIMUM_RESERVE, 2), 0.0)
    today_revenue         = _calculate_today_revenue(db)
    month_withdrawn       = _calculate_current_month_withdrawn(db)
    last_withdrawal       = _get_last_withdrawal(db)
    ledger_count          = db.query(func.count(PlatformTreasuryLedger.id)).scalar() or 0

    # Phase 2: settlement counts by status
    pending_count   = db.query(func.count(PlatformWithdrawal.id)).filter(PlatformWithdrawal.status == "pending").scalar() or 0
    approved_count  = db.query(func.count(PlatformWithdrawal.id)).filter(PlatformWithdrawal.status == "approved").scalar() or 0
    completed_count = db.query(func.count(PlatformWithdrawal.id)).filter(PlatformWithdrawal.status == "completed").scalar() or 0

    return {
        "platform_revenue":        platform_revenue,
        "affiliate_liability":     affiliate_liability,
        "pending_withdrawals":     pending_withdrawals,
        "completed_withdrawals":   completed_withdrawals,
        "available_balance":       available_balance,
        "net_platform_earnings":   net_platform_earnings,
        "net_withdrawable":        net_withdrawable,
        "minimum_reserve":         MINIMUM_RESERVE,
        "today_revenue":           today_revenue,
        "current_month_withdrawn": month_withdrawn,
        "last_withdrawal":         last_withdrawal,
        "ledger_entries":          ledger_count,
        "settlement_counts": {
            "pending":   pending_count,
            "approved":  approved_count,
            "completed": completed_count,
        },
        "_meta": {
            "computed_at": datetime.utcnow().isoformat() + "Z",
            "formula":     "available = revenue - affiliate_liability - pending_wd - completed_wd",
        },
    }


# ── Ledger Writer ─────────────────────────────────────────────────────────────

def write_ledger_entry(
    db: Session,
    *,
    ledger_type: str,
    amount: float,
    reference_type: Optional[str] = None,
    reference_id: Optional[str]   = None,
    description: Optional[str]    = None,
    created_by: Optional[int]     = None,
) -> PlatformTreasuryLedger:
    current_balance = (
        db.query(func.coalesce(func.sum(PlatformTreasuryLedger.amount), 0.0)).scalar() or 0.0
    )
    running = round(float(current_balance) + amount, 2)

    entry = PlatformTreasuryLedger(
        ledger_type=ledger_type,
        amount=round(amount, 2),
        running_balance=running,
        reference_type=reference_type,
        reference_id=str(reference_id) if reference_id else None,
        description=description,
        created_by=created_by,
        created_at=datetime.utcnow(),
    )
    db.add(entry)
    db.flush()
    return entry


def _write_audit_log(
    db: Session,
    *,
    action: str,
    admin_user_id: Optional[int],
    target_type: str,
    target_id: str,
    metadata: dict,
    ip_address: Optional[str] = None,
) -> AuditLog:
    log = AuditLog(
        admin_user_id=admin_user_id,
        action=action,
        category="Financial",
        target_type=target_type,
        target_id=target_id,
        metadata_json=json.dumps(metadata),
        ip_address=ip_address,
        created_at=datetime.utcnow(),
    )
    db.add(log)
    db.flush()
    return log


# ── Phase 2: Settlement Business Logic ────────────────────────────────────────

def _lock_and_validate_balance(db: Session, requested_amount: float) -> float:
    """
    Re-compute available balance inside the current transaction.
    Raises HTTPException if insufficient balance.
    Returns the available balance.
    """
    platform_revenue      = _calculate_platform_revenue(db)
    affiliate_liability   = _calculate_affiliate_liability(db)
    pending_withdrawals   = _calculate_pending_withdrawals(db)
    completed_withdrawals = _calculate_completed_withdrawals(db)

    available = round(
        platform_revenue - affiliate_liability - pending_withdrawals - completed_withdrawals, 2
    )
    available = max(available, 0.0)

    if requested_amount < MINIMUM_SETTLEMENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minimum settlement amount is ₹{MINIMUM_SETTLEMENT:,.2f}.",
        )

    net_withdrawable = max(round(available - MINIMUM_RESERVE, 2), 0.0)
    if requested_amount > net_withdrawable:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Requested amount ₹{requested_amount:,.2f} exceeds "
                f"net withdrawable balance ₹{net_withdrawable:,.2f} "
                f"(Available ₹{available:,.2f} − Reserve ₹{MINIMUM_RESERVE:,.2f})."
            ),
        )
    return available


def create_settlement_request(
    db: Session,
    *,
    amount: float,
    destination_type: str,
    destination_account: dict,
    notes: Optional[str],
    requested_by: int,
    ip_address: Optional[str] = None,
) -> PlatformWithdrawal:
    """
    Phase 2 — Create a new settlement request.
    Validates balance, creates PlatformWithdrawal, writes ledger + audit.
    """
    # Validate inside current transaction
    _lock_and_validate_balance(db, amount)

    withdrawal_number = generate_withdrawal_number(db)

    row = PlatformWithdrawal(
        withdrawal_number   = withdrawal_number,
        amount              = round(amount, 2),
        currency            = "INR",
        status              = "pending",
        requested_by        = requested_by,
        requested_at        = datetime.utcnow(),
        destination_type    = destination_type,
        destination_account = json.dumps(destination_account),
        notes               = notes,
        created_at          = datetime.utcnow(),
        updated_at          = datetime.utcnow(),
    )
    db.add(row)
    db.flush()

    # Ledger entry — negative (debit pending against available balance)
    write_ledger_entry(
        db,
        ledger_type    = "platform_withdrawal",
        amount         = -round(amount, 2),
        reference_type = "settlement",
        reference_id   = withdrawal_number,
        description    = f"Settlement request {withdrawal_number} — ₹{amount:,.2f} pending",
        created_by     = requested_by,
    )

    # Audit log
    _write_audit_log(
        db,
        action        = "treasury_settlement_requested",
        admin_user_id = requested_by,
        target_type   = "platform_withdrawal",
        target_id     = str(row.id),
        metadata      = {
            "withdrawal_number": withdrawal_number,
            "amount":            amount,
            "destination_type":  destination_type,
        },
        ip_address    = ip_address,
    )

    db.commit()
    db.refresh(row)
    return row


def approve_settlement(
    db: Session,
    *,
    withdrawal_id: int,
    approved_by: int,
    ip_address: Optional[str] = None,
) -> PlatformWithdrawal:
    """Approve a pending settlement. Only pending → approved transition allowed."""
    row = db.query(PlatformWithdrawal).filter(PlatformWithdrawal.id == withdrawal_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Settlement not found.")
    if row.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve settlement in '{row.status}' status. Only 'pending' settlements can be approved.",
        )

    row.status      = "approved"
    row.approved_by = approved_by
    row.approved_at = datetime.utcnow()
    row.updated_at  = datetime.utcnow()
    db.flush()

    _write_audit_log(
        db,
        action        = "treasury_settlement_approved",
        admin_user_id = approved_by,
        target_type   = "platform_withdrawal",
        target_id     = str(row.id),
        metadata      = {"withdrawal_number": row.withdrawal_number, "amount": row.amount},
        ip_address    = ip_address,
    )

    db.commit()
    db.refresh(row)
    return row


def complete_settlement(
    db: Session,
    *,
    withdrawal_id: int,
    transaction_reference: str,
    completed_by: int,
    ip_address: Optional[str] = None,
) -> PlatformWithdrawal:
    """Mark an approved settlement as completed and record the bank transaction reference."""
    row = db.query(PlatformWithdrawal).filter(PlatformWithdrawal.id == withdrawal_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Settlement not found.")
    if row.status not in ("approved", "processing"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete settlement in '{row.status}' status.",
        )
    if not transaction_reference or not transaction_reference.strip():
        raise HTTPException(status_code=400, detail="Transaction reference is required to complete a settlement.")

    row.status                = "completed"
    row.completed_at          = datetime.utcnow()
    row.transaction_reference = transaction_reference.strip()
    row.updated_at            = datetime.utcnow()
    db.flush()

    _write_audit_log(
        db,
        action        = "treasury_settlement_completed",
        admin_user_id = completed_by,
        target_type   = "platform_withdrawal",
        target_id     = str(row.id),
        metadata      = {
            "withdrawal_number":    row.withdrawal_number,
            "amount":               row.amount,
            "transaction_reference": transaction_reference,
        },
        ip_address    = ip_address,
    )

    db.commit()
    db.refresh(row)
    return row


def cancel_settlement(
    db: Session,
    *,
    withdrawal_id: int,
    reason: Optional[str],
    cancelled_by: int,
    ip_address: Optional[str] = None,
) -> PlatformWithdrawal:
    """Cancel a pending or approved settlement. Reverses the ledger debit."""
    row = db.query(PlatformWithdrawal).filter(PlatformWithdrawal.id == withdrawal_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Settlement not found.")
    if row.status not in ("pending", "approved"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel settlement in '{row.status}' status.",
        )

    row.status         = "cancelled"
    row.failure_reason = reason
    row.updated_at     = datetime.utcnow()
    db.flush()

    # Reversal ledger entry — restore the balance
    write_ledger_entry(
        db,
        ledger_type    = "manual_adjustment",
        amount         = round(row.amount, 2),   # positive = reversal
        reference_type = "settlement_cancellation",
        reference_id   = row.withdrawal_number,
        description    = f"Reversal: Settlement {row.withdrawal_number} cancelled — ₹{row.amount:,.2f} restored",
        created_by     = cancelled_by,
    )

    _write_audit_log(
        db,
        action        = "treasury_settlement_cancelled",
        admin_user_id = cancelled_by,
        target_type   = "platform_withdrawal",
        target_id     = str(row.id),
        metadata      = {
            "withdrawal_number": row.withdrawal_number,
            "amount":            row.amount,
            "reason":            reason,
        },
        ip_address    = ip_address,
    )

    db.commit()
    db.refresh(row)
    return row


# ── Phase 2: Treasury Timeline ────────────────────────────────────────────────

def get_treasury_timeline(
    db: Session,
    page: int = 1,
    page_size: int = 40,
) -> dict:
    """
    Unified chronological treasury event feed.
    Merges PlatformTreasuryLedger entries + Financial AuditLog entries.
    """
    from app.models.user import User

    page      = max(1, page)
    page_size = max(1, min(100, page_size))
    offset    = (page - 1) * page_size

    # Ledger entries
    ledger_q = db.query(PlatformTreasuryLedger).order_by(PlatformTreasuryLedger.created_at.desc())
    ledger_total = ledger_q.count()
    ledger_rows  = ledger_q.offset(offset).limit(page_size).all()

    # Batch-load users for ledger entries
    ledger_user_ids = [r.created_by for r in ledger_rows if r.created_by]
    users_map: dict = {}
    if ledger_user_ids:
        users_map = {u.id: u for u in db.query(User).filter(User.id.in_(ledger_user_ids)).all()}

    LEDGER_EVENT_ICONS = {
        "revenue_earned":      "💰",
        "refund":              "↩️",
        "commission_expense":  "🤝",
        "affiliate_expense":   "💸",
        "platform_withdrawal": "🏦",
        "chargeback":          "⚠️",
        "manual_adjustment":   "🔧",
        "vendor_adjustment":   "🏪",
    }
    LEDGER_EVENT_COLORS = {
        "revenue_earned":      "emerald",
        "refund":              "red",
        "commission_expense":  "orange",
        "affiliate_expense":   "pink",
        "platform_withdrawal": "blue",
        "chargeback":          "red",
        "manual_adjustment":   "purple",
        "vendor_adjustment":   "amber",
    }

    items = []
    for r in ledger_rows:
        creator = users_map.get(r.created_by) if r.created_by else None
        items.append({
            "id":           f"ledger-{r.id}",
            "event_source": "ledger",
            "ledger_type":  r.ledger_type,
            "icon":         LEDGER_EVENT_ICONS.get(r.ledger_type, "📋"),
            "color":        LEDGER_EVENT_COLORS.get(r.ledger_type, "purple"),
            "title":        r.ledger_type.replace("_", " ").title(),
            "description":  r.description or "",
            "amount":       r.amount,
            "running_balance": r.running_balance,
            "reference":    f"{r.reference_type}#{r.reference_id}" if r.reference_id else None,
            "actor":        creator.name if creator else "System",
            "created_at":   r.created_at.isoformat() + "Z" if r.created_at else None,
        })

    return {
        "total":     ledger_total,
        "page":      page,
        "page_size": page_size,
        "items":     items,
    }


# ── Phase 1: Withdrawal / Settlement List ─────────────────────────────────────

def get_withdrawal_list(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    status_filter: Optional[str] = None,
) -> dict:
    from app.models.user import User

    page      = max(1, page)
    page_size = max(1, min(100, page_size))
    offset    = (page - 1) * page_size

    query = db.query(PlatformWithdrawal)
    if status_filter:
        query = query.filter(PlatformWithdrawal.status == status_filter)

    total = query.count()
    rows  = query.order_by(PlatformWithdrawal.requested_at.desc()).offset(offset).limit(page_size).all()

    user_ids = list(
        {r.requested_by for r in rows if r.requested_by}
        | {r.approved_by  for r in rows if r.approved_by}
    )
    users_map: dict = {}
    if user_ids:
        users_map = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    items = []
    for r in rows:
        req_user  = users_map.get(r.requested_by)
        appr_user = users_map.get(r.approved_by) if r.approved_by else None
        dest = {}
        try:
            dest = json.loads(r.destination_account) if r.destination_account else {}
        except Exception:
            pass

        items.append({
            "id":                    r.id,
            "withdrawal_number":     r.withdrawal_number,
            "amount":                r.amount,
            "currency":              r.currency,
            "status":                r.status,
            "destination_type":      r.destination_type,
            "destination_label":     dest.get("bank_name") or dest.get("upi_id") or r.destination_type,
            "requested_by_name":     req_user.name  if req_user  else "Admin",
            "requested_by_email":    req_user.email if req_user  else "",
            "requested_at":          r.requested_at.isoformat()  + "Z" if r.requested_at  else None,
            "approved_by_name":      appr_user.name if appr_user else None,
            "approved_at":           r.approved_at.isoformat()   + "Z" if r.approved_at   else None,
            "completed_at":          r.completed_at.isoformat()  + "Z" if r.completed_at  else None,
            "transaction_reference": r.transaction_reference,
            "notes":                 r.notes,
            "failure_reason":        r.failure_reason,
        })

    return {"total": total, "page": page, "page_size": page_size, "items": items}


# ── Phase 1: Ledger Entries ───────────────────────────────────────────────────

def get_ledger_entries(
    db: Session,
    page: int = 1,
    page_size: int = 50,
    ledger_type: Optional[str] = None,
) -> dict:
    from app.models.user import User

    page      = max(1, page)
    page_size = max(1, min(200, page_size))
    offset    = (page - 1) * page_size

    query = db.query(PlatformTreasuryLedger)
    if ledger_type:
        query = query.filter(PlatformTreasuryLedger.ledger_type == ledger_type)

    total = query.count()
    rows  = query.order_by(PlatformTreasuryLedger.created_at.desc()).offset(offset).limit(page_size).all()

    user_ids = [r.created_by for r in rows if r.created_by]
    users_map: dict = {}
    if user_ids:
        users_map = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    items = []
    for r in rows:
        creator = users_map.get(r.created_by) if r.created_by else None
        items.append({
            "id":              r.id,
            "ledger_type":     r.ledger_type,
            "amount":          r.amount,
            "running_balance": r.running_balance,
            "reference_type":  r.reference_type,
            "reference_id":    r.reference_id,
            "description":     r.description,
            "created_by_name": creator.name if creator else "System",
            "created_at":      r.created_at.isoformat() + "Z" if r.created_at else None,
        })

    return {"total": total, "page": page, "page_size": page_size, "items": items}
