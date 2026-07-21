"""
admin_controls/referral/service.py
-----------------------------------
Modular service for Admin Referral Campaign tracking.
Encapsulates all Firestore reads and writes using atomic operations.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.affiliate import AffiliateProfile
from app.shared.firebase.connection import db as fdb, firebase_connected

logger = logging.getLogger(__name__)


class AdminReferralService:
    @staticmethod
    def find_campaign(code: str) -> Optional[Dict[str, Any]]:
        """Find active Admin Referral Link document in Firestore by code."""
        if not firebase_connected or fdb is None:
            return None
        try:
            snaps = list(fdb.collection("adminReferralLinks").where("code", "==", code.upper()).limit(1).stream())
            if not snaps:
                return None
            doc = snaps[0]
            return {"id": doc.id, "ref": doc.reference, **doc.to_dict()}
        except Exception as exc:
            logger.error("[AdminReferralService] find_campaign failed for code=%s: %s", code, exc)
            return None

    @staticmethod
    def increment_click(doc_ref) -> None:
        """Atomically increment click counter on campaign link doc."""
        try:
            from google.cloud.firestore import Increment
            doc_ref.update({"clicks": Increment(1)})
        except Exception as exc:
            logger.error("[AdminReferralService] increment_click failed: %s", exc)

    @staticmethod
    def increment_conversion(doc_ref, sale_amount: float) -> None:
        """Atomically increment conversions and total earnings on campaign link doc."""
        try:
            from google.cloud.firestore import Increment
            doc_ref.update({
                "conversions": Increment(1),
                "earnings": Increment(float(sale_amount or 0.0))
            })
        except Exception as exc:
            logger.error("[AdminReferralService] increment_conversion failed: %s", exc)

    @staticmethod
    def record_order(order_doc_id: str, campaign_id: str, code: str, user_id: int, total_amount: float) -> bool:
        """
        Record conversion order document in adminAffiliateOrders.
        Returns True if new document created, False if order already existed (idempotent skip).
        """
        if not firebase_connected or fdb is None:
            return False
            
        try:
            order_ref = fdb.collection("adminAffiliateOrders").document(order_doc_id)
            if order_ref.get().exists:
                return False  # Idempotent skip
                
            order_ref.set({
                "campaignId": campaign_id,
                "code": code.upper(),
                "orderId": order_doc_id,
                "customerId": str(user_id),
                "totalAmount": float(total_amount or 0.0),
                "createdAt": datetime.now(timezone.utc).isoformat()
            })
            return True
        except Exception as exc:
            logger.error("[AdminReferralService] record_order failed for order=%s: %s", order_doc_id, exc)
            return False


def process_admin_referral(
    db: Session,
    order: Order,
    user_id: int,
    affiliate_code: Optional[str],
    affiliate_profile: Optional[AffiliateProfile] = None
) -> None:
    """
    Orchestrator called at the end of PurchaseService.process_purchase().
    Best-effort execution: failures are logged and never crash the primary purchase flow.
    """
    # 1. Quick exit if no code or if code already belongs to a standard SQL Affiliate
    if not affiliate_code or affiliate_profile is not None:
        return

    if not firebase_connected or fdb is None:
        logger.info("[admin_referral] Firestore unavailable - skipping admin referral conversion logging.")
        return

    try:
        code_upper = affiliate_code.upper()

        # 2. Lookup Admin Campaign
        campaign = AdminReferralService.find_campaign(code_upper)
        if not campaign:
            return

        # 3. Status Validation
        if campaign.get("status") != "active":
            logger.info("[admin_referral] Campaign %s is inactive - conversion ignored.", code_upper)
            return

        # 4. Self-Referral Prevention
        created_by = campaign.get("createdBy")
        if created_by and str(created_by) == str(user_id):
            logger.info("[admin_referral] Self-referral detected (createdBy=%s, buyer=%s) - ignored.", created_by, user_id)
            return

        # 5. Idempotent Order Recording & Atomic Increments
        order_doc_id = f"ORD-{order.id}"
        created_new = AdminReferralService.record_order(
            order_doc_id=order_doc_id,
            campaign_id=campaign["id"],
            code=code_upper,
            user_id=user_id,
            total_amount=order.total_amount or 0.0
        )

        if created_new:
            AdminReferralService.increment_conversion(campaign["ref"], order.total_amount or 0.0)
            logger.info("[admin_referral] Successfully recorded conversion for order %s", order_doc_id)
        else:
            logger.info("[admin_referral] Order %s already logged - idempotent skip", order_doc_id)

    except Exception as exc:
        logger.error("[admin_referral] Non-fatal error during admin referral processing: %s", exc)
