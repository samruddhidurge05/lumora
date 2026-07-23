"""
app/payments/payout/provider.py
================================
Abstract Payout Provider Interface.

Design Rules (MANDATORY)
------------------------
• Routes ONLY call provider.initiate_payout() — nothing else.
• All business logic (balance updates, audit logs) lives in the
  shared completion handler, NOT in the provider.
• Mock and Razorpay providers behave IDENTICALLY except for who
  executes the actual money transfer.
• Switching from mock → razorpay ONLY requires changing
  AFFILIATE_PAYOUT_MODE in .env. Zero code changes needed.

Status Machine
--------------
pending → processing → completed
                     ↘ failed
pending → rejected

"processing" means the provider has accepted the request and a
webhook is expected. The shared completion handler is the ONLY
place that moves status from processing → completed/failed.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


# ── Result Dataclass ──────────────────────────────────────────────────────────

@dataclass
class PayoutResult:
    """
    Returned by every provider's initiate_payout() call.

    success         True if provider accepted the request.
    provider_ref    Provider-assigned payout ID (razorpay_payout_id or mock ref).
    fund_account_id Provider fund-account reference (Razorpay X specific).
    status          One of: "processing" | "completed" | "failed".
                    Mock always returns "completed" synchronously.
                    Razorpay returns "processing" — webhook delivers final status.
    failure_reason  Set only when success=False.
    raw             Full provider response for debugging.
    """
    success: bool
    provider_ref: str                       # e.g. "pout_Abc123" or "mock_pout_001"
    fund_account_id: Optional[str] = None  # Razorpay fund account ID
    status: str = "processing"             # "processing" | "completed" | "failed"
    failure_reason: Optional[str] = None
    raw: dict = field(default_factory=dict)


# ── Abstract Interface ────────────────────────────────────────────────────────

class PayoutProvider(ABC):
    """
    Abstract base for all payout providers.

    Routes ONLY depend on this interface.
    Concrete providers: MockPayoutProvider, RazorpayPayoutProvider.

    To add a new provider (e.g. Stripe):
        1. Create stripe_provider.py, subclass PayoutProvider
        2. Implement initiate_payout()
        3. Register in factory.py
    """

    @abstractmethod
    def initiate_payout(
        self,
        *,
        payout_db_id: int,
        affiliate_id: int,
        amount_inr: float,
        method: str,                  # "upi" | "bank"
        upi_id: Optional[str],
        bank_account: Optional[str],
        ifsc_code: Optional[str],
        bank_name: Optional[str],
        affiliate_name: str,
        reference_note: str,          # e.g. "Lumora Affiliate Payout #42"
    ) -> PayoutResult:
        """
        Dispatch a payout to the affiliate's bank / UPI account.

        IMPORTANT: This method MUST NOT update the database.
        The caller (route handler) is responsible for persisting the result.
        This keeps providers stateless and independently testable.
        """
        raise NotImplementedError
