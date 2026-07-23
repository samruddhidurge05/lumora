"""
backend/admin/routes/referral_links.py
---------------------------------------
Admin Referral Links Management endpoints.

All endpoints are protected by require_admin_role and driven by PostgreSQL.
Every mutation writes an AuditLog row.

Routes:
  GET    /               - List admin referral links from PostgreSQL
  POST   /               - Create referral link in PostgreSQL (and sync to Firestore mirror)
  DELETE /{link_id}      - Delete referral link from PostgreSQL (and sync to Firestore mirror)
  PATCH  /{link_id}/status - Toggle status active/paused in PostgreSQL
"""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from admin.validators.admin_auth import require_admin_role
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.product import Product
from app.models.affiliate import ReferralLink, AffiliateProfile, ReferralClick
from app.shared.firebase.connection import db as fdb, firebase_connected

logger = logging.getLogger(__name__)

router = APIRouter()


# -- Pydantic schemas --------------------------------------------------------

class AdminReferralLinkCreate(BaseModel):
    productId: str
    productName: str
    referralName: str = ""
    commissionPct: int = 15
    code: str


class AdminReferralLinkStatusUpdate(BaseModel):
    status: str  # "active" | "paused"


# -- Audit helper ------------------------------------------------------------

def _log_audit(
    db: Session,
    admin_user_id: int,
    action: str,
    target_id: str,
    metadata: dict | None = None,
):
    try:
        audit = AuditLog(
            admin_user_id=admin_user_id,
            action=action,
            target_type="referral_link",
            target_id=target_id,
            metadata_json=json.dumps(metadata) if metadata else None,
        )
        db.add(audit)
        db.commit()
    except Exception as exc:
        logger.error("[referral_links] AuditLog insert failed for action=%s: %s", action, exc)


# -- GET / - List referral links ---------------------------------------------

