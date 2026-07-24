"""
app/payments/payout/completion_handler.py
==========================================
THE Single Source of Truth for Payout Completion.

CRITICAL DESIGN RULE
--------------------
This is the ONE AND ONLY function responsible for:
  1. Updating AffiliatePayout.status → completed / failed
  2. Updating AffiliateProfile.paid_earnings / pending_earnings
  3. Writing an AuditLog entry
  4. All operations happen in a SINGLE atomic transaction

Both the Mock provider (synchronous completion) AND the Razorpay
webhook handler (async completion) MUST call this same function.

Never duplicate payout completion logic.

Transaction Boundaries
----------------------
The caller is expected to pass an OPEN db Session.
This function executes all operations and calls db.commit() once.
On any error it calls db.rollback() and re-raises.

Idempotency
-----------
• If the payout is already in a terminal state (completed/failed/rejected),
  this function returns False (no-op) and does NOT update the DB.
• This prevents double-processing if a webhook fires twice.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.affiliate import AffiliatePayout, AffiliateProfile
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)

# States from which no further transitions are allowed
_TERMINAL_STATES = frozenset({"completed", "failed", "rejected"})


def complete_payout(
    *,
    db: Session,
    payout_id: int,
    new_status: str,              # "completed" | "failed"
    provider_ref: Optional[str] = None,
    fund_account_id: Optional[str] = None,
    failure_reason: Optional[str] = None,
    admin_user_id: Optional[int] = None,   # None when called from webhook
    source: str = "webhook",               # "webhook" | "mock" | "admin_manual"
    forensic_meta: Optional[dict] = None,
) -> bool:
    """
    Atomically complete or fail a payout.

    Parameters
    ----------
    db              Open SQLAlchemy session.
    payout_id       AffiliatePayout.id primary key.
    new_status      "completed" or "failed".
    provider_ref    Provider payout ID to persist (optional on failure).
    fund_account_id Razorpay fund account ID (optional).
    failure_reason  Error description when new_status="failed".
    admin_user_id   ID of admin user if triggered manually; None for webhooks.
    source          "webhook" | "mock" | "admin_manual" — logged in audit trail.

    Returns
    -------
    True  — successfully processed.
    False — payout was already in a terminal state (idempotent no-op).

    Raises
    ------
    ValueError  — payout_id not found.
    Exception   — any DB error (after rollback).
    """
    if new_status not in ("completed", "failed"):
        raise ValueError(f"complete_payout: invalid new_status '{new_status}'")

    try:
        payout = db.query(AffiliatePayout).filter(
            AffiliatePayout.id == payout_id
        ).with_for_update().first()

        if not payout:
            raise ValueError(f"AffiliatePayout #{payout_id} not found")

        # ── Idempotency guard ────────────────────────────────────────────────
        if payout.status in _TERMINAL_STATES:
            logger.warning(
                "[complete_payout] Payout #%d already in terminal state '%s' - "
                "ignoring duplicate call (source=%s)",
                payout_id, payout.status, source,
            )
            return False

        profile = db.query(AffiliateProfile).filter(
            AffiliateProfile.id == payout.affiliate_id
        ).with_for_update().first()

        if not profile:
            raise ValueError(
                f"AffiliateProfile for affiliate_id={payout.affiliate_id} not found"
            )

        now = datetime.utcnow()

        # ── Update payout record ─────────────────────────────────────────────
        payout.status     = new_status
        payout.updated_at = now

        if provider_ref:
            payout.razorpay_payout_id = provider_ref
        if fund_account_id:
            payout.razorpay_fund_account_id = fund_account_id
        if new_status == "completed":
            payout.completed_at = now
        if new_status == "failed":
            payout.failure_reason = failure_reason or "Unknown error"

        # ── Update affiliate wallet (ONLY on completion) ─────────────────────
        if new_status == "completed":
            amount = payout.amount
            profile.paid_earnings    = round(
                (profile.paid_earnings or 0.0) + amount, 2
            )
            profile.pending_earnings = round(
                max(0.0, (profile.pending_earnings or 0.0) - amount), 2
            )
            profile.updated_at = now

            logger.info(
                "[complete_payout] Wallet updated for AffiliateProfile #%d: "
                "+paid_earnings=%.2f, pending_earnings=%.2f (source=%s)",
                profile.id, amount, profile.pending_earnings, source,
            )

        # ── Write AuditLog ───────────────────────────────────────────────────
        audit_action = (
            f"payout_{new_status}"       # "payout_completed" | "payout_failed"
        )
        metadata = {
            "payout_id":       payout_id,
            "amount":          payout.amount,
            "method":          payout.method,
            "affiliate_id":    payout.affiliate_id,
            "new_status":      new_status,
            "source":          source,
            "provider_ref":    provider_ref or "",
            "fund_account_id": fund_account_id or "",
        }
        if failure_reason:
            metadata["failure_reason"] = failure_reason
        if forensic_meta and isinstance(forensic_meta, dict):
            metadata["forensic_details"] = forensic_meta

        audit = AuditLog(
            admin_user_id = admin_user_id,
            action        = audit_action,
            target_type   = "affiliate_payout",
            target_id     = str(payout_id),
            metadata_json = json.dumps(metadata),
        )
        db.add(audit)

        # ── Single commit ────────────────────────────────────────────────────
        db.commit()

        logger.info(
            "[complete_payout] SUCCESS - payout #%d -> %s (source=%s amount=%.2f)",
            payout_id, new_status, source, payout.amount,
        )
        return True

    except Exception as exc:
        db.rollback()
        logger.error(
            "[complete_payout] FAILED for payout #%d: %s — rolled back",
            payout_id, exc,
        )
        raise
