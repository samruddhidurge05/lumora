"""
app/admin_api/treasury/webhook.py
-----------------------------------
RazorpayX Payout Webhook Receiver.

Receives async lifecycle events from RazorpayX for platform treasury payouts.

Registered at: POST /api/admin/treasury/webhook/razorpayx

Supported events:
    payout.queued      -> status = "processing"
    payout.initiated   -> status = "processing"
    payout.processing  -> status = "processing"
    payout.processed   -> auto-complete settlement with bank UTR
    payout.failed      -> auto-cancel settlement with failure reason
    payout.cancelled   -> auto-cancel settlement
    payout.reversed    -> flag as failed with reversal reason

Security:
    - HMAC-SHA256 signature verified via X-Razorpay-Signature header
    - Idempotent: already-completed/cancelled withdrawals are skipped silently
    - No admin JWT required (signature verification replaces auth)
"""

import hashlib
import hmac
import json
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status as http_status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.platform_withdrawal import PlatformWithdrawal

from app.services.treasury_service import (
    complete_settlement,
    cancel_settlement,
    write_ledger_entry,
    _write_audit_log,
)

_logger = logging.getLogger("lumora.treasury.webhook")

webhook_router = APIRouter()


# ---- Signature Verification --------------------------------------------------

def _verify_razorpayx_signature(
    body: bytes,
    signature: Optional[str],
    secret: str,
) -> bool:
    """
    Verify the RazorpayX webhook signature.
    RazorpayX sends: X-Razorpay-Signature = HMAC-SHA256(body, webhook_secret)
    """
    if not signature:
        return False
    expected = hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


# ---- Status mapping ----------------------------------------------------------

# Maps RazorpayX payout event names to internal withdrawal statuses
_EVENT_TO_STATUS = {
    "payout.queued":     "processing",
    "payout.initiated":  "processing",
    "payout.processing": "processing",
    "payout.processed":  "completed",
    "payout.failed":     "failed",
    "payout.cancelled":  "cancelled",
    "payout.reversed":   "failed",
}

# Terminal states — do not re-process if already in one of these
_TERMINAL_STATUSES = {"completed", "cancelled", "failed"}


# ---- Webhook Endpoint --------------------------------------------------------

@webhook_router.post("/razorpayx", include_in_schema=False)
async def razorpayx_payout_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Receive and process RazorpayX payout lifecycle events.

    This endpoint is PUBLIC (no admin JWT) but protected by HMAC-SHA256
    signature verification using RAZORPAYX_WEBHOOK_SECRET.
    """
    webhook_secret = os.getenv("RAZORPAYX_WEBHOOK_SECRET", "").strip()
    body_bytes = await request.body()

    # ---- Signature verification -----------------------------------------------
    if webhook_secret:
        if not _verify_razorpayx_signature(body_bytes, x_razorpay_signature, webhook_secret):
            _logger.warning("[webhook] RazorpayX signature verification FAILED")
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Invalid webhook signature.",
            )
    else:
        _logger.warning(
            "[webhook] RAZORPAYX_WEBHOOK_SECRET not configured — "
            "skipping signature verification (NOT safe for production)"
        )

    # ---- Parse payload --------------------------------------------------------
    try:
        payload = json.loads(body_bytes)
    except Exception:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON webhook payload.",
        )

    event      = payload.get("event", "")
    entity     = payload.get("payload", {}).get("payout", {}).get("entity", {})
    payout_id  = entity.get("id", "")          # e.g. "pout_ABC123"
    utr        = entity.get("utr")              # Available once processed
    amount_paise = entity.get("amount", 0)
    ref_id     = entity.get("reference_id", "") # our withdrawal_number
    failure    = entity.get("error", {})

    _logger.info(
        "[webhook] RazorpayX event=%s payout_id=%s reference_id=%s utr=%s",
        event, payout_id, ref_id, utr,
    )

    if not event or event not in _EVENT_TO_STATUS:
        # Unknown or irrelevant event — acknowledge silently
        return {"success": True, "message": f"Event '{event}' acknowledged but not processed."}

    # ---- Find withdrawal by razorpayx_payout_id or reference_id (withdrawal_number) --
    row: Optional[PlatformWithdrawal] = None

    if payout_id:
        row = (
            db.query(PlatformWithdrawal)
            .filter(PlatformWithdrawal.razorpayx_payout_id == payout_id)
            .first()
        )

    if not row and ref_id:
        row = (
            db.query(PlatformWithdrawal)
            .filter(PlatformWithdrawal.withdrawal_number == ref_id)
            .first()
        )

    if not row:
        _logger.warning(
            "[webhook] No withdrawal found for payout_id=%s reference_id=%s",
            payout_id, ref_id,
        )
        # Return 200 — RazorpayX expects acknowledgment even if we can't match
        return {"success": True, "message": "Withdrawal not found — acknowledged."}

    # ---- Idempotency check ----------------------------------------------------
    current_status = str(row.status)
    if current_status in _TERMINAL_STATUSES:
        _logger.info(
            "[webhook] Withdrawal %s already in terminal state '%s' — skipping event %s",
            row.withdrawal_number, current_status, event,
        )
        return {"success": True, "message": f"Already in terminal state '{current_status}'."}

    # ---- Handle event ---------------------------------------------------------

    if event == "payout.processed":
        # Auto-complete settlement with bank UTR from webhook
        transaction_ref = utr or payout_id or f"RPX-{payout_id}"
        try:
            complete_settlement(
                db,
                withdrawal_id=row.id,
                transaction_reference=transaction_ref,
                completed_by=0,    # 0 = system/webhook actor
                ip_address="razorpayx-webhook",
            )
            _logger.info(
                "[webhook] Auto-completed withdrawal %s via webhook. UTR=%s",
                row.withdrawal_number, transaction_ref,
            )
        except Exception as exc:
            _logger.error(
                "[webhook] Failed to auto-complete withdrawal %s: %s",
                row.withdrawal_number, exc,
            )
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to complete settlement: {exc}",
            )

    elif event in ("payout.failed", "payout.cancelled", "payout.reversed"):
        failure_desc = (
            failure.get("description")
            or failure.get("reason")
            or event
        )
        reason = f"RazorpayX {event}: {failure_desc}"
        try:
            cancel_settlement(
                db,
                withdrawal_id=row.id,
                reason=reason,
                cancelled_by=0,    # 0 = system/webhook actor
                ip_address="razorpayx-webhook",
            )
            _logger.info(
                "[webhook] Auto-cancelled withdrawal %s via webhook. reason=%s",
                row.withdrawal_number, reason,
            )
        except Exception as exc:
            _logger.error(
                "[webhook] Failed to auto-cancel withdrawal %s: %s",
                row.withdrawal_number, exc,
            )
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to cancel settlement: {exc}",
            )

    else:
        # Intermediate events: queued, initiated, processing -> update status field only
        from app.services.treasury_service import utcnow as _utcnow
        row.status     = _EVENT_TO_STATUS[event]
        row.updated_at = _utcnow()
        if payout_id and not row.razorpayx_payout_id:
            row.razorpayx_payout_id = payout_id
        db.add(row)
        db.commit()
        _logger.info(
            "[webhook] Updated withdrawal %s status -> %s",
            row.withdrawal_number, _EVENT_TO_STATUS[event],
        )

    return {"success": True, "message": f"Event '{event}' processed for {row.withdrawal_number}."}
