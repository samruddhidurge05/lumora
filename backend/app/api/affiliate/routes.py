"""
Affiliate API Routes
====================
Endpoints for the affiliate program: profile management, stats,
commission history, payout requests, click tracking, dashboard summary,
analytics, and reports.

Security
--------
All write/read endpoints require a valid JWT (Bearer token).
The _get_affiliate_profile() helper resolves the authenticated user
to their AffiliateProfile, creating one automatically on first access.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header, status as http_status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import os
import uuid
import logging
import time

logger = logging.getLogger(__name__)

# In-memory cache for fast deduplication (prevents concurrent race conditions)
_click_cache = {}

from app.db.session import get_db
from app.dependencies import get_current_user_required
from admin.validators.status_checks import verify_affiliate_active
from app.models.user import User
from app.models.product import Product
from app.models.affiliate import AffiliateProfile, AffiliateCommission, AffiliatePayout, ReferralLink, ReferralClick, AffiliateReferral
from app.api.affiliate.schemas import (
    AffiliateProfileResponse, AffiliateProfileUpdate,
    CommissionResponse, CommissionCreate,
    PayoutResponse, PayoutRequest,
    AffiliateStats, ClickTrackResponse,
    DashboardSummaryResponse, AnalyticsResponse, ReportResponse,
    TopProductItem, MonthlyEarningsItem,
    CommissionReportItem, PayoutReportItem,
    ReferralLinkCreate, ReferralLinkResponse,
    ReferralClickRequest, ReferralClickResponse,
    ReferralAuthRequest, ReferralViewRequest,
    ConversionItemResponse,
)

router = APIRouter()

SITE_URL        = os.getenv("VITE_SITE_URL", "http://localhost:5173")
MIN_PAYOUT_INR  = 500.0   # minimum withdrawal amount in INR


from sqlalchemy.exc import IntegrityError
from app.services.activity_log_service import ActivityLogService
from app.models.notification import Notification


# ── POST /affiliate/activate ───────────────────────────────────────────────────
@router.post("/activate")
def activate_affiliate(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """
    Activate affiliate access for an existing authenticated user.

    Multi-role design: ONE Firebase identity, ONE PostgreSQL user,
    multiple capabilities. An existing customer can activate affiliate
    access without creating a new account or a new Firebase identity.

    - Idempotent: safe to call multiple times.
    - Promotes user.role from "customer" → "affiliate" if needed.
    - Creates AffiliateProfile if it doesn't already exist.
    - Creates/updates Firestore affiliates/{uid} doc so future
      affiliate logins (AuthContext role-check) succeed.
    - Returns a new backend JWT with active_role="affiliate".

    Customer data (orders, wishlist, downloads) is fully preserved —
    all FKs reference users.id which never changes.
    """
    from app.core.security import create_access_token
    from datetime import datetime as _dt

    already_affiliate = current_user.role in ("affiliate", "vendor", "admin")

    # Step 1: Promote role in SQLite if still "customer"
    if not already_affiliate:
        current_user.role = "affiliate"
        db.commit()
        db.refresh(current_user)

    # Step 2: Create AffiliateProfile if it doesn't exist
    profile = db.query(AffiliateProfile).filter(
        AffiliateProfile.user_id == current_user.id
    ).first()

    if not profile:
        try:
            with db.begin_nested():
                profile = AffiliateProfile(
                    user_id=current_user.id,
                    referral_code=f"AFF{current_user.id:04d}",
                    commission_rate=20.0,
                    total_earnings=0.0,
                    total_clicks=0,
                    total_sales=0,
                    is_active=True,
                    status="active",
                )
                db.add(profile)

                ActivityLogService.log_user_activity(
                    db=db,
                    user_id=current_user.id,
                    activity_type="affiliate_activation",
                    details="Affiliate access activated from existing customer account.",
                )

                notification = Notification(
                    user_id=current_user.id,
                    title="Affiliate Access Activated",
                    message="Welcome to the Lumora Affiliate Program! Your referral link is ready.",
                    category="general",
                )
                db.add(notification)
            db.commit()
            db.refresh(profile)
        except IntegrityError:
            db.rollback()
            profile = db.query(AffiliateProfile).filter(
                AffiliateProfile.user_id == current_user.id
            ).first()

    # Step 3: Sync to Firestore so AuthContext role-check passes on next login
    # AuthContext.login() checks getDoc(doc(db, 'affiliates', uid)) — if this
    # doc exists the user can log in via the Affiliate portal in future sessions.
    try:
        from app.shared.firebase.connection import db as fs_db, firebase_connected
        if firebase_connected and fs_db is not None and current_user.firebase_uid:
            uid = current_user.firebase_uid
            # Update users/{uid} — add "affiliate" to the roles array
            user_ref = fs_db.collection("users").document(uid)
            user_snap = user_ref.get()
            if user_snap.exists:
                existing_data = user_snap.to_dict()
                roles = existing_data.get("roles", [existing_data.get("role", "customer")])
                if "affiliate" not in roles:
                    roles.append("affiliate")
                user_ref.set({"role": "affiliate", "roles": roles, "updatedAt": _dt.utcnow().isoformat() + "Z"}, merge=True)
            else:
                user_ref.set({
                    "uid": uid,
                    "role": "affiliate",
                    "roles": ["affiliate"],
                    "email": current_user.email,
                    "updatedAt": _dt.utcnow().isoformat() + "Z",
                }, merge=True)

            # Create/update affiliates/{uid} doc — required by AuthContext login role check
            aff_ref = fs_db.collection("affiliates").document(uid)
            aff_snap = aff_ref.get()
            if not aff_snap.exists:
                aff_ref.set({
                    "userId": uid,
                    "affiliateCode": profile.referral_code,
                    "status": "active",
                    "commissionRate": profile.commission_rate,
                    "totalClicks": 0,
                    "totalConversions": 0,
                    "totalRevenue": 0,
                    "totalCommission": 0,
                    "pendingCommission": 0,
                    "paidCommission": 0,
                    "createdAt": _dt.utcnow().isoformat() + "Z",
                    "fullName": current_user.name,
                    "email": current_user.email,
                })
    except Exception as fs_err:
        import logging as _log
        _log.warning(f"[affiliate/activate] Firestore sync non-fatal: {fs_err}")
        # Non-blocking — SQLite is the source of truth

    # Step 4: Issue a new backend JWT with active_role=affiliate
    token_data = {"sub": str(current_user.id), "active_role": "affiliate"}
    access_token = create_access_token(token_data)

    return {
        "message": "Affiliate access activated successfully.",
        "access_token": access_token,
        "token_type": "bearer",
        "referral_code": profile.referral_code if profile else None,
        "already_active": already_affiliate,
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": "affiliate",
            "is_active": current_user.is_active,
            "is_verified": current_user.is_verified,
            "firebase_uid": current_user.firebase_uid,
            "sqlite_user_id": current_user.id,
        }
    }

def _get_affiliate_profile(user: User, db: Session) -> AffiliateProfile:
    """
    Return the AffiliateProfile for the authenticated user, creating one
    on first access safely with concurrency protection.
    """
    profile = db.query(AffiliateProfile).filter(
        AffiliateProfile.user_id == user.id
    ).first()

    if profile:
        return profile

    # Only allow for vendors, affiliates, admins. Active check.
    if user.role not in ("vendor", "affiliate", "admin") or not user.is_active:
        raise HTTPException(status_code=403, detail="Not eligible for Affiliate profile")

    # Use a nested transaction (savepoint) to handle potential race conditions
    try:
        with db.begin_nested():
            profile = AffiliateProfile(
                user_id=user.id,
                referral_code=f"AFF{user.id:04d}",
                commission_rate=20.0,
                total_earnings=0.0,
                total_clicks=0,
                total_sales=0,
                is_active=True,
                status="active"
            )
            db.add(profile)
            
            # Activity Logging
            ActivityLogService.log_user_activity(
                db=db,
                user_id=user.id,
                activity_type="affiliate_enrollment",
                details="Affiliate profile automatically created."
            )
            ActivityLogService.log_admin_audit(
                db=db,
                admin_user_id=1,  # System attribution
                action="auto_affiliate_enrollment",
                target_type="user",
                target_id=str(user.id),
                metadata_dict={"event": "Profile created automatically"}
            )
            
            # Notification
            notification = Notification(
                user_id=user.id,
                title="Welcome to Affiliate Program",
                message="Welcome! Your Affiliate account has been created successfully.",
                category="general"
            )
            db.add(notification)
        db.commit()
        db.refresh(profile)
    except IntegrityError:
        db.rollback()
        # Another request created it during the race window, fetch the existing one
        profile = db.query(AffiliateProfile).filter(
            AffiliateProfile.user_id == user.id
        ).first()

    return profile


def _build_stats(profile: AffiliateProfile, commissions: list) -> AffiliateStats:
    """Compute aggregated stats from profile + commission rows."""
    paid    = sum(c.commission_amt for c in commissions if getattr(c, 'commission_status', c.status) == "paid" or c.status == "paid")
    pending = sum(c.commission_amt for c in commissions if getattr(c, 'commission_status', c.status) in ("pending", "approved", "ready_for_payout") or c.status in ("pending", "approved", "ready_for_payout"))
    revenue = sum(c.sale_amount for c in commissions if c.sale_amount is not None)
    conv    = round(
        (profile.total_sales / profile.total_clicks * 100), 2
    ) if profile.total_clicks else 0.0
    return AffiliateStats(
        total_earnings=profile.total_earnings,
        total_clicks=profile.total_clicks,
        total_sales=profile.total_sales,
        pending_earnings=pending,
        paid_earnings=paid,
        revenue_generated=revenue,
        conversion_rate=conv,
        referral_code=profile.referral_code,
        referral_link=f"{SITE_URL}?ref={profile.referral_code}",
    )


def _build_top_products(commissions: list, limit: int = 5) -> list[TopProductItem]:
    """Aggregate commissions by product name and return top performers."""
    product_map: dict[str, dict] = {}
    for c in commissions:
        name = c.product_name or "Unknown Product"
        if name not in product_map:
            product_map[name] = {"sales": 0, "commission": 0.0, "revenue": 0.0}
        product_map[name]["sales"]      += 1
        product_map[name]["commission"] += c.commission_amt or 0.0
        product_map[name]["revenue"]    += c.sale_amount or 0.0

    return [
        TopProductItem(
            product_name=name,
            total_sales=v["sales"],
            commission_earned=round(v["commission"], 2),
            revenue_generated=round(v["revenue"], 2),
        )
        for name, v in sorted(
            product_map.items(), key=lambda x: x[1]["commission"], reverse=True
        )
    ][:limit]


def _build_monthly_earnings(commissions: list, months: int = 12) -> list[MonthlyEarningsItem]:
    """
    Aggregate commissions into a rolling N-month earnings series
    ending at the current month.
    """
    now = datetime.utcnow()
    # Build a dict keyed by (year, month)
    bucket: dict[tuple, dict] = {}
    for i in range(months - 1, -1, -1):
        month_ord = now.month - i
        year = now.year
        while month_ord <= 0:
            month_ord += 12
            year -= 1
        key = (year, month_ord)
        bucket[key] = {"earnings": 0.0, "sales": 0}

    for c in commissions:
        if not c.created_at:
            continue
        d = c.created_at
        key = (d.year, d.month)
        if key in bucket:
            bucket[key]["earnings"] += c.commission_amt or 0.0
            bucket[key]["sales"]    += 1

    result = []
    for (y, m), v in bucket.items():
        label = datetime(y, m, 1).strftime("%b %Y")
        result.append(MonthlyEarningsItem(
            month=label,
            earnings=round(v["earnings"], 2),
            sales=v["sales"],
        ))
    return result


# -- Profile --------------------------------------------------------------------

@router.get("/profile", response_model=AffiliateProfileResponse)
def get_profile(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    _active = Depends(verify_affiliate_active)
):
    """Get (or lazily create) the affiliate profile for the current user."""
    return _get_affiliate_profile(current_user, db)


@router.put("/profile", response_model=AffiliateProfileResponse)
def update_profile(
    data: AffiliateProfileUpdate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    _active = Depends(verify_affiliate_active)
):
    """Update payment / contact details on the affiliate profile."""
    profile = _get_affiliate_profile(current_user, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)
    return profile


# -- Stats ----------------------------------------------------------------------

@router.get("/stats", response_model=AffiliateStats)
def get_stats(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    _active = Depends(verify_affiliate_active)
):
    """Return aggregated performance stats for the dashboard."""
    profile = _get_affiliate_profile(current_user, db)
    commissions = db.query(AffiliateCommission).filter(
        AffiliateCommission.affiliate_id == profile.id
    ).all()
    return _build_stats(profile, commissions)


# -- Dashboard Summary ----------------------------------------------------------

@router.get("/dashboard", response_model=DashboardSummaryResponse)
def get_dashboard(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    _active = Depends(verify_affiliate_active)
):
    """
    Single-call dashboard summary: stats + recent commissions +
    recent payouts + top products + monthly earnings.
    Replaces the need for 4 separate parallel frontend calls.
    """
    profile = _get_affiliate_profile(current_user, db)

    commissions = (
        db.query(AffiliateCommission)
        .filter(AffiliateCommission.affiliate_id == profile.id)
        .order_by(AffiliateCommission.created_at.desc())
        .all()
    )
    payouts = (
        db.query(AffiliatePayout)
        .filter(AffiliatePayout.affiliate_id == profile.id)
        .order_by(AffiliatePayout.created_at.desc())
        .all()
    )

    logger.info(
        "[REFERRAL] Dashboard query: user_id=%s, affiliate_id=%s, commissions_found=%s, payouts_found=%s",
        current_user.id, profile.id, len(commissions), len(payouts)
    )

    return DashboardSummaryResponse(
        stats=_build_stats(profile, commissions),
        recent_commissions=commissions[:5],
        recent_payouts=payouts[:3],
        top_products=_build_top_products(commissions, limit=5),
        monthly_earnings=_build_monthly_earnings(commissions, months=12),
    )


# -- Commissions ----------------------------------------------------------------

@router.get("/commissions", response_model=List[CommissionResponse])
def get_commissions(
    status: Optional[str] = Query(None, description="Filter: pending|approved|paid"),
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    _active = Depends(verify_affiliate_active)
):
    """Return the full commission history for the affiliate."""
    profile = _get_affiliate_profile(current_user, db)
    q = db.query(AffiliateCommission).filter(
        AffiliateCommission.affiliate_id == profile.id
    )
    if status:
        q = q.filter(AffiliateCommission.status == status)
    return q.order_by(AffiliateCommission.created_at.desc()).all()


@router.get("/conversions", response_model=List[ConversionItemResponse])
def get_conversions(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    _active = Depends(verify_affiliate_active)
):
    """
    Return all server-backed conversion records for the authenticated affiliate.
    Lists every distinct referred purchase with customer identity, product details,
    order ID, referral/coupon code used, attribution source, sale amount, commission earned, and status.
    """
    profile = _get_affiliate_profile(current_user, db)
    commissions = (
        db.query(AffiliateCommission)
        .filter(AffiliateCommission.affiliate_id == profile.id)
        .order_by(AffiliateCommission.created_at.desc())
        .all()
    )

    results = []
    for c in commissions:
        # Mask customer email for privacy compliance (e.g. j***@domain.com)
        masked_email = None
        if c.customer_email:
            parts = c.customer_email.split("@")
            if len(parts) == 2:
                user_part = parts[0]
                masked_user = user_part[0] + "***" if len(user_part) > 1 else "*"
                masked_email = f"{masked_user}@{parts[1]}"
            else:
                masked_email = "c***@lumora.com"

        results.append(ConversionItemResponse(
            id=c.id,
            order_id=c.order_id or 0,
            product_id=c.product_id,
            product_name=c.product_name or f"Product #{c.product_id}",
            customer_name=c.customer_name or "Customer",
            customer_email=masked_email,
            referral_code=c.referral_code_used or profile.referral_code,
            attribution_source=c.attribution_source or "referral_link",
            coupon_code=c.coupon_code,
            purchase_amount=round(c.sale_amount or 0.0, 2),
            commission_earned=round(c.commission_amt or 0.0, 2),
            commission_rate=c.commission_rate or 20.0,
            status=c.commission_status or c.status or "approved",
            created_at=c.created_at or datetime.utcnow()
        ))

    return results


@router.post("/commissions", response_model=CommissionResponse, status_code=201)
def create_commission(data: CommissionCreate, db: Session = Depends(get_db)):
    """
    Internal endpoint - called by the orders service when a purchase
    is traced to an affiliate referral code.
    """
    commission = AffiliateCommission(**data.model_dump())
    db.add(commission)

    # Update running totals on the profile
    profile = db.query(AffiliateProfile).filter(
        AffiliateProfile.id == data.affiliate_id
    ).first()
    if profile:
        profile.total_earnings += data.commission_amt
        profile.total_sales    += 1

    db.commit()
    db.refresh(commission)
    return commission


# -- Payouts --------------------------------------------------------------------

@router.get("/payouts", response_model=List[PayoutResponse])
def get_payouts(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    _active = Depends(verify_affiliate_active)
):
    """Return payout history for the affiliate."""
    profile = _get_affiliate_profile(current_user, db)
    return (
        db.query(AffiliatePayout)
        .filter(AffiliatePayout.affiliate_id == profile.id)
        .order_by(AffiliatePayout.created_at.desc())
        .all()
    )


@router.post("/payouts", response_model=PayoutResponse, status_code=201)
def request_payout(
    data: PayoutRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    _active = Depends(verify_affiliate_active)
):
    """
    Submit a payout / withdrawal request.

    Validations:
    ? Amount must be positive.
    ? Amount must be ? MIN_PAYOUT_INR (?500).
    ? No other pending payout must already exist (duplicate prevention).
    ? Requested amount must not exceed the available approved balance.
    """
    # ? Positive amount (also enforced by Pydantic gt=0)
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Payout amount must be positive.")

    # ? Minimum payout threshold
    if data.amount < MIN_PAYOUT_INR:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum payout amount is ?{int(MIN_PAYOUT_INR)}. "
                   f"Requested: ?{data.amount:.0f}",
        )

    profile = _get_affiliate_profile(current_user, db)

    # ? Duplicate pending payout prevention
    existing_pending = db.query(AffiliatePayout).filter(
        AffiliatePayout.affiliate_id == profile.id,
        AffiliatePayout.status == "pending",
    ).first()
    if existing_pending:
        raise HTTPException(
            status_code=409,
            detail=(
                f"You already have a pending payout of ?{existing_pending.amount:.0f}. "
                "Please wait for it to be processed before requesting another."
            ),
        )

    # ✓ Check available approved balance
    # IMPORTANT: Check commission_status first (canonical field).
    # Fallback to legacy 'status' field for backward compatibility.
    # Admin approval sets commission_status="approved" via PATCH /admin/affiliates/commissions/{id}/status
    from sqlalchemy import or_ as _or
    approved_commissions = db.query(AffiliateCommission).filter(
        AffiliateCommission.affiliate_id == profile.id,
        _or(
            AffiliateCommission.commission_status == "approved",
            AffiliateCommission.status == "approved",
        ),
    ).all()
    available = sum(c.commission_amt for c in approved_commissions)


    if data.amount > available:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Requested ?{data.amount:.0f} exceeds available approved "
                f"balance of ?{available:.0f}."
            ),
        )

    payout = AffiliatePayout(
        affiliate_id=profile.id,
        amount=data.amount,
        method=data.method,
        upi_id=data.upi_id,
        bank_account=data.bank_account,
        status="pending",
    )
    try:
        db.add(payout)
        db.commit()
        db.refresh(payout)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to submit payout request. Please try again.",
        ) from e

    # Structured log
    from app.utils.logger import log_structured_event
    log_structured_event(
        user_id=current_user.id,
        role=current_user.role,
        action="payout_requested",
        module="affiliate",
        status="success",
        details=f"Affiliate payout requested: ?{payout.amount:.2f} via {payout.method}",
    )

    return payout


# -- Analytics -----------------------------------------------------------------

@router.get("/analytics", response_model=AnalyticsResponse)
def get_analytics(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    _active = Depends(verify_affiliate_active)
):
    """
    Detailed analytics: top products, monthly earnings, conversion metrics,
    revenue generated, and commission breakdown.
    """
    profile = _get_affiliate_profile(current_user, db)
    commissions = (
        db.query(AffiliateCommission)
        .filter(AffiliateCommission.affiliate_id == profile.id)
        .order_by(AffiliateCommission.created_at.desc())
        .all()
    )

    revenue_generated   = sum(c.sale_amount    or 0 for c in commissions)
    total_earned        = sum(c.commission_amt or 0 for c in commissions)
    paid_earned         = sum(c.commission_amt or 0 for c in commissions if c.status == "paid")
    pending_earned      = sum(c.commission_amt or 0 for c in commissions if c.status == "pending")
    conv = round(
        (profile.total_sales / profile.total_clicks * 100), 2
    ) if profile.total_clicks else 0.0

    return AnalyticsResponse(
        total_clicks=profile.total_clicks,
        total_sales=profile.total_sales,
        conversion_rate=conv,
        revenue_generated=round(revenue_generated, 2),
        total_commission_earned=round(total_earned, 2),
        pending_earnings=round(pending_earned, 2),
        paid_earnings=round(paid_earned, 2),
        top_products=_build_top_products(commissions, limit=10),
        monthly_earnings=_build_monthly_earnings(commissions, months=12),
    )


# -- Reports -------------------------------------------------------------------

@router.get("/reports", response_model=ReportResponse)
def get_reports(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    _active = Depends(verify_affiliate_active)
):
    """
    Full affiliate report: all commissions and payouts formatted for
    display or export (referral, commission, earnings, payout report).
    """
    profile = _get_affiliate_profile(current_user, db)

    commissions = (
        db.query(AffiliateCommission)
        .filter(AffiliateCommission.affiliate_id == profile.id)
        .order_by(AffiliateCommission.created_at.desc())
        .all()
    )
    payouts = (
        db.query(AffiliatePayout)
        .filter(AffiliatePayout.affiliate_id == profile.id)
        .order_by(AffiliatePayout.created_at.desc())
        .all()
    )

    revenue_generated = sum(c.sale_amount    or 0 for c in commissions)
    total_earned      = sum(c.commission_amt or 0 for c in commissions)
    paid_earned       = sum(c.commission_amt or 0 for c in commissions if c.status in ("paid",))
    pending_earned    = sum(c.commission_amt or 0 for c in commissions if c.status == "pending")

    commission_items = [
        CommissionReportItem(
            id=c.id,
            product_name=c.product_name,
            sale_amount=c.sale_amount,
            commission_amt=c.commission_amt,
            status=c.status,
            date=c.created_at.strftime("%Y-%m-%d") if c.created_at else "-",
        )
        for c in commissions
    ]

    payout_items = [
        PayoutReportItem(
            id=p.id,
            amount=p.amount,
            method=p.method,
            status=p.status,
            date=p.created_at.strftime("%Y-%m-%d") if p.created_at else "-",
        )
        for p in payouts
    ]

    return ReportResponse(
        period="All time",
        total_commissions=len(commissions),
        total_payout_requests=len(payouts),
        total_revenue_referred=round(revenue_generated, 2),
        total_earned=round(total_earned, 2),
        total_paid=round(paid_earned, 2),
        total_pending=round(pending_earned, 2),
        commissions=commission_items,
        payouts=payout_items,
    )


# -- Referral Links -------------------------------------------------------------

@router.get("/referral-links", response_model=List[ReferralLinkResponse])
def get_referral_links(
    product_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    _active = Depends(verify_affiliate_active)
):
    """Retrieve all custom referral links generated by the affiliate."""
    profile = _get_affiliate_profile(current_user, db)
    q = db.query(ReferralLink).filter(ReferralLink.affiliate_id == profile.id)
    if product_id is not None:
        q = q.filter(ReferralLink.product_id == product_id)
    links = q.order_by(ReferralLink.created_at.desc()).all()
    for link in links:
        link.referral_url = f"{SITE_URL}/#product/{link.product_id}?ref={link.referral_code}"
    return links


@router.post("/referral-links", response_model=ReferralLinkResponse, status_code=201)
def create_referral_link(
    data: ReferralLinkCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    _active = Depends(verify_affiliate_active)
):
    """Generate a custom referral link for a specific product."""
    profile = _get_affiliate_profile(current_user, db)

    # Validate product exists
    from app.utils.db_sync import get_product_by_id
    product = get_product_by_id(db, data.product_id)
    if not product:
        raise HTTPException(
            status_code=404,
            detail=f"Product with ID {data.product_id} not found."
        )

    # Prevent duplicate custom links for the same product + alias name (if alias provided)
    existing = db.query(ReferralLink).filter(
        ReferralLink.affiliate_id == profile.id,
        ReferralLink.product_id == data.product_id,
        ReferralLink.name == data.name
    ).first()
    if existing:
        existing.referral_url = f"{SITE_URL}/#product/{existing.product_id}?ref={existing.referral_code}"
        return existing

    # Generate unique referral code: AFF + user_id + prod_id + 4 chars
    unique_code = f"AFF{current_user.id}P{data.product_id}C{uuid.uuid4().hex[:4].upper()}"

    # Verify uniqueness in DB (just in case)
    while db.query(ReferralLink).filter(ReferralLink.referral_code == unique_code).first():
        unique_code = f"AFF{current_user.id}P{data.product_id}C{uuid.uuid4().hex[:4].upper()}"

    link = ReferralLink(
        affiliate_id=profile.id,
        product_id=data.product_id,
        referral_code=unique_code,
        name=data.name or f"Campaign {uuid.uuid4().hex[:4].upper()}",
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    link.referral_url = f"{SITE_URL}/#product/{link.product_id}?ref={link.referral_code}"
    return link


@router.delete("/referral-links/{link_id}", status_code=204)
def delete_referral_link(
    link_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
    _active = Depends(verify_affiliate_active)
):
    """Delete a custom referral link."""
    profile = _get_affiliate_profile(current_user, db)
    link = db.query(ReferralLink).filter(ReferralLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Referral link not found.")
    if link.affiliate_id != profile.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this referral link.")

    db.delete(link)
    db.commit()
    return


# -- Click Tracking -------------------------------------------------------------

@router.post("/track-click/{referral_code}", response_model=ClickTrackResponse)
def track_click(
    referral_code: str,
    request: Request,
    user_agent: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Increment click counter when a visitor lands via a referral link.
    Tracks both default affiliate codes and custom referral link codes.
    No auth required - called client-side when ?ref=CODE is detected.
    Includes 10-second IP deduplication.
    """
    code_upper = referral_code.upper()
    client_ip = request.client.host if request.client else None
    now = datetime.utcnow()
    cutoff = now - timedelta(seconds=10)

    # 1. Check if it's a custom referral link code
    custom_link = db.query(ReferralLink).filter(
        ReferralLink.referral_code == code_upper
    ).first()

    if custom_link:
        if custom_link.is_active:

            
            # LOCK THE PROFILE ROW to serialize concurrent requests from React Strict Mode double-fetches
            # This prevents the Read-Modify-Write race condition when multiple workers process requests simultaneously
            is_postgres = "postgres" in db.get_bind().dialect.name
            profile_query = db.query(AffiliateProfile).filter(
                AffiliateProfile.id == custom_link.affiliate_id
            )
            aff_profile = profile_query.with_for_update().first() if is_postgres else profile_query.first()
            if aff_profile:
                aff_user = db.query(User).filter(User.id == aff_profile.user_id).first()
                if not aff_user or not aff_user.is_active:
                    raise HTTPException(status_code=403, detail="Affiliate account is suspended")

                # Deduplication Check
                time_threshold = cutoff
                query_legacy = db.query(ReferralClick).filter(
                    ReferralClick.affiliate_id == custom_link.affiliate_id,
                    ReferralClick.referral_link_id == custom_link.id,
                    ReferralClick.clicked_at >= time_threshold
                )
                query_ent = db.query(AffiliateReferral).filter(
                    AffiliateReferral.referral_code == code_upper,
                    AffiliateReferral.clicked_at >= time_threshold
                )
                
                if client_ip:
                    query_legacy = query_legacy.filter(ReferralClick.ip_address == client_ip)
                    query_ent = query_ent.filter(AffiliateReferral.ip_address == client_ip)
                elif user_agent:
                    query_legacy = query_legacy.filter(ReferralClick.user_agent == user_agent)
                    query_ent = query_ent.filter(AffiliateReferral.user_agent == user_agent)
                    
                recent_click = query_legacy.first()
                recent_ent_click = query_ent.first()
                
                if recent_click or recent_ent_click:
                    return ClickTrackResponse(tracked=True, referral_code=code_upper)

                custom_link.clicks_count += 1
                aff_profile.total_clicks += 1

                click = ReferralClick(
                    referral_link_id=custom_link.id,
                    affiliate_id=custom_link.affiliate_id,
                    ip_address=client_ip,
                    user_agent=user_agent,
                    clicked_at=now
                )
                db.add(click)
                db.commit()
                return ClickTrackResponse(tracked=True, referral_code=code_upper)
            # aff_profile not found — fall through to 404 at end
        else:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Referral link is inactive.",
            )

    # 2. Check if it's a default affiliate profile referral code
    # LOCK THE PROFILE ROW to serialize concurrent requests from React Strict Mode double-fetches
    is_postgres = "postgres" in db.get_bind().dialect.name
    profile_query = db.query(AffiliateProfile).filter(
        AffiliateProfile.referral_code == code_upper
    )
    profile = profile_query.with_for_update().first() if is_postgres else profile_query.first()

    if profile and profile.is_active:

        
        # Verify affiliate is active
        aff_user = db.query(User).filter(User.id == profile.user_id).first()
        if not aff_user or not aff_user.is_active:
            raise HTTPException(status_code=403, detail="Affiliate account is suspended")

        # Deduplication Check
        time_threshold = cutoff
        query_legacy = db.query(ReferralClick).filter(
            ReferralClick.affiliate_id == profile.id,
            ReferralClick.referral_link_id == None,
            ReferralClick.clicked_at >= time_threshold
        )
        query_ent = db.query(AffiliateReferral).filter(
            AffiliateReferral.referral_code == code_upper,
            AffiliateReferral.clicked_at >= time_threshold
        )
        
        if client_ip:
            query_legacy = query_legacy.filter(ReferralClick.ip_address == client_ip)
            query_ent = query_ent.filter(AffiliateReferral.ip_address == client_ip)
        elif user_agent:
            query_legacy = query_legacy.filter(ReferralClick.user_agent == user_agent)
            query_ent = query_ent.filter(AffiliateReferral.user_agent == user_agent)
            
        recent_click = query_legacy.first()
        recent_ent_click = query_ent.first()
        
        if recent_click or recent_ent_click:
            return ClickTrackResponse(tracked=True, referral_code=code_upper)

        profile.total_clicks += 1

        click = ReferralClick(
            referral_link_id=None,
            affiliate_id=profile.id,
            ip_address=client_ip,
            user_agent=user_agent,
            clicked_at=now
        )
        db.add(click)

        # Also create an AffiliateReferral row (product_id=None) so purchase_service
        # Tier 3 can find this referral by customer_id after login/authenticate.
        session_id = f"REF_SESS_{uuid.uuid4().hex}"
        referral_row = AffiliateReferral(
            affiliate_id=profile.id,
            referral_code=code_upper,
            product_id=None,    # No product in URL — Tier 3 matches by customer_id only
            session_id=session_id,
            status="CLICKED",
            ip_address=client_ip,
            user_agent=user_agent,
            clicked_at=now,
        )
        db.add(referral_row)

        db.commit()
        logger.info(
            "[track_click] Click + AffiliateReferral saved: code=%s, affiliate_id=%s, session_id=%s",
            code_upper, profile.id, session_id,
        )
        return ClickTrackResponse(tracked=True, referral_code=code_upper)

    # 3. Fallback: Check Firestore adminReferralLinks
    try:
        from admin_controls.referral.service import AdminReferralService
        campaign = AdminReferralService.find_campaign(code_upper)
        if campaign:
            if campaign.get("status") == "active":
                AdminReferralService.increment_click(campaign["ref"])
                return ClickTrackResponse(tracked=True, referral_code=code_upper)
            else:
                raise HTTPException(
                    status_code=http_status.HTTP_403_FORBIDDEN,
                    detail="Referral link is inactive."
                )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[track_click] AdminReferralService fallback failed for code=%s: %s", code_upper, exc)
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Referral service temporarily unavailable."
        )

    # 4. Code not found anywhere
    raise HTTPException(
        status_code=http_status.HTTP_404_NOT_FOUND,
        detail="Referral code not found.",
    )


