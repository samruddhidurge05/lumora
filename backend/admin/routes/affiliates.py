import logging
import csv
import io
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, String, desc, or_
from typing import Optional
from admin.validators.admin_auth import require_admin_role
from admin_controls.affiliate.services import update_affiliate_status
from app.shared.firebase.connection import db as fdb, firebase_connected
from app.db.session import get_db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.models.affiliate import AffiliateProfile, AffiliateCommission, AffiliatePayout, ReferralLink, ReferralClick
from app.models.product import Product
from app.models.order import Order
from app.services.audit_log_service import log_admin_action

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Pydantic Schemas ───────────────────────────────────────────────────────────

class AffiliateStatusUpdateSchema(BaseModel):
    status: str


class CommissionStatusPatch(BaseModel):
    commission_status: str  # pending|approved|ready_for_payout|paid|reversed|rejected|archived
    admin_notes: Optional[str] = None


class PayoutStatusPatch(BaseModel):
    status: str  # pending|completed|rejected
    notes: Optional[str] = None


# ── Existing Endpoints (UNCHANGED) ─────────────────────────────────────────────

@router.get("/")
def list_affiliates(admin_user=Depends(require_admin_role), db: Session = Depends(get_db)):
    """List all affiliates with performance metrics, merging SQL and Firestore data."""
    # Always query SQL AffiliateProfile records to capture real marketplace purchases & earnings
    profiles = (
        db.query(AffiliateProfile, User)
        .join(User, AffiliateProfile.user_id == User.id)
        .all()
    )

    result_map = {}
    for aff_profile, u in profiles:
        pending = db.query(func.sum(AffiliateCommission.commission_amt)).filter(
            AffiliateCommission.affiliate_id == aff_profile.id,
            or_(
                AffiliateCommission.commission_status.in_(["pending", "approved", "ready_for_payout"]),
                AffiliateCommission.status.in_(["pending", "approved", "ready_for_payout"])
            )
        ).scalar() or 0.0

        revenue = db.query(func.sum(AffiliateCommission.sale_amount)).filter(
            AffiliateCommission.affiliate_id == aff_profile.id
        ).scalar() or 0.0

        result_map[str(u.id)] = {
            "uid": u.firebase_uid or str(u.id),
            "id": aff_profile.id,
            "name": u.name or aff_profile.display_name or "Affiliate",
            "displayName": u.name or aff_profile.display_name or "Affiliate",
            "email": u.email,
            "role": "affiliate",
            "code": aff_profile.referral_code,
            "affiliateCode": aff_profile.referral_code,
            "status": aff_profile.status if aff_profile.status else ("active" if aff_profile.is_active and u.is_active else "suspended"),
            "createdAt": u.created_at.isoformat() + "Z" if u.created_at else "",
            "joined": u.created_at.strftime("%Y-%m-%d") if u.created_at else "",
            "clicks": aff_profile.total_clicks or 0,
            "totalClicks": aff_profile.total_clicks or 0,
            "sales": aff_profile.total_sales or 0,
            "totalConversions": aff_profile.total_sales or 0,
            "revenue": round(revenue, 2),
            "commission": round(float(aff_profile.total_earnings or 0.0), 2),
            "totalCommission": round(float(aff_profile.total_earnings or 0.0), 2),
            "pending": round(float(pending), 2),
        }

    # Also query users with role='affiliate' in SQL DB who might not have an AffiliateProfile yet
    role_users = db.query(User).filter(User.role.in_(["affiliate", "Affiliate"])).all()
    for u in role_users:
        if str(u.id) not in result_map:
            result_map[str(u.id)] = {
                "uid": u.firebase_uid or str(u.id),
                "id": u.id,
                "name": u.name or "Affiliate",
                "displayName": u.name or "Affiliate",
                "email": u.email,
                "role": "affiliate",
                "code": f"AFF{u.id:04d}",
                "affiliateCode": f"AFF{u.id:04d}",
                "status": "active" if u.is_active else "disabled",
                "createdAt": u.created_at.isoformat() + "Z" if u.created_at else "",
                "joined": u.created_at.strftime("%Y-%m-%d") if u.created_at else "",
                "clicks": 0, "totalClicks": 0, "sales": 0, "totalConversions": 0,
                "revenue": 0.0, "commission": 0.0, "totalCommission": 0.0, "pending": 0.0
            }

    # If Firestore is connected, merge any Firestore-only affiliate documents
    if firebase_connected and fdb is not None:
        try:
            for r_val in ("affiliate", "Affiliate"):
                snap = fdb.collection("users").where("role", "==", r_val).stream()
                for doc in snap:
                    data = doc.to_dict()
                    uid = doc.id
                    # Check if already present by firebase_uid or id
                    if not any(item["uid"] == uid for item in result_map.values()):
                        result_map[uid] = {
                            "uid": uid,
                            "id": uid,
                            "name": data.get("displayName") or data.get("name") or "Affiliate",
                            "displayName": data.get("displayName") or data.get("name") or "Affiliate",
                            "email": data.get("email") or "",
                            "role": "affiliate",
                            "code": data.get("affiliateCode") or data.get("code") or "",
                            "affiliateCode": data.get("affiliateCode") or data.get("code") or "",
                            "status": data.get("accountStatus") or data.get("status") or "active",
                            "createdAt": data.get("createdAt") or "",
                            "joined": data.get("createdAt") or "",
                            "clicks": data.get("totalClicks") or 0,
                            "totalClicks": data.get("totalClicks") or 0,
                            "sales": data.get("totalConversions") or 0,
                            "totalConversions": data.get("totalConversions") or 0,
                            "revenue": float(data.get("totalRevenue") or 0.0),
                            "commission": float(data.get("totalCommission") or 0.0),
                            "totalCommission": float(data.get("totalCommission") or 0.0),
                            "pending": float(data.get("pendingCommission") or 0.0),
                        }
        except Exception as exc:
            logger.error("[list_affiliates] Firestore stream failed: %s", exc)

    return list(result_map.values())


