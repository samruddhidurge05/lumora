"""
app/services/treasury_payout_gateway.py
-----------------------------------------
Abstraction layer for platform treasury payouts / withdrawals.

Gateway hierarchy:
    BasePayoutGateway          <- abstract interface
    ManualPayoutGateway        <- records request, human completes transfer (default)
    SimulatedPayoutGateway     <- auto-simulates payout (dev / demo)
    RazorpayXPayoutGateway     <- RazorpayX Payouts integration (Phase 3 live)

To switch to RazorpayX live mode:
    1. Set TREASURY_PAYOUT_MODE=razorpayx in .env
    2. Configure RAZORPAYX_KEY_ID, RAZORPAYX_KEY_SECRET, RAZORPAYX_ACCOUNT_NUMBER
    3. Configure RAZORPAYX_WEBHOOK_SECRET for incoming webhook verification
    4. Set RAZORPAYX_DEFAULT_MODE to IMPS, NEFT, or RTGS (default: IMPS)
    5. The rest of the workflow (validation, ledger, audit, notifications, receipts,
       status machine) is 100% complete and untouched.
"""

import os
import uuid
import base64
import logging
from datetime import datetime, timezone
from abc import ABC, abstractmethod
from typing import Optional

import httpx

_logger = logging.getLogger("lumora.treasury.gateway")


def _utcnow() -> datetime:
    """Non-deprecated replacement for datetime.utcnow()."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---- Data contracts -----------------------------------------------------------

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
        gateway_reference: Optional[str] = None,
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


# ---- Abstract base -----------------------------------------------------------

class BasePayoutGateway(ABC):
    """
    All gateway implementations must conform to this interface.
    treasury_service.py calls only these methods, never gateway internals.
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


# ---- Manual Gateway (Phase 1/2 Default) --------------------------------------

