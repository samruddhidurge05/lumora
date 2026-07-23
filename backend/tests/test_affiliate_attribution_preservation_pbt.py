"""
test_affiliate_attribution_preservation_pbt.py
-----------------------------------------------
Preservation property tests for Task 2 of the affiliate-attribution-admin-display
bugfix spec.

These tests run against UNFIXED code first (baseline pass), then re-run after
the fix to confirm no regressions.

Strategy: split into TWO sub-groups:

  (a) test_existing_fields_preservation  — tests that PASS on unfixed code.
      Confirms the 12 pre-existing response fields are stable for any direct-
      purchase order (affiliate_id=None). This is the baseline we must not break.

  (b) test_null_affiliate_fields         — tests that PASS *after* the fix.
      Confirms the three new affiliate keys are present and set to None for
      direct-purchase orders. On unfixed code these keys are absent, so the
      test is written for the fixed shape.

Run only group (a) on unfixed code:
    pytest backend/tests/test_affiliate_attribution_preservation_pbt.py \
           -k "existing_fields" -v

Run full suite after the fix is applied:
    pytest backend/tests/test_affiliate_attribution_preservation_pbt.py -v

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
"""

import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone
from hypothesis import given, settings, HealthCheck, assume
from hypothesis import strategies as st

utc = timezone.utc

# ---------------------------------------------------------------------------
# Constants — the 12 pre-existing fields
# ---------------------------------------------------------------------------

EXISTING_FIELDS = [
    "id",
    "orderId",
    "customerId",
    "customerName",
    "customerEmail",
    "items",
    "totalUSD",
    "price",
    "status",
    "paymentStatus",
    "paymentMethod",
    "createdAt",
]

# Statuses recognized by the service
VALID_STATUSES = ["completed", "pending", "cancelled", "refunded", "disputed", "processing"]


# ---------------------------------------------------------------------------
# Hypothesis strategies
# ---------------------------------------------------------------------------

# Printable text that can act as a realistic field value (name, email, etc.)
_safe_text = st.text(
    alphabet=st.characters(
        whitelist_categories=("Lu", "Ll", "Nd"),
        whitelist_characters=" @._-+",
    ),
    min_size=1,
    max_size=80,
)

# Realistic total_amount values
_amount = st.floats(min_value=0.0, max_value=100_000.0, allow_nan=False, allow_infinity=False)

# Valid status strings
_status = st.sampled_from(VALID_STATUSES)

# Payment methods
_payment_method = st.sampled_from(["upi", "card", "netbanking", "wallet", "crypto"])

