"""
app/services/treasury_service.py
----------------------------------
Platform Treasury Accounting Engine — Phase 1.

Core accounting rule (immutable revenue model):

    Available Balance =
        Platform Revenue
      - Affiliate Liability          (approved commissions not yet paid)
      - Pending Withdrawals          (status: pending | approved | processing)
      - Completed Withdrawals        (status: completed)

Platform Revenue is NEVER modified.  Every financial event creates a new
PlatformTreasuryLedger row.  History is append-only and immutable.

Exported surface:
    get_treasury_summary(db)              → dict of all KPI metrics
    get_withdrawal_list(db, ...)          → paginated withdrawal rows
    get_withdrawal_detail(db, id)         → single withdrawal with audit trail
    write_ledger_entry(db, ...)           → insert immutable ledger row
    generate_withdrawal_number(db)        → PLT-WD-YYYYMMDD-XXXXXX
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.affiliate import AffiliateCommission
from app.models.platform_withdrawal import PlatformWithdrawal
from app.models.platform_treasury_ledger import PlatformTreasuryLedger

_logger = logging.getLogger("lumora.treasury")

# ── Constants ─────────────────────────────────────────────────────────────────
MINIMUM_RESERVE = 5_000.0          # ₹5 000 kept as platform reserve
PLATFORM_FEE_RATE = 0.30           # 30 % of each sale is platform revenue
                                    # (applied when no explicit fee column exists)
PENDING_STATUSES = ("pending", "approved", "processing")


# ── Reference Number Generator ────────────────────────────────────────────────

def generate_withdrawal_number(db: Session) -> str:
    """
    Generate a unique, sequential withdrawal reference number.
    Format:  PLT-WD-YYYYMMDD-XXXXXX   (e.g. PLT-WD-20260730-000001)
    """
    today = datetime.utcnow().strftime("%Y%m%d")
    prefix = f"PLT-WD-{today}-"

    # Count existing withdrawals created today to derive next sequence
    count = (
        db.query(func.count(PlatformWithdrawal.id))
        .filter(PlatformWithdrawal.withdrawal_number.like(f"{prefix}%"))
        .scalar()
        or 0
    )
    seq = str(count + 1).zfill(6)
    return f"{prefix}{seq}"


# ── Revenue Calculation ───────────────────────────────────────────────────────

def _calculate_platform_revenue(db: Session) -> float:
    """
    Sum total_amount of all completed/paid orders as gross platform revenue.
    In a real deployment this would use a separate platform_fee column;
    here we use 100% of the order total as the platform's gross revenue figure
    (net of vendor payouts is tracked separately via the ledger).
    """
    result = (
        db.query(func.coalesce(func.sum(Order.total_amount), 0.0))
        .filter(Order.status.in_(["completed", "paid", "Completed", "Paid"]))
        .scalar()
    )
    return round(float(result or 0.0), 2)


def _calculate_affiliate_liability(db: Session) -> float:
    """
    Sum of affiliate commissions that are approved / ready_for_payout but
    NOT yet paid.  These are a liability against the platform balance.
    """
    result = (
        db.query(func.coalesce(func.sum(AffiliateCommission.commission_amt), 0.0))
        .filter(
            AffiliateCommission.commission_status.in_(
                ["approved", "ready_for_payout"]
            )
        )
        .scalar()
    )
    return round(float(result or 0.0), 2)


def _calculate_pending_withdrawals(db: Session) -> float:
    """Sum of in-flight platform withdrawals (pending | approved | processing)."""
    result = (
        db.query(func.coalesce(func.sum(PlatformWithdrawal.amount), 0.0))
        .filter(PlatformWithdrawal.status.in_(list(PENDING_STATUSES)))
        .scalar()
    )
    return round(float(result or 0.0), 2)


def _calculate_completed_withdrawals(db: Session) -> float:
    """Sum of all successfully completed platform withdrawals."""
    result = (
        db.query(func.coalesce(func.sum(PlatformWithdrawal.amount), 0.0))
        .filter(PlatformWithdrawal.status == "completed")
        .scalar()
    )
    return round(float(result or 0.0), 2)


def _calculate_today_revenue(db: Session) -> float:
    """Revenue from orders completed today (UTC)."""
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
    """Total platform withdrawals completed in the current calendar month."""
    now = datetime.utcnow()
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
    """Most recent completed withdrawal metadata for the dashboard."""
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
        "amount": row.amount,
        "completed_at": row.completed_at.isoformat() + "Z" if row.completed_at else None,
        "destination_type": row.destination_type,
    }


# ── Main Summary ──────────────────────────────────────────────────────────────

def get_treasury_summary(db: Session) -> dict:
    """
    Compute all Platform Treasury KPI metrics from live DB state.
    This is the single source of truth for the dashboard cards.
    Every figure is derived from the ledger/tables — nothing is hardcoded.
    """
    platform_revenue       = _calculate_platform_revenue(db)
    affiliate_liability    = _calculate_affiliate_liability(db)
    pending_withdrawals    = _calculate_pending_withdrawals(db)
    completed_withdrawals  = _calculate_completed_withdrawals(db)

    # Core accounting equation (immutable revenue model)
    available_balance = round(
        platform_revenue
        - affiliate_liability
        - pending_withdrawals
        - completed_withdrawals,
        2,
    )
    available_balance = max(available_balance, 0.0)

    net_platform_earnings = round(platform_revenue - affiliate_liability, 2)
    net_withdrawable      = max(round(available_balance - MINIMUM_RESERVE, 2), 0.0)
    today_revenue         = _calculate_today_revenue(db)
    month_withdrawn       = _calculate_current_month_withdrawn(db)
    last_withdrawal       = _get_last_withdrawal(db)

    # Ledger entry count for stats
    ledger_count = db.query(func.count(PlatformTreasuryLedger.id)).scalar() or 0

    return {
        "platform_revenue":      platform_revenue,
        "affiliate_liability":   affiliate_liability,
        "pending_withdrawals":   pending_withdrawals,
        "completed_withdrawals": completed_withdrawals,
        "available_balance":     available_balance,
        "net_platform_earnings": net_platform_earnings,
        "net_withdrawable":      net_withdrawable,
        "minimum_reserve":       MINIMUM_RESERVE,
        "today_revenue":         today_revenue,
        "current_month_withdrawn": month_withdrawn,
        "last_withdrawal":       last_withdrawal,
        "ledger_entries":        ledger_count,
        "_meta": {
            "computed_at": datetime.utcnow().isoformat() + "Z",
            "formula": "available = revenue - affiliate_liability - pending_wd - completed_wd",
        },
    }


# ── Ledger Writer ─────────────────────────────────────────────────────────────

def write_ledger_entry(
    db: Session,
    *,
    ledger_type: str,
    amount: float,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
    description: Optional[str] = None,
    created_by: Optional[int] = None,
) -> PlatformTreasuryLedger:
    """
    Append an immutable entry to the platform treasury ledger.
    The running_balance is a denormalized snapshot for fast reads;
    the authoritative balance is always SUM(amount).
    """
    # Compute current running balance
    current_balance = (
        db.query(func.coalesce(func.sum(PlatformTreasuryLedger.amount), 0.0))
        .scalar()
        or 0.0
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
    db.flush()  # get ID without committing — caller controls the transaction
    return entry


# ── Withdrawal List ───────────────────────────────────────────────────────────

def get_withdrawal_list(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    status_filter: Optional[str] = None,
) -> dict:
    """
    Return paginated platform withdrawal history.
    Each row includes requester name/email resolved from users table.
    """
    from app.models.user import User

    page = max(1, page)
    page_size = max(1, min(100, page_size))
    offset = (page - 1) * page_size

    query = db.query(PlatformWithdrawal)
    if status_filter:
        query = query.filter(PlatformWithdrawal.status == status_filter)

    total = query.count()
    rows = (
        query
        .order_by(PlatformWithdrawal.requested_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    # Batch-load users
    user_ids = list({r.requested_by for r in rows if r.requested_by}
                    | {r.approved_by for r in rows if r.approved_by})
    users_map: dict[int, User] = {}
    if user_ids:
        users_map = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    items = []
    for r in rows:
        req_user = users_map.get(r.requested_by)
        appr_user = users_map.get(r.approved_by) if r.approved_by else None

        dest = {}
        try:
            dest = json.loads(r.destination_account) if r.destination_account else {}
        except Exception:
            pass

        items.append({
            "id":                   r.id,
            "withdrawal_number":    r.withdrawal_number,
            "amount":               r.amount,
            "currency":             r.currency,
            "status":               r.status,
            "destination_type":     r.destination_type,
            "destination_label":    dest.get("bank_name") or dest.get("upi_id") or r.destination_type,
            "requested_by_name":    req_user.name if req_user else "Admin",
            "requested_by_email":   req_user.email if req_user else "",
            "requested_at":         r.requested_at.isoformat() + "Z" if r.requested_at else None,
            "approved_by_name":     appr_user.name if appr_user else None,
            "approved_at":          r.approved_at.isoformat() + "Z" if r.approved_at else None,
            "completed_at":         r.completed_at.isoformat() + "Z" if r.completed_at else None,
            "transaction_reference": r.transaction_reference,
            "notes":                r.notes,
            "failure_reason":       r.failure_reason,
        })

    return {"total": total, "page": page, "page_size": page_size, "items": items}


# ── Ledger History ────────────────────────────────────────────────────────────

def get_ledger_entries(
    db: Session,
    page: int = 1,
    page_size: int = 50,
    ledger_type: Optional[str] = None,
) -> dict:
    """Return paginated immutable ledger entries (read-only view)."""
    from app.models.user import User

    page = max(1, page)
    page_size = max(1, min(200, page_size))
    offset = (page - 1) * page_size

    query = db.query(PlatformTreasuryLedger)
    if ledger_type:
        query = query.filter(PlatformTreasuryLedger.ledger_type == ledger_type)

    total = query.count()
    rows = (
        query
        .order_by(PlatformTreasuryLedger.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    user_ids = [r.created_by for r in rows if r.created_by]
    users_map: dict[int, User] = {}
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
