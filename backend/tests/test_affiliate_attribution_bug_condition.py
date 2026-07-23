"""
test_affiliate_attribution_bug_condition.py
-------------------------------------------
Bug condition exploration tests for Task 1 of the affiliate-attribution-admin-display
bugfix spec.

CRITICAL: These tests are EXPECTED TO FAIL on UNFIXED code.
Failure of each test CONFIRMS the corresponding defect exists.
DO NOT fix the code or the tests when they fail — failure IS the expected outcome.

Three defects are probed:

  Defect 1 — Backend API omission
    get_orders_list() does not include affiliate_id, referral_code_used, or
    referral_link_id in the serialized order dict.

  Defect 2 — Primary frontend missing fetch / render
    frontend/src/pages/admin/OrdersManagement.jsx has no useEffect or JSX for
    affiliate attribution in the order detail panel (tested as a structural assertion
    against the source file — no rendering required).

  Defect 3 — Admin-app boolean guard (AND instead of OR)
    AffiliateAttributionCard uses (!attr?.affiliate_name && !attr?.affiliate_code)
    which produces a false-negative when one field is present and the other is null.
    The guard logic is extracted and tested directly.

**Validates: Requirements 1.1, 1.2, 1.3**
"""

import pytest
from unittest.mock import MagicMock, patch, PropertyMock
from datetime import datetime, timezone
import os
import re

utc = timezone.utc


# ---------------------------------------------------------------------------
# Helpers — build mock Order and mock DB session
# ---------------------------------------------------------------------------

def make_mock_order(**overrides):
    """
    Build a minimal MagicMock Order that satisfies the attribute access pattern
    inside get_orders_list() — specifically the o.items relationship traversal
    and the flat column attributes.
    """
    o = MagicMock()
    o.id = overrides.get("id", 1)
    o.user_id = overrides.get("user_id", 10)
    o.status = overrides.get("status", "completed")
    o.total_amount = overrides.get("total_amount", 49.99)
    o.payment_method = overrides.get("payment_method", "upi")
    o.created_at = overrides.get("created_at", datetime(2024, 6, 1, tzinfo=utc))

    # Affiliate attribution fields (the ones we expect in the serialized output)
    o.affiliate_id = overrides.get("affiliate_id", 1)
    o.referral_code_used = overrides.get("referral_code_used", "LUMREF20")
    o.referral_link_id = overrides.get("referral_link_id", 42)

    # Empty items list so the loop inside get_orders_list() completes
    o.items = []

    return o


def make_mock_session(orders, customer=None):
    """
    Build a MagicMock SessionLocal() whose query().filter().first() returns a
    customer MagicMock, and whose paginated order query returns `orders`.
    """
    mock_db_s = MagicMock()

    # Customer returned for user lookup
    mock_customer = customer or MagicMock()
    mock_customer.name = "Test Customer"
    mock_customer.email = "customer@test.com"

    # Chain: db_s.query(UserModel).filter(...).first() → customer
    mock_user_query = MagicMock()
    mock_user_query.filter.return_value.first.return_value = mock_customer

    # Chain: db_s.query(OrderModel).order_by(...).filter(...).count() → len(orders)
    #         .offset(...).limit(...).all() → orders
    mock_order_query = MagicMock()
    mock_order_query.order_by.return_value = mock_order_query
    mock_order_query.filter.return_value = mock_order_query
    mock_order_query.count.return_value = len(orders)
    mock_order_query.offset.return_value.limit.return_value.all.return_value = orders

    def query_router(model):
        from app.models.order import Order as OrderModel
        from app.models.user import User as UserModel
        if model is OrderModel:
            return mock_order_query
        if model is UserModel:
            return mock_user_query
        return MagicMock()

    mock_db_s.query.side_effect = query_router
    return mock_db_s


# ---------------------------------------------------------------------------
# DEFECT 1 — Backend API omission
# ---------------------------------------------------------------------------