@router.put("/{uid}/status")
def change_affiliate_status(uid: str, payload: AffiliateStatusUpdateSchema, admin_user=Depends(require_admin_role)):
    try:
        update_affiliate_status(uid, payload.status)
        return {"success": True, "message": f"Affiliate status updated to {payload.status}."}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{id}/enable")
def enable_affiliate(id: int, admin_user: User = Depends(require_admin_role), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Affiliate not found")
    user.is_active = True
    audit = AuditLog(admin_user_id=admin_user.id, action="affiliate_enable", target_type="affiliate", target_id=str(id))
    db.add(audit)
    db.commit()
    if firebase_connected and fdb is not None and user.firebase_uid:
        try:
            fdb.collection("users").document(user.firebase_uid).set({"accountStatus": "active"}, merge=True)
        except Exception as exc:
            logger.error("[affiliate_enable] Firestore write failed for uid=%s: %s", user.firebase_uid, exc)
    return {"success": True, "message": f"Affiliate {id} has been enabled."}


@router.post("/{id}/disable")
def disable_affiliate(id: int, admin_user: User = Depends(require_admin_role), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Affiliate not found")
    user.is_active = False
    audit = AuditLog(admin_user_id=admin_user.id, action="affiliate_disable", target_type="affiliate", target_id=str(id))
    db.add(audit)
    db.commit()
    if firebase_connected and fdb is not None and user.firebase_uid:
        try:
            fdb.collection("users").document(user.firebase_uid).set({"accountStatus": "disabled"}, merge=True)
        except Exception as exc:
            logger.error("[affiliate_disable] Firestore write failed for uid=%s: %s", user.firebase_uid, exc)
    return {"success": True, "message": f"Affiliate {id} has been disabled."}


# ── NEW: Phase 2 Operations Console Endpoints ──────────────────────────────────

@router.get("/kpis")
def get_affiliate_kpis(
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin_role)
):
    """Dashboard KPI aggregates for the Affiliate Operations Console overview."""
    total_affiliates = db.query(AffiliateProfile).count()
    approved_affiliates = db.query(AffiliateProfile).filter(AffiliateProfile.status == "active").count()
    suspended_affiliates = db.query(AffiliateProfile).filter(AffiliateProfile.status.in_(["suspended", "disabled"])).count()
    enabled_products = db.query(Product).filter(Product.affiliate_enabled == True).count()

    total_clicks = db.query(func.sum(AffiliateProfile.total_clicks)).scalar() or 0
    unique_clicks = db.query(func.sum(AffiliateProfile.unique_clicks)).scalar() or 0
    total_sales = db.query(func.sum(AffiliateProfile.total_sales)).scalar() or 0
    conversion_rate = round((total_sales / total_clicks * 100), 2) if total_clicks > 0 else 0.0

    revenue_generated = db.query(func.sum(AffiliateCommission.sale_amount)).scalar() or 0.0
    commission_pending = db.query(func.sum(AffiliateCommission.commission_amt)).filter(
        or_(
            AffiliateCommission.commission_status.in_(["pending", "approved", "ready_for_payout"]),
            AffiliateCommission.status.in_(["pending", "approved", "ready_for_payout"])
        )
    ).scalar() or 0.0
    commission_paid = db.query(func.sum(AffiliateCommission.commission_amt)).filter(
        or_(
            AffiliateCommission.commission_status == "paid",
            AffiliateCommission.status == "paid"
        )
    ).scalar() or 0.0
    avg_commission = db.query(func.avg(AffiliateCommission.commission_amt)).scalar() or 0.0

    # Top affiliate by earnings
    top_aff = (
        db.query(AffiliateProfile, User)
        .join(User, AffiliateProfile.user_id == User.id)
        .order_by(desc(AffiliateProfile.total_earnings))
        .first()
    )
    top_affiliate_name = top_aff[1].name if top_aff else "—"

    # Top product by commission volume
    top_prod_row = (
        db.query(AffiliateCommission.product_name, func.sum(AffiliateCommission.commission_amt).label("total"))
        .group_by(AffiliateCommission.product_name)
        .order_by(desc("total"))
        .first()
    )
    top_product_name = top_prod_row[0] if top_prod_row else "—"

    # Average EPC (earnings per click)
    avg_epc = round(commission_paid / total_clicks, 2) if total_clicks > 0 else 0.0

    return {
        "total_affiliates": total_affiliates,
        "approved_affiliates": approved_affiliates,
        "suspended_affiliates": suspended_affiliates,
        "enabled_products": enabled_products,
        "total_clicks": total_clicks,
        "unique_clicks": unique_clicks,
        "total_conversions": total_sales,
        "conversion_rate": conversion_rate,
        "revenue_generated": round(revenue_generated, 2),
        "commission_pending": round(commission_pending, 2),
        "commission_paid": round(commission_paid, 2),
        "avg_commission": round(avg_commission, 2),
        "avg_epc": avg_epc,
        "top_affiliate": top_affiliate_name,
        "top_product": top_product_name,
    }


@router.get("/commissions")
def get_commissions_ledger(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None),
    affiliate_id: Optional[int] = Query(None),
    product_id: Optional[int] = Query(None),
    commission_status: Optional[str] = Query(None),
    purchase_status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin_role)
):
    """Sales Ledger — all affiliate commissions with full detail, filterable."""
    q = (
        db.query(AffiliateCommission, AffiliateProfile, User)
        .join(AffiliateProfile, AffiliateCommission.affiliate_id == AffiliateProfile.id)
        .join(User, AffiliateProfile.user_id == User.id)
    )

    if affiliate_id:
        q = q.filter(AffiliateCommission.affiliate_id == affiliate_id)
    if product_id:
        q = q.filter(AffiliateCommission.product_id == product_id)
    if commission_status:
        q = q.filter(AffiliateCommission.commission_status == commission_status)
    if purchase_status:
        q = q.filter(AffiliateCommission.purchase_status == purchase_status)
    if date_from:
        try:
            q = q.filter(AffiliateCommission.created_at >= datetime.fromisoformat(date_from))
        except Exception:
            pass
    if date_to:
        try:
            q = q.filter(AffiliateCommission.created_at <= datetime.fromisoformat(date_to))
        except Exception:
            pass
    if search:
        s = f"%{search}%"
        q = q.filter(or_(
            AffiliateCommission.product_name.ilike(s),
            AffiliateCommission.customer_name.ilike(s),
            AffiliateCommission.gateway_tx_id.ilike(s),
            User.name.ilike(s),
            AffiliateProfile.referral_code.ilike(s),
            cast(AffiliateCommission.order_id, String).ilike(s),
        ))

    total = q.count()
    rows = q.order_by(desc(AffiliateCommission.created_at)).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for comm, profile, user in rows:
        # Mask customer email
        masked_email = ""
        if comm.customer_email:
            parts = comm.customer_email.split("@")
            masked_email = parts[0][:2] + "***@" + parts[1] if len(parts) == 2 else "***"

        items.append({
            "id": comm.id,
            "order_id": comm.order_id,
            "order_date": comm.created_at.isoformat() + "Z" if comm.created_at else None,
            "product_id": comm.product_id,
            "product_name": comm.product_name or "—",
            "product_price": comm.sale_amount,
            "customer_name": comm.customer_name or "Customer",
            "customer_email_masked": masked_email,
            "affiliate_name": user.name or "Affiliate",
            "affiliate_id": profile.id,
            "affiliate_code": profile.referral_code,
            "commission_type": comm.commission_type or "percentage",
            "commission_rate": comm.commission_rate or 0.0,
            "commission_earned": comm.commission_amt,
            "platform_revenue": round(comm.sale_amount - comm.commission_amt, 2),
            "commission_status": comm.commission_status or comm.status or "pending",
            "purchase_status": comm.purchase_status or "completed",
            "refund_status": comm.refund_status or "none",
            "gateway_tx_id": comm.gateway_tx_id or "—",
            "cookie_attr_date": comm.cookie_attr_date.isoformat() + "Z" if comm.cookie_attr_date else None,
            "last_click_at": comm.last_click_at.isoformat() + "Z" if comm.last_click_at else None,
            "admin_notes": comm.admin_notes or "",
            "approved_at": comm.approved_at.isoformat() + "Z" if comm.approved_at else None,
            "paid_at": comm.paid_at.isoformat() + "Z" if comm.paid_at else None,
            "reversed_at": comm.reversed_at.isoformat() + "Z" if comm.reversed_at else None,
            "refund_deduction": comm.refund_deduction or 0.0,
        })

    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.get("/commissions/export/csv")
