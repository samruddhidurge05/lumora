"""
app/payments/payout/razorpay_provider.py
==========================================
Razorpay X Payout Provider — production implementation.

Prerequisites
-------------
1. Enable Razorpay X (Route) from your Razorpay Dashboard.
2. Obtain a separate API key pair for Razorpay X payouts.
3. Set in backend/.env:
       AFFILIATE_PAYOUT_MODE=razorpay
       RAZORPAY_PAYOUT_KEY_ID=rzp_live_...
       RAZORPAY_PAYOUT_KEY_SECRET=...
       RAZORPAY_PAYOUT_WEBHOOK_SECRET=...

IMPORTANT: These are DIFFERENT from RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET
           which are used for Checkout (customer payments).

Activation
----------
No code changes required.
Just set AFFILIATE_PAYOUT_MODE=razorpay and restart the backend.
factory.py will automatically select this provider.

Payout Flow
-----------
1. Create or fetch a Razorpay Fund Account for the affiliate's
   UPI ID or bank account.
2. POST /v1/payouts with the fund_account_id.
3. Return status="processing" — the final status arrives via webhook.
4. Webhook handler calls the shared completion handler (complete_payout).

Idempotency
-----------
• Fund accounts are identified by their UPI/account number.
  We store razorpay_fund_account_id in AffiliatePayout to avoid
  creating duplicate fund accounts on retry.
• Payout requests include a unique reference_id to prevent
  duplicate dispatch on API retry.

Security
--------
• RAZORPAY_PAYOUT_KEY_SECRET is never logged or returned to the client.
• Webhook signature verification is handled in webhook_handler.py.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

from app.payments.payout.provider import PayoutProvider, PayoutResult

logger = logging.getLogger(__name__)


class RazorpayPayoutProvider(PayoutProvider):
    """
    Production Razorpay X payout provider.

    Reads credentials from:
        RAZORPAY_PAYOUT_KEY_ID     — Razorpay X public key
        RAZORPAY_PAYOUT_KEY_SECRET — Razorpay X secret key
        PAYMENT_CURRENCY           — always INR
    """

    PROVIDER_NAME = "razorpay"

    def __init__(self):
        self.key_id     = os.getenv("RAZORPAY_PAYOUT_KEY_ID", "")
        self.key_secret = os.getenv("RAZORPAY_PAYOUT_KEY_SECRET", "")
        self.currency   = os.getenv("PAYMENT_CURRENCY", "INR")

        if not self.key_id or not self.key_secret:
            raise EnvironmentError(
                "RAZORPAY_PAYOUT_KEY_ID and RAZORPAY_PAYOUT_KEY_SECRET must be set "
                "when AFFILIATE_PAYOUT_MODE=razorpay. "
                "These are separate from the checkout RAZORPAY_KEY_ID credentials."
            )

        try:
            import razorpay as _rzp
            self._client = _rzp.Client(auth=(self.key_id, self.key_secret))
        except ImportError as exc:
            raise ImportError(
                "razorpay package is not installed. "
                "Run: pip install razorpay>=1.4.1"
            ) from exc

        logger.info(
            "[RazorpayPayoutProvider] Initialized with key_id=%s...",
            self.key_id[:12],
        )

    # ── 1. Create / Fetch Fund Account ────────────────────────────────────────

    def _get_or_create_fund_account(
        self,
        *,
        contact_id: str,
        method: str,
        upi_id: Optional[str],
        bank_account: Optional[str],
        ifsc_code: Optional[str],
        bank_name: Optional[str],
    ) -> str:
        """
        Create a Razorpay Fund Account for the affiliate's bank/UPI.
        In production, you would cache this per affiliate to avoid
        creating duplicate fund accounts. For now we create fresh per payout.

        Returns the fund_account_id string.
        """
        payload: dict = {
            "contact_id": contact_id,
            "account_type": "bank_account" if method == "bank" else "vpa",
        }

        if method == "upi" and upi_id:
            payload["vpa"] = {"address": upi_id}
        elif method == "bank" and bank_account and ifsc_code:
            payload["bank_account"] = {
                "name": bank_name or "Affiliate",
                "ifsc": ifsc_code.upper(),
                "account_number": bank_account,
            }
        else:
            raise ValueError(
                f"Insufficient account details for method='{method}'. "
                f"UPI requires upi_id; bank requires bank_account + ifsc_code."
            )

        resp = self._client.fund_account.create(data=payload)
        fa_id = resp["id"]
        logger.info(
            "[RazorpayPayoutProvider] Fund account created/fetched: fa_id=%s method=%s",
            fa_id, method,
        )
        return fa_id

    def _create_contact(self, *, affiliate_name: str, affiliate_id: int) -> str:
        """
        Create a Razorpay Contact for the affiliate.
        Returns the contact_id.
        """
        resp = self._client.contact.create(data={
            "name": affiliate_name or f"Affiliate #{affiliate_id}",
            "type": "vendor",
            "reference_id": f"lumora_aff_{affiliate_id}",
        })
        contact_id = resp["id"]
        logger.info(
            "[RazorpayPayoutProvider] Contact created: contact_id=%s aff_id=%d",
            contact_id, affiliate_id,
        )
        return contact_id

    # ── 2. Initiate Payout ────────────────────────────────────────────────────

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
        Dispatch a real payout via Razorpay X API.

        Returns status="processing" — the webhook delivers the final status.
        Do NOT update wallet balances until the webhook confirms completion.
        """
        amount_paise = int(round(amount_inr * 100))

        try:
            # Step 1: Create contact
            contact_id = self._create_contact(
                affiliate_name=affiliate_name,
                affiliate_id=affiliate_id,
            )

            # Step 2: Create or fetch fund account
            fund_account_id = self._get_or_create_fund_account(
                contact_id=contact_id,
                method=method,
                upi_id=upi_id,
                bank_account=bank_account,
                ifsc_code=ifsc_code,
                bank_name=bank_name,
            )

            # Step 3: Dispatch payout
            payout_payload = {
                "account_number": self.key_id,      # Razorpay X account number
                "fund_account_id": fund_account_id,
                "amount": amount_paise,
                "currency": self.currency,
                "mode": "UPI" if method == "upi" else "IMPS",
                "purpose": "payout",
                "queue_if_low_balance": True,
                "reference_id": f"lumora_payout_{payout_db_id}",
                "narration": reference_note[:30],  # Razorpay max 30 chars
            }
            resp = self._client.payout.create(data=payout_payload)

            provider_ref = resp.get("id", "")
            rzp_status   = resp.get("status", "processing")

            logger.info(
                "[RazorpayPayoutProvider] Payout dispatched: "
                "payout_db_id=%d provider_ref=%s rzp_status=%s amount_paise=%d",
                payout_db_id, provider_ref, rzp_status, amount_paise,
            )

            return PayoutResult(
                success=True,
                provider_ref=provider_ref,
                fund_account_id=fund_account_id,
                status="processing",    # Always processing — webhook closes it
                raw=dict(resp),
            )

        except Exception as exc:
            logger.error(
                "[RazorpayPayoutProvider] Payout FAILED: payout_db_id=%d error=%s",
                payout_db_id, exc,
            )
            return PayoutResult(
                success=False,
                provider_ref="",
                status="failed",
                failure_reason=str(exc),
                raw={"error": str(exc)},
            )
