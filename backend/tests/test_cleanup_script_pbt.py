"""
test_cleanup_script_pbt.py
--------------------------
Property-based tests for the cleanup script:
  backend/scripts/cleanup_firestore_mock_products.py

Covers four cleanup correctness properties using Hypothesis:

  Property 10 — Signal threshold: flagged iff >= 2 signals
  Property 11 — Recency protection: docs < 30 days old are NEVER deleted
  Property 12 — Referential integrity: any reference blocks deletion
  Property 13 — SQLite untouched: zero SQLAlchemy calls for any N candidates

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 3.6**
"""

import sys
import os
import inspect
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from hypothesis import given, settings, strategies as st

# ── Path setup ────────────────────────────────────────────────────────────────
_TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_TESTS_DIR)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

_SCRIPTS_DIR = os.path.join(_BACKEND_DIR, "scripts")
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

# Import the module (no real Firebase credentials required — module-level
# firebase import is only executed at startup; tests patch db/firebase_connected
# via unittest.mock)
from scripts.cleanup_firestore_mock_products import (  # noqa: E402
    evaluate_signals,
    KNOWN_SEED_VENDOR_IDS,
    run_cleanup,
)

utc = timezone.utc


# ── Shared helpers ────────────────────────────────────────────────────────────

def _make_doc(data: dict) -> MagicMock:
    """Return a mock Firestore DocumentSnapshot backed by *data*."""
    doc = MagicMock()
    doc.to_dict.return_value = data
    doc.id = data.get("id", "doc_pbt_001")
    return doc


def _days_ago_iso(days: int) -> str:
    """ISO-8601 UTC timestamp for *days* before now."""
    dt = datetime.now(utc) - timedelta(days=days)
    return dt.isoformat().replace("+00:00", "") + "Z"


def _build_mock_db(
    product_docs=None,
    order_docs=None,
    review_docs=None,
    download_docs=None,
    analytics_docs=None,
    extra_ref_collections: dict | None = None,
):
    """
    Build a mock Firestore *db* that routes ``collection(name)`` to the
    appropriate mock collection.  Returns ``(mock_db, mock_product_doc_ref)``.

    *extra_ref_collections* maps collection-name → list-of-docs and is used
    by Property 12 to inject references into arbitrary collections.
    """
    mock_db = MagicMock()
    mock_product_doc_ref = MagicMock()
    extra_ref_collections = extra_ref_collections or {}

    def collection_router(name):
        coll = MagicMock()
        if name == "products":
            coll.stream.return_value = product_docs or []
            coll.document.return_value = mock_product_doc_ref
        elif name == "orders":
            docs = extra_ref_collections.get("orders", order_docs or [])
            coll.stream.return_value = docs
        elif name in ("reviews", "downloads", "analytics",
                      "wishlist", "favorites", "bookmarks", "recommendations"):
            docs = extra_ref_collections.get(name, [])
            coll.where.return_value.stream.return_value = docs
        else:
            coll.stream.return_value = []
            coll.where.return_value.stream.return_value = []
        return coll

    mock_db.collection.side_effect = collection_router
    return mock_db, mock_product_doc_ref


def _make_seed_doc(doc_id: str, days_old: int = 60, signals_count: int = 2) -> MagicMock:
    """
    Build a product doc that fires exactly *signals_count* signals (0–4).

    Signal assignment order (easiest to add/remove):
      0: (no signals)
      1: unsplash_thumbnail
      2: + generic_title     ("Product 99")
      3: + seed_vendor       (KNOWN_SEED_VENDOR_IDS member)
      4: + lorem_description ("lorem ipsum")
    """
    data: dict = {
        "id": doc_id,
        "title": "My Real Product",
        "thumbnail": "https://real.cdn.com/img.jpg",
        "vendor_id": "real_vendor",
        "description": "A genuine product description.",
        "createdAt": _days_ago_iso(days_old),
    }

    if signals_count >= 1:
        data["thumbnail"] = "https://images.unsplash.com/photo-fake"
    if signals_count >= 2:
        data["title"] = "Product 99"
    if signals_count >= 3:
        seed_vid = next(iter(KNOWN_SEED_VENDOR_IDS))
        data["vendor_id"] = seed_vid
    if signals_count >= 4:
        data["description"] = "lorem ipsum placeholder content"

    return _make_doc(data)


