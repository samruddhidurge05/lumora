"""
app/payments/payout/factory.py
================================
Payout provider factory.

Selection priority
------------------
AFFILIATE_PAYOUT_MODE env var (case-insensitive):
  "razorpay" → RazorpayPayoutProvider  (requires Razorpay X credentials)
  anything   → MockPayoutProvider       (default, safe for dev/staging)

To switch to production:
  1. Set AFFILIATE_PAYOUT_MODE=razorpay in backend/.env
  2. Set RAZORPAY_PAYOUT_KEY_ID and RAZORPAY_PAYOUT_KEY_SECRET
  3. Set RAZORPAY_PAYOUT_WEBHOOK_SECRET
  4. Restart the backend server

No code changes required.
"""
from __future__ import annotations

import logging
import os

from app.payments.payout.provider import PayoutProvider

logger = logging.getLogger(__name__)


def get_payout_provider() -> PayoutProvider:
    """
    Return the active payout provider based on AFFILIATE_PAYOUT_MODE.

    This function is called once per request inside the admin payout route.
    It is intentionally cheap — no heavy initialisation on cold start.
    """
    mode = os.getenv("AFFILIATE_PAYOUT_MODE", "mock").strip().lower()

    if mode == "razorpay":
        from app.payments.payout.razorpay_provider import RazorpayPayoutProvider
        logger.info("[PayoutFactory] Using RazorpayPayoutProvider")
        return RazorpayPayoutProvider()

    # Default: mock (development / staging)
    from app.payments.payout.mock_provider import MockPayoutProvider
    logger.info("[PayoutFactory] Using MockPayoutProvider (AFFILIATE_PAYOUT_MODE=%s)", mode)
    return MockPayoutProvider()