# Datetime range: anything from 2020 to 2030 (avoids isoformat edge cases)
_created_at = st.datetimes(
    min_value=datetime(2020, 1, 1),
    max_value=datetime(2030, 12, 31),
    timezones=st.just(utc),
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_direct_purchase_order(**overrides):
    """
    Build a minimal MagicMock Order with affiliate_id=None (direct purchase).
    All other attributes are set to realistic defaults that can be overridden
    by Hypothesis via the **overrides dict.
    """
    o = MagicMock()
    o.id            = overrides.get("id", 1)
    o.user_id       = overrides.get("user_id", 10)
    o.status        = overrides.get("status", "completed")
    o.total_amount  = overrides.get("total_amount", 49.99)
    o.payment_method = overrides.get("payment_method", "upi")
    o.created_at    = overrides.get("created_at", datetime(2024, 6, 1, tzinfo=utc))

    # ALWAYS None for direct-purchase orders
    o.affiliate_id       = None
    o.referral_code_used = None
    o.referral_link_id   = None

    # Empty items list — the loop in get_orders_list() iterates over this
    o.items = []

    return o


def make_mock_session(orders, customer_name="Direct Customer", customer_email="direct@test.com"):
    """
    Build a MagicMock SessionLocal() that returns the given orders list
    when the paginated query chain is resolved.
    """
    mock_db_s = MagicMock()

    mock_customer        = MagicMock()
    mock_customer.name   = customer_name
    mock_customer.email  = customer_email

    mock_user_query = MagicMock()
    mock_user_query.filter.return_value.first.return_value = mock_customer

    mock_order_query = MagicMock()
    mock_order_query.order_by.return_value  = mock_order_query
    mock_order_query.filter.return_value    = mock_order_query
    mock_order_query.count.return_value     = len(orders)
    mock_order_query.offset.return_value.limit.return_value.all.return_value = orders

    def query_router(model):
        from app.models.order import Order as OrderModel
        from app.models.user  import User  as UserModel
        if model is OrderModel:
            return mock_order_query
        if model is UserModel:
            return mock_user_query
        return MagicMock()

    mock_db_s.query.side_effect = query_router
    return mock_db_s


def call_get_orders_list(order):
    """Patch SessionLocal and invoke get_orders_list(), returning the first item."""
    mock_db_s = make_mock_session([order])
    with patch("app.admin_api.orders.services.SessionLocal", return_value=mock_db_s):
        from app.admin_api.orders.services import get_orders_list
        result = get_orders_list(page=1, page_size=50)
    assert result["items"], "Expected at least one item in response"
    return result["items"][0]


# ---------------------------------------------------------------------------
# OBSERVATION (documented baseline)
# ---------------------------------------------------------------------------
# For a direct-purchase order (affiliate_id=None), get_orders_list() on
# UNFIXED code returns exactly these 12 keys (in no guaranteed order):
#   id, orderId, customerId, customerName, customerEmail, items,
#   totalUSD, price, status, paymentStatus, paymentMethod, createdAt
#
# The three affiliate keys (affiliateId, referralCodeUsed, referralLinkId)
# are ABSENT on unfixed code and PRESENT (with None values) after the fix.
# ---------------------------------------------------------------------------


# ===========================================================================
# GROUP (a) — Existing-fields preservation
# EXPECTED TO PASS on UNFIXED code (these are the baseline invariants)
# ===========================================================================

class TestExistingFieldsPreservation:
    """
    Baseline preservation: all 12 pre-existing order fields survive unchanged
    for any direct-purchase order, before and after the fix.

    All tests in this class PASS on unfixed code.
    """

    def test_all_12_existing_fields_present_for_direct_purchase(self):
        """
        Unit test: a concrete direct-purchase order yields all 12 fields.
        Validates: Requirements 3.2, 3.3
        """
        order = make_direct_purchase_order(
            id=42,
            status="completed",
            total_amount=99.0,
            payment_method="card",
            created_at=datetime(2024, 3, 15, 12, 0, 0, tzinfo=utc),
        )
        item = call_get_orders_list(order)

        for field in EXISTING_FIELDS:
            assert field in item, (
                f"PRESERVATION FAILURE: field '{field}' is missing from the response. "
                f"Keys present: {list(item.keys())}"
            )

    def test_id_and_order_id_values_correct(self):
        """
        id should be str(o.id); orderId should be 'ORD-{o.id}'.
        """
        order = make_direct_purchase_order(id=7)
        item  = call_get_orders_list(order)

        assert item["id"] == "7", f"Expected id='7', got {item['id']!r}"
        assert item["orderId"] == "ORD-7", f"Expected orderId='ORD-7', got {item['orderId']!r}"

    def test_total_usd_and_price_are_equal_floats(self):
        """
        totalUSD and price are both derived from o.total_amount and must be equal.
        """
        order = make_direct_purchase_order(total_amount=123.45)
        item  = call_get_orders_list(order)

        assert item["totalUSD"] == item["price"], (
            f"totalUSD ({item['totalUSD']}) != price ({item['price']})"
        )
        assert isinstance(item["totalUSD"], float), "totalUSD must be a float"
        assert isinstance(item["price"],    float), "price must be a float"

    def test_status_preserved(self):
        """status value is passed through from o.status."""
        for status in VALID_STATUSES:
            order = make_direct_purchase_order(status=status)
            item  = call_get_orders_list(order)
            assert item["status"] == status, (
                f"Expected status={status!r}, got {item['status']!r}"
            )

    def test_payment_method_preserved(self):
        """paymentMethod is passed through from o.payment_method."""
        for method in ["upi", "card", "netbanking"]:
            order = make_direct_purchase_order(payment_method=method)
            item  = call_get_orders_list(order)
            assert item["paymentMethod"] == method, (
                f"Expected paymentMethod={method!r}, got {item['paymentMethod']!r}"
            )

    def test_created_at_is_iso_string_ending_in_z(self):
        """createdAt is an ISO 8601 string ending in 'Z'."""
        order = make_direct_purchase_order(
            created_at=datetime(2024, 6, 1, 10, 30, 0, tzinfo=utc)
        )
        item = call_get_orders_list(order)

        created_at = item["createdAt"]
        assert isinstance(created_at, str), f"createdAt must be str, got {type(created_at)}"
        assert created_at.endswith("Z"),    f"createdAt must end in 'Z', got {created_at!r}"

    def test_items_is_list(self):
        """items field must be a list (even if empty)."""
        order = make_direct_purchase_order()
        item  = call_get_orders_list(order)
        assert isinstance(item["items"], list), (
            f"Expected items to be a list, got {type(item['items'])}"
        )

    def test_response_envelope_fields_present(self):
        """The response envelope contains total, page, page_size, items."""
        order    = make_direct_purchase_order()
        mock_db  = make_mock_session([order])
        with patch("app.admin_api.orders.services.SessionLocal", return_value=mock_db):
            from app.admin_api.orders.services import get_orders_list
            result = get_orders_list(page=1, page_size=50)

        for key in ("total", "page", "page_size", "items"):
            assert key in result, f"Envelope key '{key}' missing from response"

        assert result["total"]     == 1
        assert result["page"]      == 1
        assert result["page_size"] == 50

    # -----------------------------------------------------------------------
    # PBT — Property 2a: existing fields preserved across arbitrary orders
    # -----------------------------------------------------------------------

    @given(
        order_id      = st.integers(min_value=1, max_value=9_999_999),
        user_id       = st.integers(min_value=1, max_value=9_999_999),
        total_amount  = _amount,
        status        = _status,
        payment_method= _payment_method,
        created_at    = _created_at,
    )
    @settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.too_slow],
    )
    def test_pbt_all_12_fields_present_for_any_direct_purchase_order(
        self,
        order_id,
        user_id,
        total_amount,
        status,
        payment_method,
        created_at,
    ):
        """
        **Validates: Requirements 3.1, 3.2, 3.3**

        Property 2a (PBT): For any randomly-generated direct-purchase order
        (affiliate_id=None), all 12 pre-existing response fields are present
        in the serialized dict returned by get_orders_list().

        This test PASSES on both unfixed and fixed code — it is the baseline.
        """
        order = make_direct_purchase_order(
            id             = order_id,
            user_id        = user_id,
            total_amount   = total_amount,
            status         = status,
            payment_method = payment_method,
            created_at     = created_at,
        )
        item = call_get_orders_list(order)

        missing = [f for f in EXISTING_FIELDS if f not in item]
        assert not missing, (
            f"PRESERVATION FAILURE: the following pre-existing fields are absent "
            f"from the response for a direct-purchase order: {missing}. "
            f"Keys present: {list(item.keys())}. "
            f"Order: id={order_id}, status={status!r}, total={total_amount}"
        )

    @given(
        order_id     = st.integers(min_value=1, max_value=9_999_999),
        total_amount = _amount,
        status       = _status,
    )
    @settings(
        max_examples=80,
        suppress_health_check=[HealthCheck.too_slow],
    )
    def test_pbt_total_usd_and_price_always_equal(self, order_id, total_amount, status):
        """
        **Validates: Requirements 3.2**

        Property 2a (PBT): totalUSD and price are always equal floats derived
        from o.total_amount, regardless of order shape.
        """
        order = make_direct_purchase_order(id=order_id, total_amount=total_amount, status=status)
        item  = call_get_orders_list(order)

        assert item["totalUSD"] == item["price"], (
            f"totalUSD ({item['totalUSD']}) != price ({item['price']}) "
            f"for order id={order_id}, total_amount={total_amount}"
        )
        assert isinstance(item["totalUSD"], float)

    @given(
        order_id   = st.integers(min_value=1, max_value=9_999_999),
        created_at = _created_at,
    )
    @settings(max_examples=60, suppress_health_check=[HealthCheck.too_slow])
    def test_pbt_created_at_always_valid_iso_z_string(self, order_id, created_at):
        """
        **Validates: Requirements 3.2**

        Property 2a (PBT): createdAt is always a non-empty string ending in 'Z'
        for any datetime value.
        """
        order = make_direct_purchase_order(id=order_id, created_at=created_at)
        item  = call_get_orders_list(order)

        ca = item["createdAt"]
        assert isinstance(ca, str) and ca, "createdAt must be a non-empty string"
        assert ca.endswith("Z"),             f"createdAt must end in 'Z', got {ca!r}"

    @given(
        order_id = st.integers(min_value=1, max_value=9_999_999),
    )
    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    def test_pbt_id_and_order_id_format_always_correct(self, order_id):
        """
        **Validates: Requirements 3.2**

        Property 2a (PBT): id = str(order_id), orderId = 'ORD-{order_id}'.
        """
        order = make_direct_purchase_order(id=order_id)
        item  = call_get_orders_list(order)

        assert item["id"]      == str(order_id),         f"Expected id={str(order_id)!r}"
        assert item["orderId"] == f"ORD-{order_id}",     f"Expected orderId='ORD-{order_id}'"

    @given(status=_status)
    @settings(max_examples=20, suppress_health_check=[HealthCheck.too_slow])
    def test_pbt_payment_status_derived_from_status(self, status):
        """
        **Validates: Requirements 3.2**

        Property 2a (PBT): paymentStatus is 'Paid' when status is 'completed',
        otherwise 'Pending'.
        """
        order    = make_direct_purchase_order(status=status)
        item     = call_get_orders_list(order)
        expected = "Paid" if status.lower() == "completed" else "Pending"

        assert item["paymentStatus"] == expected, (
            f"paymentStatus mismatch for status={status!r}: "
            f"expected {expected!r}, got {item['paymentStatus']!r}"
        )


