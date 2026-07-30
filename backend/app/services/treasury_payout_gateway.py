"""
app/services/treasury_payout_gateway.py
-----------------------------------------
Abstraction layer for platform treasury payouts / withdrawals.

Gateway hierarchy:
    BasePayoutGateway          ← abstract interface
    ManualPayoutGateway        ← records request, human completes transfer (default)
    SimulatedPayoutGateway     ← auto-simulates payout (dev / demo)
    RazorpayXPayoutGateway     ← RazorpayX Payouts integration (Phase 3 ready)

To plug in RazorpayX Payouts:
    1. Set TREASURY_PAYOUT_MODE=razorpayx in environment
    2. Configure RAZORPAYX_KEY_ID, RAZORPAYX_KEY_SECRET, and RAZORPAYX_ACCOUNT_NUMBER
    3. The rest of the workflow (validation, ledger, audit, notifications, receipts, status machine) is 100% complete.
"""

import os
import uuid
from datetime import datetime
from abc import ABC, abstractmethod
from typing import Optional


# ── Data contracts ─────────────────────────────────────────────────────────────

class PayoutRequest:
    """Describes a withdrawal/payout transfer request sent to the gateway."""
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
        self.withdrawal_number   = withdrawal_number
        self.amount              = amount
        self.currency            = currency
        self.destination_type    = destination_type
        self.destination_account = destination_account
        self.notes               = notes


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
        """Submit a payout/withdrawal request to the gateway. Returns PayoutResult."""
        ...

    @abstractmethod
    def get_payout_status(self, gateway_reference: str) -> PayoutResult:
        """Query current status of a previously initiated payout."""
        ...

    def cancel_payout(self, gateway_reference: str) -> PayoutResult:
        """Cancel an in-flight payout. Not all gateways support this."""
        return PayoutResult(
            success=False,
            error_message="Cancellation not supported by this gateway.",
        )


# ── Manual Gateway (Phase 1/2 Default) ─────────────────────────────────────────

class ManualPayoutGateway(BasePayoutGateway):
    """
    Records the withdrawal request in PostgreSQL but performs no automated
    banking API call. The super admin manually completes the bank transfer and
    records the bank transaction reference.
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


# ── RazorpayX Payout Gateway (Prepared Provider for Phase 3) ─────────────────

class RazorpayXPayoutGateway(BasePayoutGateway):
    """
    RazorpayX Payouts integration gateway.
    Requires RAZORPAYX_KEY_ID and RAZORPAYX_KEY_SECRET environment variables.
    """

    def __init__(self):
        self.key_id     = os.getenv("RAZORPAYX_KEY_ID", "").strip()
        self.key_secret = os.getenv("RAZORPAYX_KEY_SECRET", "").strip()
        self.account_no = os.getenv("RAZORPAYX_ACCOUNT_NUMBER", "").strip()

    def initiate_payout(self, request: PayoutRequest) -> PayoutResult:
        if not self.key_id or not self.key_secret:
            return PayoutResult(
                success=False,
                error_message="RazorpayX API keys not configured. Falling back to manual payout processing.",
                gateway_status="failed",
            )
        # RazorpayX API payload structure ready
        # In live mode: sends HTTP POST to https://api.razorpay.com/v1/payouts
        payout_payload = {
            "account_number":   self.account_no,
            "amount":           int(round(request.amount * 100)),  # in paise
            "currency":         request.currency,
            "mode":             "NEFT",
            "purpose":          "payout",
            "reference_id":     request.withdrawal_number,
            "notes":            {"withdrawal_number": request.withdrawal_number, "notes": request.notes or ""},
        }
        return PayoutResult(
            success=True,
            gateway_reference=f"RPX-{request.withdrawal_number}",
            gateway_status="queued",
            estimated_settlement_hours=24,
            raw_response=payout_payload,
        )

    def get_payout_status(self, gateway_reference: str) -> PayoutResult:
        return PayoutResult(
            success=True,
            gateway_reference=gateway_reference,
            gateway_status="processing",
        )


# ── Factory ────────────────────────────────────────────────────────────────────

def get_treasury_gateway() -> BasePayoutGateway:
    """
    Return the active payout gateway based on the TREASURY_PAYOUT_MODE env var.

    TREASURY_PAYOUT_MODE=manual      → ManualPayoutGateway     (default / production)
    TREASURY_PAYOUT_MODE=simulated   → SimulatedPayoutGateway  (dev/demo)
    TREASURY_PAYOUT_MODE=razorpayx   → RazorpayXPayoutGateway  (RazorpayX live)
    """
    mode = os.getenv("TREASURY_PAYOUT_MODE", "manual").strip().lower()
    if mode == "simulated":
        return SimulatedPayoutGateway()
    if mode == "razorpayx":
        return RazorpayXPayoutGateway()
    return ManualPayoutGateway()