class ManualPayoutGateway(BasePayoutGateway):
    """
    Records the withdrawal request in the database but performs no automated
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


# ---- Simulated Gateway (dev / demo) ------------------------------------------

class SimulatedPayoutGateway(BasePayoutGateway):
    """
    Auto-simulates a successful bank transfer for development and demo use.
    Generates a realistic UTR-format transaction reference.
    """

    def initiate_payout(self, request: PayoutRequest) -> PayoutResult:
        utr = "UTR" + _utcnow().strftime("%y%m%d") + uuid.uuid4().hex[:8].upper()
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


# ---- RazorpayX Payout Gateway (Phase 3 - Live) --------------------------------

class RazorpayXPayoutGateway(BasePayoutGateway):
    """
    Production RazorpayX Payouts integration gateway.

    Required environment variables:
        RAZORPAYX_KEY_ID          - RazorpayX API key ID (separate from checkout key)
        RAZORPAYX_KEY_SECRET      - RazorpayX API key secret
        RAZORPAYX_ACCOUNT_NUMBER  - Your RazorpayX current account number
        RAZORPAYX_DEFAULT_MODE    - IMPS (default), NEFT, or RTGS

    API flow for bank_account destination:
        1. POST /v1/contacts       -> create a Contact (payee entity)
        2. POST /v1/fund_accounts  -> create a Fund Account linked to Contact
        3. POST /v1/payouts        -> initiate the payout with idempotency key

    API flow for UPI destination:
        1. POST /v1/contacts       -> create a Contact
        2. POST /v1/fund_accounts  -> create Fund Account with vpa details
        3. POST /v1/payouts        -> initiate with mode=UPI
    """

    BASE_URL = "https://api.razorpay.com/v1"
    TIMEOUT  = 30.0

    def __init__(self):
        self.key_id       = os.getenv("RAZORPAYX_KEY_ID", "").strip()
        self.key_secret   = os.getenv("RAZORPAYX_KEY_SECRET", "").strip()
        self.account_no   = os.getenv("RAZORPAYX_ACCOUNT_NUMBER", "").strip()
        self.default_mode = os.getenv("RAZORPAYX_DEFAULT_MODE", "IMPS").strip().upper()

        if not self.key_id or not self.key_secret or not self.account_no:
            raise RuntimeError(
                "RazorpayX gateway is not configured. "
                "Set RAZORPAYX_KEY_ID, RAZORPAYX_KEY_SECRET, and RAZORPAYX_ACCOUNT_NUMBER "
                "in your environment before using TREASURY_PAYOUT_MODE=razorpayx."
            )

    # ---- Internal helpers -----------------------------------------------------

    def _auth_header(self) -> str:
        token = base64.b64encode(f"{self.key_id}:{self.key_secret}".encode()).decode()
        return f"Basic {token}"

    def _headers(self) -> dict:
        return {
            "Authorization": self._auth_header(),
            "Content-Type":  "application/json",
        }

    def _post(self, path: str, payload: dict, idempotency_key: Optional[str] = None) -> dict:
        headers = self._headers()
        if idempotency_key:
            headers["X-Payout-Idempotency"] = idempotency_key
        url = f"{self.BASE_URL}{path}"
        try:
            resp = httpx.post(url, json=payload, headers=headers, timeout=self.TIMEOUT)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            body = {}
            try:
                body = exc.response.json()
            except Exception:
                pass
            raise ValueError(
                f"RazorpayX API error {exc.response.status_code}: "
                f"{body.get('error', {}).get('description', exc.response.text)}"
            ) from exc
        except httpx.RequestError as exc:
            raise ValueError(f"RazorpayX network error: {exc}") from exc

    def _get(self, path: str) -> dict:
        url = f"{self.BASE_URL}{path}"
        try:
            resp = httpx.get(url, headers=self._headers(), timeout=self.TIMEOUT)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            body = {}
            try:
                body = exc.response.json()
            except Exception:
                pass
            raise ValueError(
                f"RazorpayX API error {exc.response.status_code}: "
                f"{body.get('error', {}).get('description', exc.response.text)}"
            ) from exc
        except httpx.RequestError as exc:
            raise ValueError(f"RazorpayX network error: {exc}") from exc

    def _create_contact(self, name: str, email: str = "", reference_id: str = "") -> str:
        payload: dict = {
            "name":         name or "Platform Owner",
            "type":         "self",
            "reference_id": reference_id,
        }
        if email:
            payload["email"] = email
        data = self._post("/contacts", payload)
        return data["id"]

    def _create_fund_account_bank(
        self, contact_id: str, account_number: str, ifsc: str, account_holder_name: str
    ) -> str:
        payload = {
            "contact_id":   contact_id,
            "account_type": "bank_account",
            "bank_account": {
                "name":           account_holder_name or "Platform Owner",
                "ifsc":           ifsc.upper(),
                "account_number": account_number,
            },
        }
        data = self._post("/fund_accounts", payload)
        return data["id"]

    def _create_fund_account_vpa(self, contact_id: str, vpa: str) -> str:
        payload = {
            "contact_id":   contact_id,
            "account_type": "vpa",
            "vpa":          {"address": vpa},
        }
        data = self._post("/fund_accounts", payload)
        return data["id"]

    # ---- Public gateway interface ---------------------------------------------

    def initiate_payout(self, request: PayoutRequest) -> PayoutResult:
        dest = request.destination_account
        try:
            contact_name  = dest.get("account_holder_name") or dest.get("name") or "Platform Owner"
            contact_email = dest.get("email", "")
            contact_id = self._create_contact(
                name=contact_name,
                email=contact_email,
                reference_id=request.withdrawal_number,
            )
            _logger.info("[razorpayx] Created contact %s for %s", contact_id, request.withdrawal_number)

            if request.destination_type == "upi":
                upi_id = dest.get("upi_id", "")
                fund_account_id = self._create_fund_account_vpa(contact_id, upi_id)
                transfer_mode = "UPI"
            else:
                fund_account_id = self._create_fund_account_bank(
                    contact_id=contact_id,
                    account_number=str(dest.get("account_number", "")),
                    ifsc=str(dest.get("ifsc_code", "")),
                    account_holder_name=contact_name,
                )
                transfer_mode = self.default_mode

            _logger.info("[razorpayx] Created fund account %s", fund_account_id)

            payout_payload = {
                "account_number":        self.account_no,
                "fund_account_id":       fund_account_id,
                "amount":                int(round(request.amount * 100)),
                "currency":              request.currency,
                "mode":                  transfer_mode,
                "purpose":               "payout",
                "reference_id":          request.withdrawal_number,
                "queue_if_low_balance":  True,
                "notes": {
                    "withdrawal_number": request.withdrawal_number,
                    "platform":          "lumora",
                    "notes":             request.notes or "",
                },
            }

            payout_data = self._post(
                "/payouts",
                payout_payload,
                idempotency_key=request.withdrawal_number,
            )

            payout_id     = payout_data.get("id", "")
            payout_status = payout_data.get("status", "queued")

            status_map = {
                "queued":     "queued",
                "processing": "processing",
                "processed":  "completed",
                "cancelled":  "cancelled",
                "rejected":   "failed",
                "reversed":   "failed",
            }
            mapped_status = status_map.get(payout_status, payout_status)

            _logger.info(
                "[razorpayx] Payout %s initiated for %s - status=%s mode=%s amount=%.2f",
                payout_id, request.withdrawal_number, payout_status, transfer_mode, request.amount,
            )

            return PayoutResult(
                success=True,
                gateway_reference=payout_id,
                gateway_status=mapped_status,
                estimated_settlement_hours=0 if transfer_mode in ("IMPS", "UPI") else 24,
                raw_response={
                    **payout_data,
                    "fund_account_id": fund_account_id,
                    "contact_id":      contact_id,
                    "transfer_mode":   transfer_mode,
                },
            )

        except ValueError as exc:
            _logger.error("[razorpayx] initiate_payout failed for %s: %s", request.withdrawal_number, exc)
            return PayoutResult(
                success=False,
                error_message=str(exc),
                gateway_status="failed",
                raw_response={"error": str(exc)},
            )

    def get_payout_status(self, gateway_reference: str) -> PayoutResult:
        if not gateway_reference or not gateway_reference.startswith("pout_"):
            return PayoutResult(
                success=False,
                gateway_reference=gateway_reference,
                gateway_status="unknown",
                error_message="Invalid or missing RazorpayX payout ID.",
            )
        try:
            data   = self._get(f"/payouts/{gateway_reference}")
            status = data.get("status", "unknown")
            utr    = data.get("utr")
            return PayoutResult(
                success=True,
                gateway_reference=utr or gateway_reference,
                gateway_status=status,
                raw_response=data,
            )
        except ValueError as exc:
            _logger.error("[razorpayx] get_payout_status failed for %s: %s", gateway_reference, exc)
            return PayoutResult(
                success=False,
                gateway_reference=gateway_reference,
                gateway_status="unknown",
                error_message=str(exc),
            )

    def cancel_payout(self, gateway_reference: str) -> PayoutResult:
        if not gateway_reference or not gateway_reference.startswith("pout_"):
            return PayoutResult(success=False, error_message="Invalid payout ID for cancellation.")
        try:
            data = self._post(f"/payouts/{gateway_reference}/cancel", {})
            return PayoutResult(
                success=True,
                gateway_reference=gateway_reference,
                gateway_status="cancelled",
                raw_response=data,
            )
        except ValueError as exc:
            _logger.error("[razorpayx] cancel_payout failed for %s: %s", gateway_reference, exc)
            return PayoutResult(
                success=False,
                gateway_reference=gateway_reference,
                gateway_status="unknown",
                error_message=str(exc),
            )


# ---- Factory -----------------------------------------------------------------

def get_treasury_gateway() -> BasePayoutGateway:
    """
    Return the active payout gateway based on the TREASURY_PAYOUT_MODE env var.

    TREASURY_PAYOUT_MODE=manual      -> ManualPayoutGateway     (default / safe)
    TREASURY_PAYOUT_MODE=simulated   -> SimulatedPayoutGateway  (dev/demo)
    TREASURY_PAYOUT_MODE=razorpayx   -> RazorpayXPayoutGateway  (live payouts)
    """
    mode = os.getenv("TREASURY_PAYOUT_MODE", "manual").strip().lower()
    if mode == "simulated":
        return SimulatedPayoutGateway()
    if mode == "razorpayx":
        return RazorpayXPayoutGateway()
    return ManualPayoutGateway()
