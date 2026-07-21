"""
backend/admin/routes/referral_links.py
---------------------------------------
Admin Referral Links Management endpoints.

All three endpoints are protected by require_admin_role.
Every mutation writes an AuditLog row (non-blocking on failure).
Firestore is required for these endpoints - returns HTTP 503 if unavailable.

Routes:
  POST   /               - Create admin referral link in Firestore
  DELETE /{firestore_id} - Delete admin referral link from Firestore
  PATCH  /{firestore_id}/status - Toggle status active/paused
"""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from admin.validators.admin_auth import require_admin_role
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
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
    """Insert an AuditLog row. Non-blocking - if it fails, log and continue."""
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
        # Do NOT re-raise - audit failure must never block the primary operation


# -- POST / - Create referral link ------------------------------------------


@router.post("/", status_code=201)
def create_referral_link(
    body: AdminReferralLinkCreate,
    admin_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    """
    Create an admin referral link template in Firestore adminReferralLinks.
    Requires a live Firestore connection - returns HTTP 503 if unavailable.
    """
    if not firebase_connected or fdb is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Referral links require a Firestore connection. Please try again later.",
        )

    document = {
        "affiliateId": "",
        "affiliateCode": "",
        "campaignId": "",
        "productId": body.productId,
        "productName": body.productName,
        "referralName": body.referralName or f"{body.productName} Promo",
        "commissionPct": body.commissionPct,
        "code": body.code,
        "status": "active",
        "clicks": 0,
        "conversions": 0,
        "earnings": 0,
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "createdBy": admin_user.id,
    }

    try:
        _, doc_ref = fdb.collection("adminReferralLinks").add(document)
    except Exception as exc:
        logger.error("[referral_links] Firestore create failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to create referral link in Firestore.",
        )

    _log_audit(
        db,
        admin_user_id=admin_user.id,
        action="admin_referral_link_created",
        target_id=body.code,
        metadata={"firestoreId": doc_ref.id, "productId": body.productId},
    )

    logger.info("[referral_links] Created referral link code=%s firestoreId=%s", body.code, doc_ref.id)

    return {"id": doc_ref.id, **document}


# -- DELETE /{firestore_id} - Delete referral link --------------------------


@router.delete("/{firestore_id}", status_code=200)
def delete_referral_link(
    firestore_id: str,
    admin_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    """
    Delete an admin referral link from Firestore adminReferralLinks.
    Returns HTTP 404 if the document does not exist.
    """
    if not firebase_connected or fdb is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Referral links require a Firestore connection.",
        )

    doc_ref = fdb.collection("adminReferralLinks").document(firestore_id)

    try:
        snap = doc_ref.get()
    except Exception as exc:
        logger.error("[referral_links] Firestore get failed for id=%s: %s", firestore_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to reach Firestore.",
        )

    if not snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Referral link '{firestore_id}' not found.",
        )

    try:
        doc_ref.delete()
    except Exception as exc:
        logger.error("[referral_links] Firestore delete failed for id=%s: %s", firestore_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to delete referral link from Firestore.",
        )

    _log_audit(
        db,
        admin_user_id=admin_user.id,
        action="admin_referral_link_deleted",
        target_id=firestore_id,
    )

    logger.info("[referral_links] Deleted referral link firestoreId=%s", firestore_id)

    return {"success": True, "id": firestore_id}


# -- PATCH /{firestore_id}/status - Toggle status ---------------------------


@router.patch("/{firestore_id}/status", status_code=200)
def update_referral_link_status(
    firestore_id: str,
    body: AdminReferralLinkStatusUpdate,
    admin_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    """
    Toggle the status of an admin referral link between 'active' and 'paused'.
    """
    if body.status not in ("active", "paused"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="status must be 'active' or 'paused'.",
        )

    if not firebase_connected or fdb is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Referral links require a Firestore connection.",
        )

    doc_ref = fdb.collection("adminReferralLinks").document(firestore_id)

    try:
        doc_ref.update({"status": body.status})
    except Exception as exc:
        logger.error(
            "[referral_links] Firestore status update failed for id=%s: %s",
            firestore_id, exc,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to update referral link status in Firestore.",
        )

    _log_audit(
        db,
        admin_user_id=admin_user.id,
        action="admin_referral_link_status_changed",
        target_id=firestore_id,
        metadata={"status": body.status},
    )

    logger.info(
        "[referral_links] Status updated to %s for firestoreId=%s",
        body.status, firestore_id,
    )

    return {"success": True, "id": firestore_id, "status": body.status}
