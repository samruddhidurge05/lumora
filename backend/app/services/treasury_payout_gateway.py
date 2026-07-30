"""
app/services/treasury_payout_gateway.py
-----------------------------------------
Abstraction layer for platform treasury payouts.

Gateway hierarchy:
    BasePayoutGateway          ← abstract interface
    ManualPayoutGateway        ← records request, human completes transfer
    SimulatedPayoutGateway     ← auto-simulates settlement (dev / demo)

To plug in RazorpayX / Stripe Treasury / Wise in Phase 2:
    1. Subclass BasePayoutGateway.
    2. Override initiate_payout() and get_payout_status().
    3. Swap the active gateway in get_treasury_gateway().
    NO changes to models, service, or frontend required.
"""

import os
import uuid
from datetime import datetime
from abc import ABC, abstractmethod
from typing import Optional


# ── Data contracts ─────────────────────────────────────────────────────────────

class PayoutRequest:
    """Describes a payout transfer request sent to the gateway."""
    def __init__(
        self,
        *,
        withdrawal_number: str,
        amount: float,
        currency: str = "INR",
        destination_type: str = "bank_account",
        destination_account: dict,
        notes: Optional[str] = None,
    ):
        self.withdrawal_number  = withdrawal_number
        self.amount             = amount
        self.currency           = currency
        self.destination_type   = destination_type
        self.destination_account = destination_account
        self.notes              = notes


class PayoutResult:
    """Normalised response from the payout gateway."""
    def __init__(
        self,
        *,
        success: bool,
        gateway_reference: Optional[str] = None,   # UTR / bank reference
        gateway_status: str = "pending",
        estimated_settlement_hours: int = 48,
        error_message: Optional[str] = None,
        raw_response: Optional[dict] = None,
    ):
        self.success                      = success
        self.gateway_reference            = gateway_reference
        self.gateway_status               = gateway_status
        self.estimated_settlement_hours   = estimated_settlement_hours
        self.error_message                = error_message
        self.raw_response                 = raw_response or {}


# ── Abstract base ──────────────────────────────────────────────────────────────

class BasePayoutGateway(ABC):
    """
    All gateway implementations must conform to this interface.
    The treasury_service.py calls only these methods — never gateway internals.
    """

    @abstractmethod
    def initiate_payout(self, request: PayoutRequest) -> PayoutResult:
        """Submit a payout request to the gateway.  Returns PayoutResult."""
        ...

    @abstractmethod
    def get_payout_status(self, gateway_reference: str) -> PayoutResult:
        """Query current status of a previously initiated payout."""
        ...

    def cancel_payout(self, gateway_reference: str) -> PayoutResult:
        """Cancel an in-flight payout.  Not all gateways support this."""
        return PayoutResult(
            success=False,
            error_message="Cancellation not supported by this gateway.",
        )


# ── Manual Gateway ─────────────────────────────────────────────────────────────

class ManualPayoutGateway(BasePayoutGateway):
    """
    Records the withdrawal request in the database but performs no automated
    transfer.  The platform owner manually completes the bank transfer and
    then marks the withdrawal as completed via the admin portal.

    This is the Phase 1 production mode.
    """

    def initiate_payout(self, request: PayoutRequest) -> PayoutResult:
        ref = f"MANUAL-{request.withdrawal_number}"
        return PayoutResult(
            success=True,
            gateway_reference=ref,
            gateway_status="pending_manual",
            estimated_settlement_hours=48,
            raw_response={"mode": "manual", "reference": ref},
        )

    def get_payout_status(self, gateway_reference: str) -> PayoutResult:
        return PayoutResult(
            success=True,
            gateway_reference=gateway_reference,
            gateway_status="pending_manual",
        )


# ── Simulated Gateway (dev / demo) ────────────────────────────────────────────

class SimulatedPayoutGateway(BasePayoutGateway):
    """
    Auto-simulates a successful bank transfer for development and demo use.
    Generates a realistic UTR-format transaction reference.
    Never used in production — only when TREASURY_PAYOUT_MODE=simulated.
    """

    def initiate_payout(self, request: PayoutRequest) -> PayoutResult:
        utr = "UTR" + datetime.utcnow().strftime("%y%m%d") + uuid.uuid4().hex[:8].upper()
        return PayoutResult(
            success=True,
            gateway_reference=utr,
            gateway_status="completed",
            estimated_settlement_hours=0,
            raw_response={"mode": "simulated", "utr": utr, "amount": request.amount},
        )

    def get_payout_status(self, gateway_reference: str) -> PayoutResult:
        return PayoutResult(
            success=True,
            gateway_reference=gateway_reference,
            gateway_status="completed",
        )


# ── Factory ────────────────────────────────────────────────────────────────────

def get_treasury_gateway() -> BasePayoutGateway:
    """
    Return the active payout gateway based on the TREASURY_PAYOUT_MODE env var.

    TREASURY_PAYOUT_MODE=manual      → ManualPayoutGateway  (default / Phase 1)
    TREASURY_PAYOUT_MODE=simulated   → SimulatedPayoutGateway (dev/demo)
    TREASURY_PAYOUT_MODE=razorpayx   → (Phase 2 — not yet implemented)
    """
    mode = os.getenv("TREASURY_PAYOUT_MODE", "manual").strip().lower()
    if mode == "simulated":
        return SimulatedPayoutGateway()
    # Default: manual
    return ManualPayoutGateway()