# ══════════════════════════════════════════════════════════════════════════════
# Property 10 — Signal threshold: flagged iff len(signals) >= 2
# **Validates: Requirements 2.1**
# ══════════════════════════════════════════════════════════════════════════════

@given(signal_count=st.integers(min_value=0, max_value=5))
@settings(max_examples=30)
def test_pbt_property10_flagged_iff_two_or_more_signals(signal_count):
    """
    For all signal counts in [0, 5], evaluate_signals() returns a list whose
    length exactly matches the number of triggered signals. A document is
    flagged as a seed/mock candidate if and only if len(signals) >= 2.

    Specifically:
      - signal_count == 0 → 0 signals → NOT flagged
      - signal_count == 1 → 1 signal  → NOT flagged
      - signal_count >= 2 → 2+ signals → flagged

    Note: signal_count > 4 exercises the 4-signal maximum (all per-doc
    signals present) and is treated identically to signal_count == 4
    because the batch_timestamp 5th signal is a cross-document signal
    not exercised by evaluate_signals() alone.

    **Validates: Requirements 2.1**
    """
    # Clamp to the max number of per-doc signals evaluate_signals can return (4)
    effective_count = min(signal_count, 4)

    doc = _make_seed_doc("pbt10_doc", days_old=60, signals_count=effective_count)
    signals = evaluate_signals(doc)

    # The returned list must contain exactly effective_count entries
    assert len(signals) == effective_count, (
        f"signal_count={signal_count} (effective={effective_count}): "
        f"expected {effective_count} signals, got {len(signals)}: {signals}"
    )

    # Flagging criterion: >= 2 signals
    is_flagged = len(signals) >= 2
    expected_flagged = effective_count >= 2

    assert is_flagged == expected_flagged, (
        f"signal_count={signal_count}: "
        f"expected flagged={expected_flagged}, got flagged={is_flagged} "
        f"(signals={signals})"
    )


# ══════════════════════════════════════════════════════════════════════════════
# Property 11 — Recency protection: docs < 30 days old are NEVER deleted
# **Validates: Requirements 2.2**
# ══════════════════════════════════════════════════════════════════════════════

@given(days_ago=st.integers(min_value=0, max_value=89))
@settings(max_examples=30)
def test_pbt_property11_recency_protection_no_deletion_under_30_days(days_ago):
    """
    For any days_ago in [0, 89]:
      - If days_ago < 30  → Firestore delete() is NEVER called (recency-protected).
      - If days_ago >= 30 → the document IS eligible (delete() called when
                            all reference collections are empty and dry_run=False).

    The candidate always carries 2+ signals so it would be flagged if not
    protected by the recency guard.

    **Validates: Requirements 2.2**
    """
    # 2 signals: unsplash_thumbnail + generic_title
    created_iso = _days_ago_iso(days_ago)
    data = {
        "id": "pbt11_doc",
        "title": "Product 99",
        "thumbnail": "https://images.unsplash.com/photo-pbt11",
        "vendor_id": "real_vendor",
        "description": "A normal description.",
        "createdAt": created_iso,
    }
    doc = _make_doc(data)

    # All reference collections are empty → no referential-integrity block
    mock_db, mock_doc_ref = _build_mock_db(product_docs=[doc])

    with patch("scripts.cleanup_firestore_mock_products.db", mock_db), \
         patch("scripts.cleanup_firestore_mock_products.firebase_connected", True):
        run_cleanup(dry_run=False)

    if days_ago < 30:
        # Must be recency-protected; delete() must NEVER be called
        mock_doc_ref.delete.assert_not_called(), (
            f"days_ago={days_ago} < 30: document must be recency-protected; "
            f"delete() was called unexpectedly"
        )
    else:
        # Eligible: delete() should have been called exactly once
        mock_doc_ref.delete.assert_called_once(), (
            f"days_ago={days_ago} >= 30: document should be deleted; "
            f"delete() call count = {mock_doc_ref.delete.call_count}"
        )


