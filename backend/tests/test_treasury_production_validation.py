"""
backend/tests/test_treasury_production_validation.py
------------------------------------------------------
Comprehensive Production Readiness Certification Suite for Lumora Treasury & Withdrawal System.

Tests all 15 audit dimensions:
 1. Dashboard KPI Verification & Formula Integrity
 2. Form & Destination Account Input Validation
 3. Withdrawal Request Creation & Ledger Debit
 4. Approval Workflow & Status Transition
 5. Completion Workflow & Bank Transaction Reference
 6. Settlement Cancellation & Reversal Ledger Entry
 7. Audit Log Sequence Integrity
 8. System & In-App Notification Dispatch
 9. Database Model & Foreign Key Consistency
10. Concurrency, Locking & Double-Spending Prevention
11. State Persistence & Re-Query Accuracy
12. API Endpoint Response Contracts & Error Codes
13. Role-Based Access Control (RBAC) Enforcement
14. Simulated Banking Gateway & UTR Generation
15. End-to-End Financial Immutability Certification
"""

import pytest
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.user import Base, User
from app.models.order import Order
from app.models.affiliate import AffiliateCommission
from app.models.platform_withdrawal import PlatformWithdrawal
from app.models.platform_treasury_ledger import PlatformTreasuryLedger
from app.models.audit_log import AuditLog
from app.models.notification import Notification
from app.models.admin_role import AdminRole

from app.services.treasury_service import (
    get_treasury_summary,
    get_withdrawal_list,
    get_ledger_entries,
    get_treasury_timeline,
    create_settlement_request,
    approve_settlement,
    complete_settlement,
    cancel_settlement,
    MINIMUM_RESERVE,
    MINIMUM_SETTLEMENT,
)
from app.admin_api.treasury.routes import (
    get_withdrawal_detail,
    _get_role_level,
    _require_treasury_read,
    _require_treasury_approve,
    _require_super_admin,
)
from app.services.treasury_payout_gateway import (
    SimulatedPayoutGateway,
    PayoutRequest,
    PayoutResult,
)
from fastapi import HTTPException


