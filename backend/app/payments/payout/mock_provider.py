"""
app/payments/payout/mock_provider.py
======================================
Mock Payout Provider — executes the IDENTICAL production workflow.
The ONLY difference from RazorpayPayoutProvider: no real money moves.

Usage
-----
Set AFFILIATE_PAYOUT_MODE=mock  (this is the default)

Behaviour
---------
• Generates a deterministic mock reference ID (mock_pout_<payout_db_id>).
• Returns status="completed" synchronously (no webhook required).
• The caller uses the shared completion handler — same as production.
• Audit trail, wallet updates, and status transitions are IDENTICAL.
• This lets you run the full payout lifecycle in local/staging without
  real Razorpay X credentials.

Design Principle
----------------
"Mock mode is NOT fake UI. Mock mode must execute the EXACT production
workflow. The ONLY mocked step is the actual Razorpay API call."
"""
from __future__ import annotations

import logging
from typing import Optional

from app.payments.payout.provider import PayoutProvider, PayoutResult

logger = logging.getLogger(__name__)


class MockPayoutProvider(PayoutProvider):
    """
    Mock payout provider for development / staging.

    Simulates an immediate successful payout without calling any
    external API.  The returned status is "completed" so the caller
    triggers the shared completion handler synchronously — exactly
    mirroring what a Razorpay webhook would do in production.
    """

    PROVIDER_NAME = "mock"

    def initiate_payout(
        self,
        *,
        payout_db_id: int,
        affiliate_id: int,
        amount_inr: float,
        method: str,
        upi_id: Optional[str],
        bank_account: Optional[str],
        ifsc_code: Optional[str],
        bank_name: Optional[str],
        affiliate_name: str,
        reference_note: str,
    ) -> PayoutResult:
        """
        Simulate a successful payout.

        Returns "completed" immediately so the caller can run the
        shared completion handler in the same database transaction.
        """
        provider_ref = f"mock_pout_{payout_db_id:06d}"

        logger.info(
            "[MockPayoutProvider] Simulated payout ACCEPTED: "
            "payout_id=%d affiliate_id=%d amount=%.2f method=%s ref=%s",
            payout_db_id, affiliate_id, amount_inr, method, provider_ref,
        )

        return PayoutResult(
            success=True,
            provider_ref=provider_ref,
            fund_account_id=f"mock_fa_{affiliate_id:06d}",
            status="completed",          # synchronous: trigger completion inline
            raw={
                "provider": "mock",
                "payout_db_id": payout_db_id,
                "amount_inr": amount_inr,
                "method": method,
                "reference_note": reference_note,
            },
        )