def export_commissions_csv(
    commission_status: Optional[str] = Query(None),
    affiliate_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin_role)
):
    """Export commission ledger as CSV."""
    q = (
        db.query(AffiliateCommission, AffiliateProfile, User)
        .join(AffiliateProfile, AffiliateCommission.affiliate_id == AffiliateProfile.id)
        .join(User, AffiliateProfile.user_id == User.id)
    )
    if commission_status:
        q = q.filter(AffiliateCommission.commission_status == commission_status)
    if affiliate_id:
        q = q.filter(AffiliateCommission.affiliate_id == affiliate_id)

    rows = q.order_by(desc(AffiliateCommission.created_at)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Order ID", "Date", "Product", "Product Price", "Customer",
        "Affiliate", "Affiliate Code", "Commission Type", "Rate", "Commission Earned",
        "Platform Revenue", "Commission Status", "Purchase Status", "Refund Status",
        "Gateway TX ID", "Approved At", "Paid At"
    ])
    for comm, profile, user in rows:
        writer.writerow([
            comm.id, comm.order_id,
            comm.created_at.strftime("%Y-%m-%d %H:%M") if comm.created_at else "",
            comm.product_name or "", comm.sale_amount,
            comm.customer_name or "", user.name or "", profile.referral_code,
            comm.commission_type or "percentage", comm.commission_rate or "",
            comm.commission_amt,
            round(comm.sale_amount - comm.commission_amt, 2),
            comm.commission_status or comm.status or "pending",
            comm.purchase_status or "completed",
            comm.refund_status or "none",
            comm.gateway_tx_id or "",
            comm.approved_at.strftime("%Y-%m-%d") if comm.approved_at else "",
            comm.paid_at.strftime("%Y-%m-%d") if comm.paid_at else "",
        ])

    output.seek(0)
    filename = f"lumora_affiliate_commissions_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.patch("/commissions/{commission_id}/status")