@router.get("/", status_code=200)
def list_referral_links(
    product_id: int | None = Query(None),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """
    List referral links from PostgreSQL database.
    """
    q = db.query(ReferralLink, Product).join(Product, ReferralLink.product_id == Product.id)
    if product_id:
        q = q.filter(ReferralLink.product_id == product_id)
    
    rows = q.order_by(desc(ReferralLink.created_at)).all()
    results = []
    for link, prod in rows:
        results.append({
            "id": str(link.id),
            "link_id": link.id,
            "productId": str(prod.id),
            "product_id": prod.id,
            "productName": prod.title,
            "referralName": link.name or f"{prod.title} Promo",
            "commissionPct": prod.commission_value or 20,
            "code": link.referral_code,
            "status": "active" if link.is_active else "paused",
            "clicks": link.clicks_count or 0,
            "createdAt": link.created_at.isoformat() + "Z" if link.created_at else None,
        })
    return results


# -- POST / - Create referral link ------------------------------------------

@router.post("/", status_code=201)
def create_referral_link(
    body: AdminReferralLinkCreate,
    admin_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    """
    Create an admin referral link record in PostgreSQL ReferralLink table.
    """
    prod_id = int(body.productId) if str(body.productId).isdigit() else None
    if not prod_id:
        raise HTTPException(status_code=400, detail="Invalid productId")

    product = db.query(Product).filter(Product.id == prod_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Fetch default system admin affiliate profile (or create fallback profile for admin user)
    aff_profile = db.query(AffiliateProfile).filter(AffiliateProfile.user_id == admin_user.id).first()
    if not aff_profile:
        # Create affiliate profile for admin user to link referral links cleanly
        aff_profile = AffiliateProfile(user_id=admin_user.id, referral_code=f"ADM{admin_user.id:04d}", is_active=True, status="active")
        db.add(aff_profile)
        db.commit()
        db.refresh(aff_profile)

    # Create SQL ReferralLink
    ref_link = ReferralLink(
        affiliate_id=aff_profile.id,
        product_id=product.id,
        referral_code=body.code,
        name=body.referralName or f"{product.title} Promo",
        is_active=True,
    )
    db.add(ref_link)
    db.commit()
    db.refresh(ref_link)

    # Optional Firestore Mirror write
    if firebase_connected and fdb is not None:
        try:
            document = {
                "affiliateId": str(aff_profile.id),
                "affiliateCode": aff_profile.referral_code,
                "productId": str(product.id),
                "productName": product.title,
                "referralName": body.referralName or f"{product.title} Promo",
                "commissionPct": body.commissionPct,
                "code": body.code,
                "status": "active",
                "clicks": 0,
                "createdAt": datetime.utcnow().isoformat() + "Z",
                "sqlLinkId": ref_link.id,
            }
            fdb.collection("adminReferralLinks").document(str(ref_link.id)).set(document, merge=True)
        except Exception as exc:
            logger.error("[referral_links] Firestore sync failed: %s", exc)

    _log_audit(
        db,
        admin_user_id=admin_user.id,
        action="admin_referral_link_created",
        target_id=body.code,
        metadata={"linkId": ref_link.id, "productId": product.id},
    )

    return {
        "id": str(ref_link.id),
        "productId": str(product.id),
        "productName": product.title,
        "referralName": ref_link.name,
        "commissionPct": body.commissionPct,
        "code": ref_link.referral_code,
        "status": "active",
        "clicks": 0,
        "createdAt": ref_link.created_at.isoformat() + "Z",
    }


# -- DELETE /{link_id} - Delete referral link --------------------------

@router.delete("/{link_id}", status_code=200)
def delete_referral_link(
    link_id: str,
    admin_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    """
    Delete a referral link from PostgreSQL.
    """
    ref_link = None
    if link_id.isdigit():
        ref_link = db.query(ReferralLink).filter(ReferralLink.id == int(link_id)).first()
    if not ref_link:
        ref_link = db.query(ReferralLink).filter(ReferralLink.referral_code == link_id).first()

    if not ref_link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Referral link '{link_id}' not found.",
        )

    link_id_val = str(ref_link.id)
    db.delete(ref_link)
    db.commit()

    if firebase_connected and fdb is not None:
        try:
            fdb.collection("adminReferralLinks").document(link_id_val).delete()
        except Exception as exc:
            logger.error("[referral_links] Firestore delete sync failed: %s", exc)

    _log_audit(
        db,
        admin_user_id=admin_user.id,
        action="admin_referral_link_deleted",
        target_id=link_id_val,
    )

    return {"success": True, "id": link_id_val}


# -- PATCH /{link_id}/status - Toggle status ---------------------------

@router.patch("/{link_id}/status", status_code=200)
def update_referral_link_status(
    link_id: str,
    body: AdminReferralLinkStatusUpdate,
    admin_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    """
    Toggle status of referral link between 'active' and 'paused'.
    """
    if body.status not in ("active", "paused"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="status must be 'active' or 'paused'.",
        )

    ref_link = None
    if link_id.isdigit():
        ref_link = db.query(ReferralLink).filter(ReferralLink.id == int(link_id)).first()
    if not ref_link:
        ref_link = db.query(ReferralLink).filter(ReferralLink.referral_code == link_id).first()

    if not ref_link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Referral link '{link_id}' not found.",
        )

    ref_link.is_active = (body.status == "active")
    db.commit()

    if firebase_connected and fdb is not None:
        try:
            fdb.collection("adminReferralLinks").document(str(ref_link.id)).update({"status": body.status})
        except Exception as exc:
            logger.error("[referral_links] Firestore status sync failed: %s", exc)

    _log_audit(
        db,
        admin_user_id=admin_user.id,
        action="admin_referral_link_status_changed",
        target_id=str(ref_link.id),
        metadata={"status": body.status},
    )

    return {"success": True, "id": str(ref_link.id), "status": body.status}
