"""
app/api/payout_webhook_router.py
==================================
FastAPI router for Razorpay Payout Webhook endpoint.

Endpoint: POST /api/webhooks/affiliate-payout

Security
--------
• Public endpoint (no JWT auth — Razorpay cannot authenticate).
• HMAC-SHA256 webhook signature verified inside webhook_handler.
• Invalid signatures → HTTP 400 (logged, not propagated to Razorpay).
• Idempotent — safe to retry from Razorpay dashboard.

Registration
------------
Registered in app/main.py:
    from app.api.payout_webhook_router import router as payout_webhook_router
    app.include_router(payout_webhook_router, prefix="/api/webhooks", tags=["Webhooks"])
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.payments.payout.webhook_handler import handle_payout_webhook

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/affiliate-payout",
    tags=["Webhooks"],
    summary="Razorpay affiliate payout webhook receiver",
    response_description="Webhook processing result",
)
async def receive_affiliate_payout_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_razorpay_signature: Optional[str] = Header(None, alias="X-Razorpay-Signature"),
):
    """
    Receives Razorpay X payout status callbacks.

    Razorpay calls this endpoint when a payout's status changes to:
      payout.processed → mark completed, update affiliate wallet
      payout.failed    → mark failed, store failure reason
      payout.reversed  → mark failed with 'reversed' reason

    The endpoint always returns HTTP 200 to Razorpay (even on errors)
    to prevent unnecessary retries for events we intentionally ignore.
    Non-200 responses trigger Razorpay retry logic.
    """
    # Read raw body FIRST (before any FastAPI body parsing consumes the stream)
    raw_body = await request.body()

    logger.info(
        "[webhook_endpoint] POST /api/webhooks/affiliate-payout "
        "content_length=%d signature_present=%s",
        len(raw_body),
        bool(x_razorpay_signature),
    )

    try:
        result = handle_payout_webhook(
            raw_body=raw_body,
            signature_header=x_razorpay_signature,
            db=db,
        )
    except Exception as exc:
        # Log but return 200 so Razorpay doesn't retry processing errors
        logger.error(
            "[webhook_endpoint] Unhandled exception processing webhook: %s",
            exc, exc_info=True,
        )
        return {
            "received": True,
            "handled": False,
            "error": "Internal processing error — logged for investigation",
        }

    if result.get("reason") == "invalid_signature":
        # Return 400 specifically for signature failures
        # (Razorpay won't retry 4xx — this prevents replay attacks)
        raise HTTPException(
            status_code=400,
            detail="Webhook signature verification failed",
        )

    return {
        "received": True,
        **result,
    }