def patch_commission_status(
    commission_id: int,
    payload: CommissionStatusPatch,
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin_role)
):
    """Approve / Reject / Mark Paid / Reverse a commission. Updates lifecycle status."""
    comm = db.query(AffiliateCommission).filter(AffiliateCommission.id == commission_id).first()
    if not comm:
        raise HTTPException(status_code=404, detail="Commission not found")

    valid_statuses = {"pending", "approved", "ready_for_payout", "paid", "reversed", "rejected", "archived"}
    if payload.commission_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    old_status = comm.commission_status or comm.status
    comm.commission_status = payload.commission_status
    comm.status = payload.commission_status  # keep legacy field in sync
    if payload.admin_notes:
        comm.admin_notes = payload.admin_notes
    comm.updated_at = datetime.utcnow()

    if payload.commission_status == "approved" and not comm.approved_at:
        comm.approved_at = datetime.utcnow()
    if payload.commission_status == "paid" and not comm.paid_at:
        comm.paid_at = datetime.utcnow()
        # Update affiliate paid_earnings
        profile = db.query(AffiliateProfile).filter(AffiliateProfile.id == comm.affiliate_id).first()
        if profile:
            profile.paid_earnings = (profile.paid_earnings or 0.0) + comm.commission_amt
            profile.pending_earnings = max(0.0, (profile.pending_earnings or 0.0) - comm.commission_amt)
    if payload.commission_status == "reversed":
        comm.reversed_at = datetime.utcnow()
        comm.purchase_status = "refunded"
        profile = db.query(AffiliateProfile).filter(AffiliateProfile.id == comm.affiliate_id).first()
        if profile:
            profile.rejected_earnings = (profile.rejected_earnings or 0.0) + comm.commission_amt
            profile.pending_earnings = max(0.0, (profile.pending_earnings or 0.0) - comm.commission_amt)

    audit = AuditLog(
        admin_user_id=admin_user.id,
        action=f"commission_{payload.commission_status}",
        target_type="affiliate_commission",
        target_id=str(commission_id),
        metadata_json=f'{{"from": "{old_status}", "to": "{payload.commission_status}", "notes": "{payload.admin_notes or ""}"}}'
    )
    db.add(audit)
    db.commit()
    return {"success": True, "commission_id": commission_id, "new_status": payload.commission_status}