# ===========================================================================
# GROUP (b) — Null affiliate fields (PASS after fix, may be skipped on unfixed code)
# ===========================================================================

class TestNullAffiliateFields:
    """
    After the fix, direct-purchase orders must have all three affiliate keys
    present with None values.

    These tests FAIL on unfixed code (the keys are absent) and PASS after
    the fix is applied (task 3.1).

    When running Task 2 on unfixed code, only run TestExistingFieldsPreservation.
    When running Task 3.5, run the full suite including this class.
    """

    def test_affiliate_id_key_present_and_null_for_direct_purchase(self):
        """
        After the fix, 'affiliateId' is in the response and equals None.
        Validates: Requirements 3.1
        """
        order = make_direct_purchase_order()
        item  = call_get_orders_list(order)

        assert "affiliateId" in item, (
            f"'affiliateId' key missing from response for direct-purchase order. "
            f"Keys present: {list(item.keys())}. "
            "The fix should add affiliateId=None for direct-purchase orders."
        )
        assert item["affiliateId"] is None, (
            f"Expected affiliateId=None for direct-purchase order, got {item['affiliateId']!r}"
        )

    def test_referral_code_used_key_present_and_null_for_direct_purchase(self):
        """
        After the fix, 'referralCodeUsed' is in the response and equals None.
        Validates: Requirements 3.1
        """
        order = make_direct_purchase_order()
        item  = call_get_orders_list(order)

        assert "referralCodeUsed" in item, (
            f"'referralCodeUsed' key missing for direct-purchase order. "
            f"Keys present: {list(item.keys())}."
        )
        assert item["referralCodeUsed"] is None, (
            f"Expected referralCodeUsed=None, got {item['referralCodeUsed']!r}"
        )

    def test_referral_link_id_key_present_and_null_for_direct_purchase(self):
        """
        After the fix, 'referralLinkId' is in the response and equals None.
        Validates: Requirements 3.1
        """
        order = make_direct_purchase_order()
        item  = call_get_orders_list(order)

        assert "referralLinkId" in item, (
            f"'referralLinkId' key missing for direct-purchase order. "
            f"Keys present: {list(item.keys())}."
        )
        assert item["referralLinkId"] is None, (
            f"Expected referralLinkId=None, got {item['referralLinkId']!r}"
        )

    def test_all_three_affiliate_keys_present_and_null(self):
        """
        Convenience: assert all three affiliate keys together.
        Validates: Requirements 3.1
        """
        order = make_direct_purchase_order()
        item  = call_get_orders_list(order)

        for key in ("affiliateId", "referralCodeUsed", "referralLinkId"):
            assert key in item, (
                f"Affiliate key '{key}' missing. Keys present: {list(item.keys())}"
            )
            assert item[key] is None, (
                f"Expected {key}=None for direct-purchase order, got {item[key]!r}"
            )

    @given(
        order_id       = st.integers(min_value=1, max_value=9_999_999),
        total_amount   = _amount,
        status         = _status,
        payment_method = _payment_method,
        created_at     = _created_at,
    )
    @settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.too_slow],
    )
    def test_pbt_affiliate_keys_always_null_for_direct_purchase(
        self,
        order_id,
        total_amount,
        status,
        payment_method,
        created_at,
    ):
        """
        **Validates: Requirements 3.1**

        Property 2b (PBT): For any randomly-generated direct-purchase order
        (affiliate_id=None), the three affiliate keys are always present in
        the response and always equal to None.

        PASSES after fix (task 3.1). Run as part of task 3.5 verification.
        """
        order = make_direct_purchase_order(
            id             = order_id,
            total_amount   = total_amount,
            status         = status,
            payment_method = payment_method,
            created_at     = created_at,
        )
        item = call_get_orders_list(order)

        for key in ("affiliateId", "referralCodeUsed", "referralLinkId"):
            assert key in item, (
                f"Affiliate key '{key}' missing from response for direct-purchase order. "
                f"Keys present: {list(item.keys())}."
            )
            assert item[key] is None, (
                f"Expected {key}=None for direct-purchase order, "
                f"got {item[key]!r} (order_id={order_id}, status={status!r})"
            )