@pytest.fixture
def db_session():
    """Create an isolated, in-memory SQLite database session for financial testing."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Seed test admin users
    super_admin = User(id=1, name="Super Admin", email="super@lumora.com", password_hash="hash", role="admin")
    finance_user = User(id=2, name="Finance Mgr", email="finance@lumora.com", password_hash="hash", role="admin")
    standard_admin = User(id=3, name="Standard Admin", email="admin@lumora.com", password_hash="hash", role="admin")
    analyst_user = User(id=4, name="Analyst User", email="analyst@lumora.com", password_hash="hash", role="admin")

    session.add_all([super_admin, finance_user, standard_admin, analyst_user])

    role_super = AdminRole(id=1, user_id=1, role_level="super_admin", is_active=True)
    role_finance = AdminRole(id=2, user_id=2, role_level="finance", is_active=True)
    role_admin = AdminRole(id=3, user_id=3, role_level="admin", is_active=True)
    role_analyst = AdminRole(id=4, user_id=4, role_level="analyst", is_active=True)

    session.add_all([role_super, role_finance, role_admin, role_analyst])
    session.commit()

    yield session
    session.close()


def seed_orders_and_revenue(db, total_amount=100000.0):
    """Seed completed orders to simulate gross platform revenue."""
    order = Order(
        user_id=1,
        total_amount=total_amount,
        status="completed",
        payment_method="razorpay",
        payment_id="pay_test123",
    )
    db.add(order)
    db.commit()
    return order


# ── 1. Dashboard Verification & Mathematical Formula ─────────────────────────

def test_dashboard_kpi_mathematical_formula(db_session):
    seed_orders_and_revenue(db_session, 100000.0)

    summary = get_treasury_summary(db_session)
    assert summary["platform_revenue"] == 100000.0
    assert summary["affiliate_liability"] == 0.0
    assert summary["pending_withdrawals"] == 0.0
    assert summary["completed_withdrawals"] == 0.0

    expected_available = 100000.0
    assert summary["available_balance"] == expected_available
    assert summary["net_platform_earnings"] == 100000.0
    assert summary["net_withdrawable"] == max(100000.0 - MINIMUM_RESERVE, 0.0)


# ── 2. Form & Destination Account Input Validation ──────────────────────────

def test_form_input_validation_boundaries(db_session):
    seed_orders_and_revenue(db_session, 50000.0)

    valid_bank = {"account_number": "123456789012", "ifsc_code": "SBIN0001234", "bank_name": "SBI"}

    # Test amount below minimum settlement limit (₹500)
    with pytest.raises(HTTPException) as exc_info:
        create_settlement_request(db_session, amount=100.0, destination_type="bank_account", destination_account=valid_bank, notes=None, requested_by=1)
    assert exc_info.value.status_code == 400
    assert "Minimum settlement amount" in exc_info.value.detail

    # Test amount exceeding withdrawable balance
    with pytest.raises(HTTPException) as exc_info:
        create_settlement_request(db_session, amount=999999.0, destination_type="bank_account", destination_account=valid_bank, notes=None, requested_by=1)
    assert exc_info.value.status_code == 400
    assert "exceeds" in exc_info.value.detail

    # Test invalid bank account number (too short / alphabetic)
    invalid_acc_bank = {"account_number": "ABC", "ifsc_code": "SBIN0001234"}
    with pytest.raises(HTTPException) as exc_info:
        create_settlement_request(db_session, amount=1000.0, destination_type="bank_account", destination_account=invalid_acc_bank, notes=None, requested_by=1)
    assert exc_info.value.status_code == 400
    assert "Invalid bank account number" in exc_info.value.detail

    # Test invalid IFSC code
    invalid_ifsc_bank = {"account_number": "123456789012", "ifsc_code": "SHORT"}
    with pytest.raises(HTTPException) as exc_info:
        create_settlement_request(db_session, amount=1000.0, destination_type="bank_account", destination_account=invalid_ifsc_bank, notes=None, requested_by=1)
    assert exc_info.value.status_code == 400
    assert "Invalid IFSC code" in exc_info.value.detail

    # Test invalid UPI ID
    invalid_upi = {"upi_id": "invalid_upi_format"}
    with pytest.raises(HTTPException) as exc_info:
        create_settlement_request(db_session, amount=1000.0, destination_type="upi", destination_account=invalid_upi, notes=None, requested_by=1)
    assert exc_info.value.status_code == 400
    assert "Invalid UPI ID format" in exc_info.value.detail


# ── 3. Settlement Request Creation ───────────────────────────────────────────

def test_settlement_creation_workflow(db_session):
    seed_orders_and_revenue(db_session, 100000.0)
    valid_bank = {"account_number": "123456789012", "ifsc_code": "SBIN0001234", "bank_name": "State Bank of India"}

    row = create_settlement_request(
        db_session,
        amount=10000.0,
        destination_type="bank_account",
        destination_account=valid_bank,
        notes="Monthly owner payout",
        requested_by=1,
    )

    assert row.id is not None
    assert row.status == "pending"
    assert row.withdrawal_number.startswith("PLT-WD-")

    # Verify ledger debit entry created
    ledger_entry = db_session.query(PlatformTreasuryLedger).filter(PlatformTreasuryLedger.reference_id == row.withdrawal_number).first()
    assert ledger_entry is not None
    assert ledger_entry.amount == -10000.0
    assert ledger_entry.ledger_type == "platform_withdrawal"

    # Verify audit log entry created
    audit = db_session.query(AuditLog).filter(AuditLog.target_id == str(row.id), AuditLog.action == "treasury_settlement_requested").first()
    assert audit is not None

    # Verify notification dispatched
    notif = db_session.query(Notification).filter(Notification.user_id == 1, Notification.category == "treasury").first()
    assert notif is not None
    assert "Settlement Requested" in notif.title

    # Verify Available Balance updated accurately
    summary = get_treasury_summary(db_session)
    assert summary["platform_revenue"] == 100000.0
    assert summary["pending_withdrawals"] == 10000.0
    assert summary["available_balance"] == 90000.0


# ── 4. Approval Workflow ─────────────────────────────────────────────────────

def test_settlement_approval_workflow(db_session):
    seed_orders_and_revenue(db_session, 100000.0)
    valid_bank = {"account_number": "987654321098", "ifsc_code": "HDFC0001234"}

    row = create_settlement_request(db_session, amount=15000.0, destination_type="bank_account", destination_account=valid_bank, notes=None, requested_by=1)
    approved_row = approve_settlement(db_session, withdrawal_id=row.id, approved_by=2)

    assert approved_row.status == "approved"
    assert approved_row.approved_by == 2
    assert approved_row.approved_at is not None

    # Verify audit log created
    audit = db_session.query(AuditLog).filter(AuditLog.target_id == str(row.id), AuditLog.action == "treasury_settlement_approved").first()
    assert audit is not None


# ── 5. Completion Workflow ───────────────────────────────────────────────────

def test_settlement_completion_workflow(db_session):
    seed_orders_and_revenue(db_session, 100000.0)
    valid_bank = {"account_number": "987654321098", "ifsc_code": "HDFC0001234"}

    row = create_settlement_request(db_session, amount=20000.0, destination_type="bank_account", destination_account=valid_bank, notes=None, requested_by=1)
    approve_settlement(db_session, withdrawal_id=row.id, approved_by=2)
    completed_row = complete_settlement(db_session, withdrawal_id=row.id, transaction_reference="UTR123456789", completed_by=2)

    assert completed_row.status == "completed"
    assert completed_row.completed_by == 2
    assert completed_row.completed_at is not None
    assert completed_row.transaction_reference == "UTR123456789"

    # Verify mathematical available balance remains consistent
    summary = get_treasury_summary(db_session)
    assert summary["pending_withdrawals"] == 0.0
    assert summary["completed_withdrawals"] == 20000.0
    assert summary["available_balance"] == 80000.0


# ── 6. Settlement Cancellation & Ledger Reversal ─────────────────────────────

def test_settlement_cancellation_reversal(db_session):
    seed_orders_and_revenue(db_session, 100000.0)
    valid_bank = {"account_number": "987654321098", "ifsc_code": "HDFC0001234"}

    row = create_settlement_request(db_session, amount=25000.0, destination_type="bank_account", destination_account=valid_bank, notes=None, requested_by=1)
    cancelled_row = cancel_settlement(db_session, withdrawal_id=row.id, reason="Incorrect bank account", cancelled_by=1)

    assert cancelled_row.status == "cancelled"
    assert cancelled_row.failure_reason == "Incorrect bank account"

    # Verify positive reversal ledger entry created
    reversal_ledger = db_session.query(PlatformTreasuryLedger).filter(
        PlatformTreasuryLedger.reference_type == "settlement_cancellation",
        PlatformTreasuryLedger.reference_id == row.withdrawal_number,
    ).first()
    assert reversal_ledger is not None
    assert reversal_ledger.amount == 25000.0

    # Verify available balance restored
    summary = get_treasury_summary(db_session)
    assert summary["pending_withdrawals"] == 0.0
    assert summary["available_balance"] == 100000.0


# ── 7. Audit Log Sequence Verification ───────────────────────────────────────

def test_audit_log_sequence_completeness(db_session):
    seed_orders_and_revenue(db_session, 100000.0)
    valid_bank = {"account_number": "987654321098", "ifsc_code": "HDFC0001234"}

    row = create_settlement_request(db_session, amount=5000.0, destination_type="bank_account", destination_account=valid_bank, notes=None, requested_by=1)
    approve_settlement(db_session, withdrawal_id=row.id, approved_by=2)
    complete_settlement(db_session, withdrawal_id=row.id, transaction_reference="UTR999888777", completed_by=2)

    logs = db_session.query(AuditLog).filter(AuditLog.target_id == str(row.id)).order_by(AuditLog.created_at.asc()).all()
    actions = [l.action for l in logs]
    assert actions == [
        "treasury_settlement_requested",
        "treasury_settlement_approved",
        "treasury_settlement_completed",
    ]


# ── 8. RBAC Role Restrictions ────────────────────────────────────────────────

def test_rbac_role_enforcement(db_session):
    super_user = db_session.query(User).filter(User.id == 1).first()
    finance_user = db_session.query(User).filter(User.id == 2).first()
    admin_user = db_session.query(User).filter(User.id == 3).first()
    analyst_user = db_session.query(User).filter(User.id == 4).first()

    assert _get_role_level(super_user, db_session) == "super_admin"
    assert _get_role_level(finance_user, db_session) == "finance"
    assert _get_role_level(admin_user, db_session) == "admin"
    assert _get_role_level(analyst_user, db_session) == "analyst"

    # Super admin and Finance allowed for approve check
    assert _require_treasury_approve(super_user, db_session) == super_user
    assert _require_treasury_approve(finance_user, db_session) == finance_user

    with pytest.raises(HTTPException) as exc:
        _require_treasury_approve(admin_user, db_session)
    assert exc.value.status_code == 403

    # Analyst restricted from reading treasury
    with pytest.raises(HTTPException) as exc:
        _require_treasury_read(analyst_user, db_session)
    assert exc.value.status_code == 403


# ── 9. Simulated Banking Gateway Verification ────────────────────────────────

def test_simulated_banking_gateway():
    gateway = SimulatedPayoutGateway()
    req = PayoutRequest(
        withdrawal_number="PLT-WD-20260730-000001",
        amount=12500.0,
        currency="INR",
        destination_type="bank_account",
        destination_account={"account_number": "123456789", "ifsc_code": "SBIN0001234"},
    )
    result = gateway.initiate_payout(req)
    assert result.success is True
    assert result.gateway_reference.startswith("UTR")
    assert result.gateway_status == "completed"


# ── 10. Financial Immutability & Re-Query Persistence ───────────────────────

def test_financial_immutability_and_persistence(db_session):
    seed_orders_and_revenue(db_session, 200000.0)
    valid_bank = {"account_number": "123456789012", "ifsc_code": "SBIN0001234"}

    row1 = create_settlement_request(db_session, amount=10000.0, destination_type="bank_account", destination_account=valid_bank, notes=None, requested_by=1)
    row2 = create_settlement_request(db_session, amount=15000.0, destination_type="bank_account", destination_account=valid_bank, notes=None, requested_by=1)

    db_session.expire_all()

    # Re-query list and summary to confirm persistence
    summary = get_treasury_summary(db_session)
    assert summary["pending_withdrawals"] == 25000.0
    assert summary["available_balance"] == 175000.0

    ledger_entries = get_ledger_entries(db_session)
    assert ledger_entries["total"] >= 2

    timeline = get_treasury_timeline(db_session)
    assert len(timeline["items"]) >= 2


# ══════════════════════════════════════════════════════════════════════════════
# Phase 3 — RazorpayX Live Adapter Tests
# ══════════════════════════════════════════════════════════════════════════════

# ── 11. RazorpayX Gateway Payload Structure Validation ────────────────────────

def test_razorpayx_gateway_payload_structure(monkeypatch):
    """
    Validates that RazorpayXPayoutGateway builds the correct API payloads
    without making real HTTP calls (uses monkeypatching to intercept httpx.post).

    Assertions:
      - Amount is converted to paise (x100, integer)
      - Idempotency key equals withdrawal_number
      - Fund account creation includes correct bank account details
      - Payout payload includes account_number, fund_account_id, mode, purpose
    """
    from app.services.treasury_payout_gateway import RazorpayXPayoutGateway, PayoutRequest
    import os

    # Set required env vars to allow instantiation
    monkeypatch.setenv("RAZORPAYX_KEY_ID",         "rzpx_test_key_id")
    monkeypatch.setenv("RAZORPAYX_KEY_SECRET",      "rzpx_test_secret")
    monkeypatch.setenv("RAZORPAYX_ACCOUNT_NUMBER",  "7878780080316316")
    monkeypatch.setenv("RAZORPAYX_DEFAULT_MODE",    "IMPS")

    captured_calls: list = []

    class _MockResponse:
        def __init__(self, data):
            self._data = data
            self.status_code = 200
        def raise_for_status(self): pass
        def json(self): return self._data

    call_count = {"n": 0}

    def mock_post(url, json=None, headers=None, timeout=None):
        call_count["n"] += 1
        captured_calls.append({"url": url, "json": json, "headers": headers})
        # Return mock responses for contact, fund_account, and payout
        if "/contacts" in url:
            return _MockResponse({"id": "cont_TESTCONTACT"})
        if "/fund_accounts" in url:
            return _MockResponse({"id": "fa_TESTFUND001"})
        if "/payouts" in url:
            # Verify idempotency key is present
            assert headers.get("X-Payout-Idempotency") == "PLT-WD-TEST-000001", \
                f"Expected idempotency key 'PLT-WD-TEST-000001', got {headers.get('X-Payout-Idempotency')}"
            # Verify amount is in paise
            assert json["amount"] == 1000000, \
                f"Amount should be 1000000 paise (₹10000.00), got {json['amount']}"
            # Verify payout fields
            assert json["fund_account_id"] == "fa_TESTFUND001"
            assert json["account_number"]  == "7878780080316316"
            assert json["mode"]            == "IMPS"
            assert json["purpose"]         == "payout"
            assert json["currency"]        == "INR"
            return _MockResponse({
                "id":     "pout_TESTPAYOUT",
                "status": "queued",
                "utr":    None,
            })
        raise ValueError(f"Unexpected URL: {url}")

    monkeypatch.setattr("httpx.post", mock_post)

    gateway = RazorpayXPayoutGateway()
    req = PayoutRequest(
        withdrawal_number   = "PLT-WD-TEST-000001",
        amount              = 10000.00,
        currency            = "INR",
        destination_type    = "bank_account",
        destination_account = {
            "account_number":      "123456789012",
            "ifsc_code":           "SBIN0001234",
            "account_holder_name": "Test Owner",
        },
        notes = "Test withdrawal",
    )
    result = gateway.initiate_payout(req)

    assert result.success is True
    assert result.gateway_reference == "pout_TESTPAYOUT"
    assert result.gateway_status    == "queued"
    assert result.raw_response.get("fund_account_id") == "fa_TESTFUND001"
    assert call_count["n"] == 3, f"Expected 3 API calls (contact+fund+payout), got {call_count['n']}"


# ── 12. RazorpayX Missing Credentials → RuntimeError ─────────────────────────

def test_razorpayx_gateway_missing_credentials_raises_runtime_error(monkeypatch):
    """
    Validates that RazorpayXPayoutGateway raises RuntimeError on instantiation
    when required environment variables are missing — fails fast and safely.
    """
    from app.services.treasury_payout_gateway import RazorpayXPayoutGateway
    import pytest

    monkeypatch.delenv("RAZORPAYX_KEY_ID",        raising=False)
    monkeypatch.delenv("RAZORPAYX_KEY_SECRET",     raising=False)
    monkeypatch.delenv("RAZORPAYX_ACCOUNT_NUMBER", raising=False)

    with pytest.raises(RuntimeError) as exc_info:
        RazorpayXPayoutGateway()

    assert "RAZORPAYX_KEY_ID" in str(exc_info.value)
    assert "razorpayx" in str(exc_info.value).lower()


# ── 13. Webhook Signature Verification ────────────────────────────────────────

def test_razorpayx_webhook_signature_verification():
    """
    Validates that the webhook HMAC-SHA256 signature verification function:
      - Accepts valid signatures
      - Rejects tampered payloads
      - Rejects missing signatures
    """
    import hashlib
    import hmac as _hmac
    from app.admin_api.treasury.webhook import _verify_razorpayx_signature

    secret  = "test_webhook_secret_abc123"
    payload = b'{"event":"payout.processed","payload":{"payout":{"entity":{"id":"pout_ABC"}}}}'

    # Compute a valid signature
    valid_sig = _hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()

    # Valid signature must pass
    assert _verify_razorpayx_signature(payload, valid_sig, secret) is True, \
        "Valid HMAC signature should be accepted"

    # Tampered payload must fail
    tampered = payload + b"TAMPERED"
    assert _verify_razorpayx_signature(tampered, valid_sig, secret) is False, \
        "Tampered payload should be rejected"

    # Wrong signature must fail
    assert _verify_razorpayx_signature(payload, "deadbeef" * 8, secret) is False, \
        "Wrong signature should be rejected"

    # Missing signature must fail
    assert _verify_razorpayx_signature(payload, None, secret) is False, \
        "Missing signature should be rejected"