# ══════════════════════════════════════════════════════════════════════════════
# Property 12 — Referential integrity: any reference blocks deletion
# **Validates: Requirements 2.3**
# ══════════════════════════════════════════════════════════════════════════════

@given(
    collections_with_refs=st.lists(
        st.sampled_from(["orders", "reviews", "downloads", "analytics", "wishlist"]),
        min_size=1,
        max_size=5,
        unique=True,
    )
)
@settings(max_examples=20)
def test_pbt_property12_any_reference_blocks_deletion(collections_with_refs):
    """
    For any non-empty subset of reference collections, a candidate that passes
    signal and recency checks must be BLOCKED from deletion when any of those
    collections contains a matching reference.

    delete() must NEVER be called regardless of which combination of
    collections holds the reference.

    **Validates: Requirements 2.3**
    """
    product_id = "pbt12_prod"

    # Candidate: 2 signals, 60 days old (passes recency guard)
    data = {
        "id": product_id,
        "title": "Product 99",
        "thumbnail": "https://images.unsplash.com/photo-pbt12",
        "vendor_id": "real_vendor",
        "description": "A normal description.",
        "createdAt": _days_ago_iso(60),
    }
    product_doc = _make_doc(data)

    # Build one matching reference doc per requested collection
    extra_refs: dict[str, list] = {}
    for coll in collections_with_refs:
        ref_doc = MagicMock()
        ref_doc.id = f"ref_{coll}_001"
        if coll == "orders":
            # Orders use an items array
            ref_doc.to_dict.return_value = {
                "items": [{"productId": product_id}]
            }
        else:
            # All other collections use a top-level productId field
            ref_doc.to_dict.return_value = {"productId": product_id}
        extra_refs[coll] = [ref_doc]

    mock_db, mock_doc_ref = _build_mock_db(
        product_docs=[product_doc],
        extra_ref_collections=extra_refs,
    )

    with patch("scripts.cleanup_firestore_mock_products.db", mock_db), \
         patch("scripts.cleanup_firestore_mock_products.firebase_connected", True):
        run_cleanup(dry_run=False)

    mock_doc_ref.delete.assert_not_called(), (
        f"collections_with_refs={collections_with_refs}: "
        f"a referenced product must NEVER be deleted; "
        f"delete() was called {mock_doc_ref.delete.call_count} time(s)"
    )


# ══════════════════════════════════════════════════════════════════════════════
# Property 13 — SQLite untouched for any N candidates
# **Validates: Requirements 2.4, 3.6**
# ══════════════════════════════════════════════════════════════════════════════

@given(n=st.integers(min_value=1, max_value=10))
@settings(max_examples=10)
def test_pbt_property13_sqlite_untouched_for_any_n_candidates(n):
    """
    For any N in [1, 10] seed candidates, running run_cleanup() must result
    in zero SQLAlchemy / SQLite calls.

    Since the cleanup module must not import SQLAlchemy at all, we verify
    this by inspecting the module source for any forbidden ORM patterns.
    This mirrors the approach used in test_cleanup_no_sqlite_writes (unit
    suite) and is valid for all values of N because the absence of the import
    is a static property of the module that cannot change based on N.

    **Validates: Requirements 2.4, 3.6**
    """
    import scripts.cleanup_firestore_mock_products as cleanup_mod

    source = inspect.getsource(cleanup_mod)

    forbidden_patterns = [
        "sqlalchemy",
        "SessionLocal",
        "from app.database",
        "from app.models",
        "db.add(",
        "db.commit(",
        "db.delete(",
        "db.query(",
        "db.session",
        "Session(",
    ]

    for pattern in forbidden_patterns:
        assert pattern not in source, (
            f"n={n}: cleanup script must NOT contain SQLite/SQLAlchemy pattern "
            f"'{pattern}'. Found it in the module source."
        )