@router.get("/{affiliate_id}/profile")
def get_affiliate_profile(
    affiliate_id: int,
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin_role)
):
    """Full affiliate profile with computed stats for the slide-over panel."""
    profile = db.query(AffiliateProfile).filter(AffiliateProfile.id == affiliate_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Affiliate profile not found")

    user = db.query(User).filter(User.id == profile.user_id).first()

    # Commission breakdown
    total_comm = db.query(func.sum(AffiliateCommission.commission_amt)).filter(
        AffiliateCommission.affiliate_id == affiliate_id
    ).scalar() or 0.0
    pending_comm = db.query(func.sum(AffiliateCommission.commission_amt)).filter(
        AffiliateCommission.affiliate_id == affiliate_id,
        AffiliateCommission.commission_status.in_(["pending", "approved"])
    ).scalar() or 0.0
    paid_comm = db.query(func.sum(AffiliateCommission.commission_amt)).filter(
        AffiliateCommission.affiliate_id == affiliate_id,
        AffiliateCommission.commission_status == "paid"
    ).scalar() or 0.0
    rejected_comm = db.query(func.sum(AffiliateCommission.commission_amt)).filter(
        AffiliateCommission.affiliate_id == affiliate_id,
        AffiliateCommission.commission_status.in_(["reversed", "rejected"])
    ).scalar() or 0.0

    total_revenue = db.query(func.sum(AffiliateCommission.sale_amount)).filter(
        AffiliateCommission.affiliate_id == affiliate_id
    ).scalar() or 0.0

    total_sales = db.query(AffiliateCommission).filter(
        AffiliateCommission.affiliate_id == affiliate_id
    ).count()
    avg_order = round(total_revenue / total_sales, 2) if total_sales > 0 else 0.0
    conversion_rate = round((total_sales / (profile.total_clicks or 1)) * 100, 2)

    # Top products
    top_products = (
        db.query(AffiliateCommission.product_name, func.count(AffiliateCommission.id).label("cnt"))
        .filter(AffiliateCommission.affiliate_id == affiliate_id)
        .group_by(AffiliateCommission.product_name)
        .order_by(desc("cnt"))
        .limit(5)
        .all()
    )

    # Recent commissions
    recent = (
        db.query(AffiliateCommission)
        .filter(AffiliateCommission.affiliate_id == affiliate_id)
        .order_by(desc(AffiliateCommission.created_at))
        .limit(10)
        .all()
    )

    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "name": user.name if user else "Affiliate",
        "email": user.email if user else "",
        "affiliate_code": profile.referral_code,
        "status": profile.status,
        "joined_date": profile.created_at.isoformat() + "Z" if profile.created_at else None,
        "last_active_at": profile.last_active_at.isoformat() + "Z" if profile.last_active_at else None,
        "total_clicks": profile.total_clicks or 0,
        "unique_clicks": profile.unique_clicks or 0,
        "total_sales": total_sales,
        "total_revenue": round(total_revenue, 2),
        "commission_earned": round(total_comm, 2),
        "commission_pending": round(pending_comm, 2),
        "commission_paid": round(paid_comm, 2),
        "commission_rejected": round(rejected_comm, 2),
        "conversion_rate": conversion_rate,
        "avg_order_value": avg_order,
        "upi_id": profile.upi_id or "",
        "bank_name": profile.bank_name or "",
        "account_number": ("**" + profile.account_number[-4:]) if profile.account_number and len(profile.account_number) >= 4 else "",
        "top_products": [{"name": r[0] or "Unknown", "count": r[1]} for r in top_products],
        "recent_commissions": [
            {
                "id": c.id,
                "order_id": c.order_id,
                "product_name": c.product_name,
                "amount": c.commission_amt,
                "status": c.commission_status or c.status,
                "date": c.created_at.isoformat() + "Z" if c.created_at else None,
            }
            for c in recent
        ],
        "display_name": profile.display_name or "",
        "country": profile.country or "",
        "youtube": profile.youtube or "",
        "instagram": profile.instagram or "",
        "linkedin": profile.linkedin or "",
    }


