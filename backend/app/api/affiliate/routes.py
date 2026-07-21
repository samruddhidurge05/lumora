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

from app.db.session import get_db
from app.dependencies import get_current_user_required
from admin.validators.status_checks import verify_affiliate_active
from app.models.user import User
from app.models.product import Product
from app.models.affiliate import AffiliateProfile, AffiliateCommission, AffiliatePayout, ReferralLink, ReferralClick
from app.api.affiliate.schemas import (
    AffiliateProfileResponse, AffiliateProfileUpdate,
    CommissionResponse, CommissionCreate,
    PayoutResponse, PayoutRequest,
    AffiliateStats, ClickTrackResponse,
    DashboardSummaryResponse, AnalyticsResponse, ReportResponse,
    TopProductItem, MonthlyEarningsItem,
    CommissionReportItem, PayoutReportItem,
    ReferralLinkCreate, ReferralLinkResponse,
)

router = APIRouter()

SITE_URL        = os.getenv("VITE_SITE_URL", "http://localhost:5173")
MIN_PAYOUT_INR  = 500.0   # minimum withdrawal amount in INR


from sqlalchemy.exc import IntegrityError
from app.services.activity_log_service import ActivityLogService
from app.models.notification import Notification

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
    paid    = sum(c.commission_amt for c in commissions if c.status == "paid")
    pending = sum(c.commission_amt for c in commissions if c.status == "pending")
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


# ── Profile ────────────────────────────────────────────────────────────────────

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


# ── Stats ──────────────────────────────────────────────────────────────────────

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


# ── Dashboard Summary ──────────────────────────────────────────────────────────

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

    return DashboardSummaryResponse(
        stats=_build_stats(profile, commissions),
        recent_commissions=commissions[:5],
        recent_payouts=payouts[:3],
        top_products=_build_top_products(commissions, limit=5),
        monthly_earnings=_build_monthly_earnings(commissions, months=12),
    )


# ── Commissions ────────────────────────────────────────────────────────────────

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


@router.post("/commissions", response_model=CommissionResponse, status_code=201)
def create_commission(data: CommissionCreate, db: Session = Depends(get_db)):
    """
    Internal endpoint — called by the orders service when a purchase
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


# ── Payouts ────────────────────────────────────────────────────────────────────

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
    ① Amount must be positive.
    ② Amount must be ≥ MIN_PAYOUT_INR (₹500).
    ③ No other pending payout must already exist (duplicate prevention).
    ④ Requested amount must not exceed the available approved balance.
    """
    # ① Positive amount (also enforced by Pydantic gt=0)
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Payout amount must be positive.")

    # ② Minimum payout threshold
    if data.amount < MIN_PAYOUT_INR:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum payout amount is ₹{int(MIN_PAYOUT_INR)}. "
                   f"Requested: ₹{data.amount:.0f}",
        )

    profile = _get_affiliate_profile(current_user, db)

    # ③ Duplicate pending payout prevention
    existing_pending = db.query(AffiliatePayout).filter(
        AffiliatePayout.affiliate_id == profile.id,
        AffiliatePayout.status == "pending",
    ).first()
    if existing_pending:
        raise HTTPException(
            status_code=409,
            detail=(
                f"You already have a pending payout of ₹{existing_pending.amount:.0f}. "
                "Please wait for it to be processed before requesting another."
            ),
        )

    # ④ Check available approved balance
    approved_commissions = db.query(AffiliateCommission).filter(
        AffiliateCommission.affiliate_id == profile.id,
        AffiliateCommission.status == "approved",
    ).all()
    available = sum(c.commission_amt for c in approved_commissions)

    if data.amount > available:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Requested ₹{data.amount:.0f} exceeds available approved "
                f"balance of ₹{available:.0f}."
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
        details=f"Affiliate payout requested: ₹{payout.amount:.2f} via {payout.method}",
    )

    return payout


# ── Analytics ─────────────────────────────────────────────────────────────────

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


# ── Reports ───────────────────────────────────────────────────────────────────

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
            date=c.created_at.strftime("%Y-%m-%d") if c.created_at else "—",
        )
        for c in commissions
    ]

    payout_items = [
        PayoutReportItem(
            id=p.id,
            amount=p.amount,
            method=p.method,
            status=p.status,
            date=p.created_at.strftime("%Y-%m-%d") if p.created_at else "—",
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


# ── Referral Links ─────────────────────────────────────────────────────────────

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


# ── Click Tracking ─────────────────────────────────────────────────────────────

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
    No auth required — called client-side when ?ref=CODE is detected.
    Includes 24-hour IP deduplication.
    """
    code_upper = referral_code.upper()
    client_ip = request.client.host if request.client else None
    now = datetime.utcnow()
    cutoff = now - timedelta(hours=24)

    # 1. Check if it's a custom referral link code
    custom_link = db.query(ReferralLink).filter(
        ReferralLink.referral_code == code_upper
    ).first()

    if custom_link:
        if custom_link.is_active:
            # Verify affiliate is active
            aff_profile = db.query(AffiliateProfile).filter(
                AffiliateProfile.id == custom_link.affiliate_id
            ).first()
            if aff_profile:
                aff_user = db.query(User).filter(User.id == aff_profile.user_id).first()
                if not aff_user or not aff_user.is_active:
                    raise HTTPException(status_code=403, detail="Affiliate account is suspended")

                # Deduplication Check
                if client_ip:
                    recent_click = db.query(ReferralClick).filter(
                        ReferralClick.affiliate_id == custom_link.affiliate_id,
                        ReferralClick.referral_link_id == custom_link.id,
                        ReferralClick.ip_address == client_ip,
                        ReferralClick.clicked_at >= cutoff
                    ).first()
                    if recent_click:
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

    # 2. Check if it's a default affiliate profile referral code
    profile = db.query(AffiliateProfile).filter(
        AffiliateProfile.referral_code == code_upper
    ).first()

    if profile:
        # Verify affiliate is active
        aff_user = db.query(User).filter(User.id == profile.user_id).first()
        if not aff_user or not aff_user.is_active:
            raise HTTPException(status_code=403, detail="Affiliate account is suspended")

        # Deduplication Check
        if client_ip:
            recent_click = db.query(ReferralClick).filter(
                ReferralClick.affiliate_id == profile.id,
                ReferralClick.referral_link_id == None,
                ReferralClick.ip_address == client_ip,
                ReferralClick.clicked_at >= cutoff
            ).first()
            if recent_click:
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
        db.commit()
        return ClickTrackResponse(tracked=True, referral_code=code_upper)

    # 3. Fallback: Check Firestore adminReferralLinks
    if not firebase_connected or fdb is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Referral service temporarily unavailable."
        )

    try:
        from admin_controls.referral.service import AdminReferralService
        campaign = AdminReferralService.find_campaign(code_upper)
        if campaign:
            if campaign.get("status") == "active":
                AdminReferralService.increment_click(campaign["ref"])
                return ClickTrackResponse(tracked=True, referral_code=code_upper)
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Referral link is inactive."
                )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[track_click] AdminReferralService fallback failed for code=%s: %s", code_upper, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Referral service temporarily unavailable."
        )

    # 4. Code not found anywhere
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Referral code not found.",
    )