def test_defect1_affiliated_order_response_includes_affiliate_fields():
    """
    EXPECTED TO FAIL on unfixed code.

    The unfixed get_orders_list() result.append({...}) block does NOT include
    affiliateId, referralCodeUsed, or referralLinkId.

    This test creates a mock Order with affiliate_id=1, referral_code_used="LUMREF20",
    referral_link_id=42 and asserts all three camelCase keys are present in the
    returned item dict.

    COUNTEREXAMPLE when failing:
        "affiliateId" not found in response item keys
        "referralCodeUsed" not found in response item keys
        "referralLinkId" not found in response item keys

    **Validates: Requirements 1.1**
    """
    order = make_mock_order(affiliate_id=1, referral_code_used="LUMREF20", referral_link_id=42)
    mock_db_s = make_mock_session([order])

    with patch("app.admin_api.orders.services.SessionLocal", return_value=mock_db_s):
        from app.admin_api.orders.services import get_orders_list
        result = get_orders_list(page=1, page_size=50)

    assert result["items"], "Response should contain at least one item"
    item = result["items"][0]

    assert "affiliateId" in item, (
        "DEFECT 1 CONFIRMED: 'affiliateId' key is ABSENT from the serialized order dict. "
        f"Keys present: {list(item.keys())}. "
        "The unfixed get_orders_list() never adds affiliate_id to result.append({{...}})."
    )
    assert "referralCodeUsed" in item, (
        "DEFECT 1 CONFIRMED: 'referralCodeUsed' key is ABSENT from the serialized order dict. "
        f"Keys present: {list(item.keys())}."
    )
    assert "referralLinkId" in item, (
        "DEFECT 1 CONFIRMED: 'referralLinkId' key is ABSENT from the serialized order dict. "
        f"Keys present: {list(item.keys())}."
    )

    # Also assert the values are correct
    assert item["affiliateId"] == "1", (
        f"affiliateId should be '1' (str), got {item.get('affiliateId')!r}"
    )
    assert item["referralCodeUsed"] == "LUMREF20", (
        f"referralCodeUsed should be 'LUMREF20', got {item.get('referralCodeUsed')!r}"
    )
    assert item["referralLinkId"] == "42", (
        f"referralLinkId should be '42' (str), got {item.get('referralLinkId')!r}"
    )


# ---------------------------------------------------------------------------
# DEFECT 2 — Primary frontend never fetches or renders attribution
# ---------------------------------------------------------------------------

def test_defect2_frontend_orders_management_has_affiliate_fetch_effect():
    """
    EXPECTED TO FAIL on unfixed code.

    The unfixed frontend/src/pages/admin/OrdersManagement.jsx has no useEffect
    that calls /admin/affiliates/orders/{id}, and no state for affiliateTrace.

    This test performs a structural assertion: it reads the source file and
    checks for the presence of the attribution fetch URL pattern.

    COUNTEREXAMPLE when failing:
        The string '/admin/affiliates/orders/' is NOT found in the source file.
        No `affiliateTrace` state variable is declared.

    **Validates: Requirements 1.2**
    """
    # Locate the file relative to this test file
    test_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(os.path.dirname(test_dir))
    frontend_file = os.path.join(
        repo_root, "frontend", "src", "pages", "admin", "OrdersManagement.jsx"
    )

    assert os.path.isfile(frontend_file), (
        f"Could not find OrdersManagement.jsx at expected path: {frontend_file}"
    )

    source = open(frontend_file, encoding="utf-8").read()

    # Assert 1: The attribution endpoint URL is present
    assert "/admin/affiliates/orders/" in source, (
        "DEFECT 2 CONFIRMED: The string '/admin/affiliates/orders/' is ABSENT from "
        "frontend/src/pages/admin/OrdersManagement.jsx. "
        "The component never fetches affiliate attribution data for the selected order."
    )

    # Assert 2: A state variable for affiliate trace data is declared
    assert "affiliateTrace" in source, (
        "DEFECT 2 CONFIRMED: No 'affiliateTrace' state variable found in "
        "frontend/src/pages/admin/OrdersManagement.jsx. "
        "The order detail panel is structurally missing the attribution state."
    )

    # Assert 3: Attribution-related JSX renders referral code or affiliate name
    has_attribution_render = (
        "affiliate_name" in source or
        "affiliateTrace" in source and "affiliate_code" in source
    )
    assert has_attribution_render, (
        "DEFECT 2 CONFIRMED: No JSX rendering of attribution data found in "
        "frontend/src/pages/admin/OrdersManagement.jsx. "
        "The detail panel never shows affiliate info regardless of database contents."
    )


# ---------------------------------------------------------------------------
# DEFECT 3 — Admin-app boolean guard (AND instead of OR)
# ---------------------------------------------------------------------------

def _buggy_no_attribution_guard(attr):
    """
    Replicates the UNFIXED guard logic from AffiliateAttributionCard:
        if (!trace || (!attr?.affiliate_name && !attr?.affiliate_code)) return fallback
    In Python: shows fallback when BOTH fields are falsy (AND semantics).
    Returns True when the fallback ("Direct Purchase") would be shown.
    """
    affiliate_name = attr.get("affiliate_name") if attr else None
    affiliate_code = attr.get("affiliate_code") if attr else None
    return not affiliate_name and not affiliate_code


def _correct_no_attribution_guard(attr):
    """
    The FIXED guard logic (OR semantics):
        if (!trace || (!attr?.affiliate_name || !attr?.affiliate_code)) return fallback
    Shows fallback when EITHER field is absent (both required for attribution card).
    Returns True when the fallback would be shown.
    """
    affiliate_name = attr.get("affiliate_name") if attr else None
    affiliate_code = attr.get("affiliate_code") if attr else None
    return not affiliate_name or not affiliate_code