@router.get("/{affiliate_id}/commissions")
def get_affiliate_commissions(
    affiliate_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin_role)
):
    """Commission history for a single affiliate."""
    total = db.query(AffiliateCommission).filter(AffiliateCommission.affiliate_id == affiliate_id).count()
    rows = (
        db.query(AffiliateCommission)
        .filter(AffiliateCommission.affiliate_id == affiliate_id)
        .order_by(desc(AffiliateCommission.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": c.id,
                "order_id": c.order_id,
                "product_name": c.product_name,
                "sale_amount": c.sale_amount,
                "commission_amt": c.commission_amt,
                "commission_status": c.commission_status or c.status,
                "purchase_status": c.purchase_status,
                "refund_status": c.refund_status,
                "gateway_tx_id": c.gateway_tx_id,
                "admin_notes": c.admin_notes,
                "refund_deduction": c.refund_deduction or 0.0,
                "created_at": c.created_at.isoformat() + "Z" if c.created_at else None,
                "approved_at": c.approved_at.isoformat() + "Z" if c.approved_at else None,
                "paid_at": c.paid_at.isoformat() + "Z" if c.paid_at else None,
                "reversed_at": c.reversed_at.isoformat() + "Z" if c.reversed_at else None,
            }
            for c in rows
        ]
    }


@router.get("/payouts")
def get_payout_queue(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    payout_status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin_role)
):
    """Payout queue — pending/completed payouts grouped by affiliate."""
    q = (
        db.query(AffiliatePayout, AffiliateProfile, User)
        .join(AffiliateProfile, AffiliatePayout.affiliate_id == AffiliateProfile.id)
        .join(User, AffiliateProfile.user_id == User.id)
    )
    if payout_status:
        q = q.filter(AffiliatePayout.status == payout_status)

    total = q.count()
    rows = q.order_by(desc(AffiliatePayout.created_at)).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for payout, profile, user in rows:
        # Count of commissions in "ready_for_payout" state for this affiliate
        ready_commissions = db.query(AffiliateCommission).filter(
            AffiliateCommission.affiliate_id == profile.id,
            AffiliateCommission.commission_status == "ready_for_payout"
        ).count()

        items.append({
            "id": payout.id,
            "affiliate_id": profile.id,
            "affiliate_name": user.name or "Affiliate",
            "affiliate_code": profile.referral_code,
            "amount": payout.amount,
            "method": payout.method or "upi",
            "upi_id": profile.upi_id or "",
            "bank_name": profile.bank_name or "",
            "status": payout.status,
            "notes": payout.notes or "",
            "ready_commission_count": ready_commissions,
            "pending_balance": round(profile.pending_earnings or 0.0, 2),
            "created_at": payout.created_at.isoformat() + "Z" if payout.created_at else None,
            "updated_at": payout.updated_at.isoformat() + "Z" if payout.updated_at else None,
        })

    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.patch("/payouts/{payout_id}/status")
