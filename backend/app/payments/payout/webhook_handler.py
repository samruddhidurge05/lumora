"""
app/payments/payout/webhook_handler.py
========================================
Razorpay Payout Webhook Handler.

Security
--------
• Verifies X-Razorpay-Signature using HMAC-SHA256 with
  RAZORPAY_PAYOUT_WEBHOOK_SECRET. Requests with invalid
  signatures are rejected with HTTP 400.
• Duplicate webhook events are silently swallowed (idempotency).
  The completion_handler's terminal-state guard prevents double-processing.

Supported Events
----------------
payout.processed  → complete_payout(status="completed")
payout.failed     → complete_payout(status="failed")
payout.reversed   → complete_payout(status="failed", reason="reversed")

Ignored Events
--------------
payout.initiated, payout.queued, payout.pending — status already "processing".

Replay Attack Protection
------------------------
• Razorpay signs payload with webhook secret — cannot be forged.
• Even if replayed, the idempotency guard in complete_payout() makes
  subsequent calls a no-op once the payout is in a terminal state.

Webhook Configuration
---------------------
In Razorpay X Dashboard → Webhooks:
  URL: https://<your-backend>/api/webhooks/affiliate-payout
  Events: payout.processed, payout.failed, payout.reversed
  Secret: RAZORPAY_PAYOUT_WEBHOOK_SECRET
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from typing import Optional

from sqlalchemy.orm import Session

from app.models.affiliate import AffiliatePayout
from app.payments.payout.completion_handler import complete_payout

logger = logging.getLogger(__name__)


# ── Signature Verification ────────────────────────────────────────────────────

def verify_razorpay_webhook_signature(
    raw_body: bytes,
    signature_header: Optional[str],
) -> bool:
    """
    Verify the X-Razorpay-Signature header.

    Razorpay signs the raw request body with RAZORPAY_PAYOUT_WEBHOOK_SECRET
    using HMAC-SHA256 and sends the hex digest in the header.

    Returns True if valid, False otherwise.
    """
    secret = os.getenv("RAZORPAY_PAYOUT_WEBHOOK_SECRET", "")
    if not secret:
        logger.error(
            "[webhook] RAZORPAY_PAYOUT_WEBHOOK_SECRET is not configured. "
            "Cannot verify webhook signature — rejecting request."
        )
        return False

    if not signature_header:
        logger.warning("[webhook] Missing X-Razorpay-Signature header")
        return False

    expected = hmac.new(
        key=secret.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256,
    ).hexdigest()

    is_valid = hmac.compare_digest(expected, signature_header)
    if not is_valid:
        logger.warning(
            "[webhook] Signature MISMATCH — possible tampered request. "
            "expected=%s received=%s", expected[:12] + "...", signature_header[:12] + "..."
        )
    return is_valid


# ── Event Dispatcher ──────────────────────────────────────────────────────────

def handle_payout_webhook(
    *,
    raw_body: bytes,
    signature_header: Optional[str],
    db: Session,
) -> dict:
    """
    Entry point for Razorpay payout webhook events.

    1. Verify signature (reject if invalid)
    2. Parse event type
    3. Find the matching AffiliatePayout by razorpay_payout_id
    4. Call the shared completion handler

    Returns a dict with {"handled": bool, "event": str, "payout_id": int | None}
    """
    # Step 1: Verify signature
    if not verify_razorpay_webhook_signature(raw_body, signature_header):
        logger.warning("[webhook] Signature verification failed — ignoring event")
        return {"handled": False, "reason": "invalid_signature"}

    # Step 2: Parse payload
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        logger.error("[webhook] Failed to parse JSON body: %s", exc)
        return {"handled": False, "reason": "invalid_json"}

    event       = payload.get("event", "")
    entity      = payload.get("payload", {}).get("payout", {}).get("entity", {})
    provider_ref = entity.get("id", "")

    logger.info("[webhook] Received event=%s provider_ref=%s", event, provider_ref)

    # Step 3: Dispatch by event type
    handled_events = {
        "payout.processed": ("completed", None),
        "payout.failed":    ("failed",    entity.get("failure_reason") or "Payment failed"),
        "payout.reversed":  ("failed",    "Payout reversed by provider"),
    }

    if event not in handled_events:
        logger.info("[webhook] Ignoring non-terminal event: %s", event)
        return {"handled": False, "reason": "non_terminal_event", "event": event}

    new_status, failure_reason = handled_events[event]

    # Step 4: Find the AffiliatePayout by provider_ref
    if not provider_ref:
        logger.error("[webhook] No provider_ref in payload — cannot match payout")
        return {"handled": False, "reason": "missing_provider_ref"}

    payout = db.query(AffiliatePayout).filter(
        AffiliatePayout.razorpay_payout_id == provider_ref
    ).first()

    if not payout:
        logger.warning(
            "[webhook] No AffiliatePayout found for razorpay_payout_id=%s",
            provider_ref,
        )
        return {"handled": False, "reason": "payout_not_found", "provider_ref": provider_ref}

    # Step 5: Call the shared completion handler
    processed = complete_payout(
        db=db,
        payout_id=payout.id,
        new_status=new_status,
        provider_ref=provider_ref,
        failure_reason=failure_reason,
        source="webhook",
    )

    return {
        "handled": True,
        "event": event,
        "payout_id": payout.id,
        "new_status": new_status,
        "was_already_terminal": not processed,
    }