# -- Persistent Referral Lifecycle Endpoints ------------------------------------

@router.post("/referrals/click", response_model=ReferralClickResponse)
def create_referral_click(
    payload: ReferralClickRequest,
    request: Request,
    user_agent: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Validate product & referral code, create persistent AffiliateReferral record in PostgreSQL,
    and return unique session_id for authentication & purchase attribution.
    """
    code_upper = payload.referral_code.strip().upper()
    client_ip = request.client.host if request.client else None

    # 1. Validate Product exists
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Referred product not found.")

    # 2. Validate Affiliate by code (custom link or profile code)
    affiliate_id = None
    custom_link = db.query(ReferralLink).filter(ReferralLink.referral_code == code_upper).first()
    if custom_link and custom_link.is_active:
        affiliate_id = custom_link.affiliate_id
    else:
        profile = db.query(AffiliateProfile).filter(AffiliateProfile.referral_code == code_upper).first()
        if profile and profile.is_active:
            affiliate_id = profile.id

    if not affiliate_id:
        raise HTTPException(status_code=404, detail="Invalid or inactive referral code.")

    # LOCK THE PROFILE ROW to serialize concurrent requests from React Strict Mode double-fetches
    # This prevents the Read-Modify-Write race condition when multiple workers process requests simultaneously
    is_postgres = "postgres" in db.get_bind().dialect.name
    profile_query = db.query(AffiliateProfile).filter(AffiliateProfile.id == affiliate_id)
    locked_profile = profile_query.with_for_update().first() if is_postgres else profile_query.first()



    # Database deduplication
    time_threshold = datetime.utcnow() - timedelta(seconds=10)
    
    query = db.query(AffiliateReferral).filter(
        AffiliateReferral.referral_code == code_upper,
        AffiliateReferral.product_id == product.id,
        AffiliateReferral.clicked_at >= time_threshold
    )
    
    if client_ip:
        query = query.filter(AffiliateReferral.ip_address == client_ip)
    elif user_agent:
        query = query.filter(AffiliateReferral.user_agent == user_agent)
        
    recent_click = query.first()

    if recent_click:
        logger.info("[REFERRAL] Deduplicated click for code %s", code_upper)
        return ReferralClickResponse(
            session_id=recent_click.session_id,
            referral_code=code_upper,
            product_id=product.id,
            status=recent_click.status or "CLICKED",
            is_valid=True
        )

    # Generate server-side unique session ID
    session_id = f"REF_SESS_{uuid.uuid4().hex}"

    # Record persistent AffiliateReferral in PostgreSQL
    referral = AffiliateReferral(
        affiliate_id=affiliate_id,
        referral_code=code_upper,
        product_id=product.id,
        session_id=session_id,
        status="CLICKED",
        ip_address=client_ip,
        user_agent=user_agent,
        clicked_at=datetime.utcnow()
    )
    db.add(referral)

    # Increment click count on profile/link
    if custom_link:
        # Also lock the custom link if applicable
        locked_link = db.query(ReferralLink).filter(ReferralLink.id == custom_link.id).with_for_update().first()
        if locked_link:
            locked_link.clicks_count = (locked_link.clicks_count or 0) + 1
            
    if locked_profile:
        locked_profile.total_clicks = (locked_profile.total_clicks or 0) + 1

    db.commit()

    logger.info(
        "[REFERRAL] Referral click saved: referral_code=%s, product_id=%s, affiliate_id=%s, session_id=%s",
        code_upper, product.id, affiliate_id, session_id
    )

    return ReferralClickResponse(
        session_id=session_id,
        referral_code=code_upper,
        product_id=product.id,
        status="CLICKED",
        is_valid=True
    )


@router.post("/referrals/authenticate")
def authenticate_referral(
    payload: ReferralAuthRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """
    Associate authenticated customer with pending referral session in PostgreSQL.
    Updates status to AUTHENTICATED.
    """
    referral = None
    if payload.session_id:
        referral = db.query(AffiliateReferral).filter(AffiliateReferral.session_id == payload.session_id).first()

    if not referral and payload.referral_code and payload.product_id:
        referral = db.query(AffiliateReferral).filter(
            AffiliateReferral.referral_code == payload.referral_code.strip().upper(),
            AffiliateReferral.product_id == payload.product_id,
            AffiliateReferral.customer_id.is_(None)
        ).order_by(AffiliateReferral.created_at.desc()).first()

    # Extra fallback: handle rows created by track-click (no product_id in the URL)
    if not referral and payload.referral_code:
        referral = db.query(AffiliateReferral).filter(
            AffiliateReferral.referral_code == payload.referral_code.strip().upper(),
            AffiliateReferral.product_id.is_(None),
            AffiliateReferral.customer_id.is_(None)
        ).order_by(AffiliateReferral.created_at.desc()).first()

    if not referral:
        logger.info("[REFERRAL] Authenticate called but no pending referral found: payload=%s", payload.model_dump() if hasattr(payload, 'model_dump') else payload)
        return {"status": "NO_PENDING_REFERRAL", "message": "No pending referral found to associate."}

    # Associate customer and update lifecycle state
    referral.customer_id = current_user.id
    if referral.status in ("CLICKED", None):
        referral.status = "AUTHENTICATED"
    referral.authenticated_at = datetime.utcnow()
    db.commit()

    logger.info(
        "[REFERRAL] User authenticated, referral linked: customer_id=%s, referral_code=%s, product_id=%s, session_id=%s",
        current_user.id, referral.referral_code, referral.product_id, referral.session_id
    )

    return {
        "status": referral.status,
        "product_id": referral.product_id,
        "referral_code": referral.referral_code,
        "session_id": referral.session_id,
        "customer_id": current_user.id
    }


@router.post("/referrals/view")
def record_referral_product_view(
    payload: ReferralViewRequest,
    db: Session = Depends(get_db)
):
    """
    Update referral status to PRODUCT_VIEWED.
    """
    if not payload.session_id:
        return {"status": "IGNORED"}

    referral = db.query(AffiliateReferral).filter(AffiliateReferral.session_id == payload.session_id).first()
    if referral and referral.status in ("CLICKED", "AUTHENTICATED"):
        referral.status = "PRODUCT_VIEWED"
        db.commit()
        return {"status": "PRODUCT_VIEWED", "session_id": referral.session_id}

    return {"status": referral.status if referral else "NOT_FOUND"}


@router.get("/referrals/admin-analytics")
def get_admin_referral_analytics(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """
    Admin endpoint returning comprehensive referral conversion analytics and ledger.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin authorization required.")

    referrals = db.query(AffiliateReferral).order_by(AffiliateReferral.created_at.desc()).limit(200).all()

    total_clicks = db.query(AffiliateReferral).count()
    auth_visitors = db.query(AffiliateReferral).filter(AffiliateReferral.customer_id.isnot(None)).count()
    product_views = db.query(AffiliateReferral).filter(AffiliateReferral.status.in_(["PRODUCT_VIEWED", "ADDED_TO_CART", "PURCHASED"])).count()
    purchases = db.query(AffiliateReferral).filter(AffiliateReferral.status == "PURCHASED").count()

    conversion_rate = round((purchases / total_clicks * 100), 2) if total_clicks > 0 else 0.0

    total_revenue = 0.0
    total_commission = 0.0
    commissions = db.query(AffiliateCommission).all()
    for c in commissions:
        total_revenue += float(c.sale_amount or 0)
        total_commission += float(c.commission_amt or 0)

    ledger = []
    for r in referrals:
        aff_name = r.affiliate.display_name if r.affiliate and r.affiliate.display_name else (r.affiliate.user.name if r.affiliate and r.affiliate.user else f"Affiliate #{r.affiliate_id}")
        cust_email = r.customer.email if r.customer else "Guest Visitor"
        prod_name = r.product.title if r.product else f"Product #{r.product_id}"

        ledger.append({
            "id": r.id,
            "session_id": r.session_id,
            "referral_code": r.referral_code,
            "affiliate_name": aff_name,
            "product_id": r.product_id,
            "product_title": prod_name,
            "customer_id": r.customer_id,
            "customer_email": cust_email,
            "order_id": r.order_id,
            "status": r.status,
            "clicked_at": r.clicked_at.isoformat() if r.clicked_at else None,
            "authenticated_at": r.authenticated_at.isoformat() if r.authenticated_at else None,
            "converted_at": r.converted_at.isoformat() if r.converted_at else None,
        })

    return {
        "summary": {
            "total_clicks": total_clicks,
            "authenticated_visitors": auth_visitors,
            "product_views": product_views,
            "purchases": purchases,
            "conversion_rate": conversion_rate,
            "total_revenue": round(total_revenue, 2),
            "total_commission": round(total_commission, 2)
        },
        "referrals": ledger
    }