def patch_payout_status(
    payout_id: int,
    payload: PayoutStatusPatch,
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin_role)
):
    """Mark a payout as completed or rejected."""
    payout = db.query(AffiliatePayout).filter(AffiliatePayout.id == payout_id).first()
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")

    valid = {"pending", "completed", "rejected"}
    if payload.status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")

    payout.status = payload.status
    if payload.notes:
        payout.notes = payload.notes
    payout.updated_at = datetime.utcnow()

    if payload.status == "completed":
        profile = db.query(AffiliateProfile).filter(AffiliateProfile.id == payout.affiliate_id).first()
        if profile:
            profile.paid_earnings = (profile.paid_earnings or 0.0) + payout.amount
            profile.pending_earnings = max(0.0, (profile.pending_earnings or 0.0) - payout.amount)

    audit = AuditLog(
        admin_user_id=admin_user.id,
        action=f"payout_{payload.status}",
        target_type="affiliate_payout",
        target_id=str(payout_id),
    )
    db.add(audit)
    db.commit()
    return {"success": True, "payout_id": payout_id, "new_status": payload.status}


@router.get("/products/performance")
def get_product_affiliate_performance(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin_role)
):
    """Per-product affiliate performance stats for the Product Performance tab."""
    products = db.query(Product).filter(Product.affiliate_enabled == True).offset((page - 1) * page_size).limit(page_size).all()
    total = db.query(Product).filter(Product.affiliate_enabled == True).count()

    items = []
    for prod in products:
        # Commissions for this product
        comm_rows = db.query(AffiliateCommission).filter(AffiliateCommission.product_id == prod.id).all()
        total_sales = len(comm_rows)
        total_revenue = sum(c.sale_amount for c in comm_rows)
        total_commission = sum(c.commission_amt for c in comm_rows)
        pending_commission = sum(c.commission_amt for c in comm_rows if (c.commission_status or c.status) in ("pending", "approved"))

        # Affiliate count promoting this product
        affiliate_count = (
            db.query(func.count(func.distinct(ReferralLink.affiliate_id)))
            .filter(ReferralLink.product_id == prod.id, ReferralLink.is_active == True)
            .scalar() or 0
        )

        # Clicks for this product
        total_clicks_for_prod = (
            db.query(func.sum(ReferralLink.clicks_count))
            .filter(ReferralLink.product_id == prod.id)
            .scalar() or 0
        )

        conversion_rate = round((total_sales / total_clicks_for_prod) * 100, 2) if total_clicks_for_prod > 0 else 0.0
        avg_epc = round(total_commission / total_clicks_for_prod, 2) if total_clicks_for_prod > 0 else 0.0

        items.append({
            "product_id": prod.id,
            "product_name": prod.title,
            "thumbnail": prod.thumbnail,
            "creator": prod.seller or "Lumora",
            "price": prod.price,
            "affiliate_enabled": prod.affiliate_enabled,
            "commission_mode": prod.commission_mode or prod.commission_type or "percentage",
            "commission_value": prod.commission_value or 0.0,
            "affiliate_count": affiliate_count,
            "clicks": total_clicks_for_prod,
            "conversions": total_sales,
            "conversion_rate": conversion_rate,
            "revenue_generated": round(total_revenue, 2),
            "commission_paid": round(total_commission, 2),
            "commission_pending": round(pending_commission, 2),
            "avg_epc": avg_epc,
        })

    # Sort by revenue desc
    items.sort(key=lambda x: x["revenue_generated"], reverse=True)
    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.get("/activity")
def get_affiliate_activity_timeline(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    affiliate_action: Optional[str] = Query(None),  # filter by action type
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin_role)
):
    """Activity timeline — all affiliate-related audit log events."""
    affiliate_actions = [
        "affiliate_enable", "affiliate_disable",
        "commission_approved", "commission_rejected", "commission_paid",
        "commission_reversed", "payout_completed", "payout_rejected",
        "affiliate_commission_created",
    ]

    q = db.query(AuditLog, User).outerjoin(User, AuditLog.admin_user_id == User.id).filter(
        AuditLog.action.in_([affiliate_action] if affiliate_action else affiliate_actions)
    )
    total = q.count()
    rows = q.order_by(desc(AuditLog.created_at)).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for log, actor in rows:
        items.append({
            "id": log.id,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "actor_name": actor.name if actor else "System",
            "actor_id": log.admin_user_id,
            "metadata": log.metadata_json,
            "created_at": log.created_at.isoformat() + "Z" if log.created_at else None,
        })

    return {"total": total, "page": page, "page_size": page_size, "items": items}