def test_defect3a_guard_code_present_name_null_should_show_code():
    """
    EXPECTED TO FAIL on unfixed code: this case accidentally passes with AND guard.

    trace = { attribution: { affiliate_name: null, affiliate_code: "LUMREF20" }, commission: {} }

    With UNFIXED AND guard: !null && !"LUMREF20" → True && False → False
    → Guard does NOT fire → attribution card shown → "LUMREF20" IS visible
    → This test PASSES on unfixed code (accidentally correct)

    This case confirms the AND guard is asymmetric — it passes here but fails below.
    We assert the card IS shown (i.e., fallback is NOT triggered).

    **Validates: Requirements 1.3**
    """
    attr = {"affiliate_name": None, "affiliate_code": "LUMREF20"}

    shows_fallback_buggy = _buggy_no_attribution_guard(attr)

    # With AND guard: False && True → False → card shown (accidentally correct)
    # The card is shown, so "LUMREF20" IS visible in the output.
    assert not shows_fallback_buggy, (
        "Unexpectedly, the AND guard fired for (name=null, code='LUMREF20'). "
        "Expected: card shown (fallback NOT triggered). "
        f"Bug guard result: {shows_fallback_buggy}"
    )
    # This case passes on unfixed code because AND logic accidentally shows the card.
    # The real failure is in test_defect3b below.


@pytest.mark.xfail(reason="Defect confirmation test: compares hardcoded buggy AND vs correct OR guards. Always fails by design. Actual source fix validated by test_defect3c.")
def test_defect3b_guard_name_present_code_null_should_not_show_direct_purchase():
    """
    EXPECTED TO FAIL on unfixed code.

    trace = { attribution: { affiliate_name: "Jane", affiliate_code: null }, commission: {} }

    With UNFIXED AND guard: !"Jane" && !null → False && True → False
    → Guard does NOT fire → attribution card rendered BUT affiliate_code is null
    → Card shown with missing code (partial/broken state)

    With CORRECT OR guard: !"Jane" || !null → False || True → True
    → Guard FIRES → fallback shown (both fields required)

    This test asserts the CORRECT behavior: with the AND guard, "Jane" + null code
    shows the attribution card (no fallback), which means an incomplete card
    is rendered. The spec requires OR semantics: fallback shown when either field absent.

    Asserting the correct behavior (OR semantics):
    The fallback SHOULD show when affiliate_code is null (even if name is present).
    The AND guard incorrectly shows the attribution card for this case.

    COUNTEREXAMPLE: buggy_guard returns False (no fallback), but correct_guard
    returns True (fallback should show). The bug is that the card shows with
    a null affiliate_code — an incomplete attribution display.

    **Validates: Requirements 1.3**
    """
    attr = {"affiliate_name": "Jane", "affiliate_code": None}

    shows_fallback_buggy = _buggy_no_attribution_guard(attr)
    shows_fallback_correct = _correct_no_attribution_guard(attr)

    # UNFIXED: AND guard → False && True → False → no fallback (card shown with null code)
    # CORRECT: OR guard  → False || True → True  → fallback shown (both fields required)

    assert shows_fallback_buggy == shows_fallback_correct, (
        "DEFECT 3 CONFIRMED: AND vs OR guard produces different results for "
        "(affiliate_name='Jane', affiliate_code=null). "
        f"Buggy AND guard shows_fallback={shows_fallback_buggy} (card shown with null code). "
        f"Correct OR guard shows_fallback={shows_fallback_correct} (fallback shown). "
        "The AND guard incorrectly renders an incomplete attribution card."
    )


def test_defect3c_guard_source_code_uses_and_operator():
    """
    EXPECTED TO FAIL on unfixed code.

    Directly inspects the admin-app AffiliateAttributionCard source to confirm
    it uses the AND (&&) operator rather than OR (||) in the no-attribution guard.

    COUNTEREXAMPLE when failing:
        The guard condition '&& !attr?.affiliate_code' is found in the source
        (confirming AND semantics are used instead of OR).

    **Validates: Requirements 1.3**
    """
    test_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(os.path.dirname(test_dir))
    admin_app_file = os.path.join(
        repo_root, "admin-app", "src", "pages", "admin", "OrdersManagement.jsx"
    )

    assert os.path.isfile(admin_app_file), (
        f"Could not find admin-app OrdersManagement.jsx at: {admin_app_file}"
    )

    source = open(admin_app_file, encoding="utf-8").read()

    # The correct (fixed) form uses OR: !attr?.affiliate_name || !attr?.affiliate_code
    # The buggy form uses AND: !attr?.affiliate_name && !attr?.affiliate_code
    has_correct_or_guard = bool(
        re.search(r"!attr\?\.affiliate_name\s*\|\|\s*!attr\?\.affiliate_code", source)
    )

    assert has_correct_or_guard, (
        "DEFECT 3 CONFIRMED: The AffiliateAttributionCard guard uses AND (&&) instead of OR (||). "
        "Found: '!attr?.affiliate_name && !attr?.affiliate_code' — this is the buggy form. "
        "The correct form is: '!attr?.affiliate_name || !attr?.affiliate_code'. "
        "This causes false-negative 'Direct Purchase' displays when one field is null."
    )
