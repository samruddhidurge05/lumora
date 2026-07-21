"""
test_cleanup_script_unit.py
----------------------------
Unit tests for the cleanup script:
  backend/scripts/cleanup_firestore_mock_products.py

Covers signal detection, recency protection, referential integrity,
dry-run mode, SQLite-free operation, and report generation.

Requirements: 2.1, 2.2, 2.3, 2.4, 3.6
"""

import sys
import os
import inspect
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch, call
import pytest

# -- Path setup: make scripts and backend importable --------------------------
_TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_TESTS_DIR)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

_SCRIPTS_DIR = os.path.join(_BACKEND_DIR, "scripts")
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

# Pre-mock Firestore so the module can be imported without real Firebase credentials
import scripts.cleanup_firestore_mock_products  # noqa: E402 (ensure module loaded)
from scripts.cleanup_firestore_mock_products import (
    evaluate_signals,
    KNOWN_SEED_VENDOR_IDS,
    run_cleanup,
)

utc = timezone.utc


# -- Helpers ------------------------------------------------------------------

def make_doc(data: dict) -> MagicMock:
    """Create a mock Firestore DocumentSnapshot from a plain dict."""
    doc = MagicMock()
    doc.to_dict.return_value = data
    doc.id = data.get("id", "doc_001")
    return doc


def _days_ago_iso(days: int) -> str:
    """Return an ISO-8601 UTC string for `days` before today."""
    dt = datetime.now(utc) - timedelta(days=days)
    return dt.isoformat().replace("+00:00", "") + "Z"


def _build_mock_db(
    product_docs=None,
    order_docs=None,
    review_docs=None,
    download_docs=None,
    analytics_docs=None,
):
    """
    Build a mock Firestore db whose collection() method routes to appropriate
    mock collections so run_cleanup can iterate/query without real Firestore.
    """
    mock_db = MagicMock()
    mock_product_doc_ref = MagicMock()

    def collection_router(name):
        coll = MagicMock()
        if name == "products":
            coll.stream.return_value = product_docs or []
            coll.document.return_value = mock_product_doc_ref
        elif name == "orders":
            coll.stream.return_value = order_docs or []
        elif name == "reviews":
            coll.where.return_value.stream.return_value = review_docs or []
        elif name == "downloads":
            coll.where.return_value.stream.return_value = download_docs or []
        elif name == "analytics":
            coll.where.return_value.stream.return_value = analytics_docs or []
        else:
            # wishlist, favorites, bookmarks, recommendations, etc.
            coll.stream.return_value = []
            coll.where.return_value.stream.return_value = []
        return coll

    mock_db.collection.side_effect = collection_router
    return mock_db, mock_product_doc_ref


def _make_seed_product_doc(doc_id: str, days_old: int = 60, extra: dict = None) -> MagicMock:
    """
    Build a mock product doc that will trigger at least 2 seed signals
    (Unsplash thumbnail + generic title) and is old enough to be eligible.
    """
    data = {
        "id": doc_id,
        "title": "Product 99",
        "thumbnail": "https://images.unsplash.com/photo-fake",
        "vendor_id": "some_vendor",
        "description": "A real description",
        "createdAt": _days_ago_iso(days_old),
    }
    if extra:
        data.update(extra)
    return make_doc(data)


# ???????????????????????????????????????????????????????????????????????????????
# 1. Signal detection tests (evaluate_signals)
# ???????????????????????????????????????????????????????????????????????????????

class TestSignalDetection:
    """Tests for evaluate_signals() - per-document seed signal identification."""

    def test_cleanup_signal_detection_two_signals(self):
        """
        A doc with an Unsplash thumbnail AND a generic title ("Product 12")
        must trigger at least 2 signals.

        Validates: Requirements 2.1
        """
        doc = make_doc({
            "title": "Product 12",
            "thumbnail": "https://images.unsplash.com/photo-abc123",
            "description": "A legitimate description",
            "vendor_id": "real_vendor",
        })
        signals = evaluate_signals(doc)

        assert len(signals) >= 2, (
            f"Expected 2+ signals for Unsplash thumbnail + generic title, "
            f"got {len(signals)}: {signals}"
        )
        assert "unsplash_thumbnail" in signals, \
            f"'unsplash_thumbnail' signal missing; got {signals}"
        assert "generic_title" in signals, \
            f"'generic_title' signal missing; got {signals}"

    def test_cleanup_signal_detection_one_signal(self):
        """
        A doc with only an Unsplash thumbnail (no other signals) must trigger
        fewer than 2 signals and therefore NOT be flagged as a candidate.

        Validates: Requirements 2.1
        """
        doc = make_doc({
            "title": "My Awesome Design Bundle",
            "thumbnail": "https://images.unsplash.com/photo-xyz",
            "description": "Professional design resources for creative teams.",
            "vendor_id": "real_vendor",
        })
        signals = evaluate_signals(doc)

        assert len(signals) < 2, (
            f"Expected < 2 signals for doc with only Unsplash thumbnail, "
            f"got {len(signals)}: {signals}"
        )
        assert "unsplash_thumbnail" in signals, \
            "Unsplash signal should still fire even if under the threshold"

    def test_cleanup_signal_detection_lorem_description(self):
        """
        A doc with a description containing "lorem ipsum filler" must trigger
        the 'lorem_description' signal.

        Validates: Requirements 2.1
        """
        doc = make_doc({
            "title": "My Product",
            "thumbnail": "https://real-cdn.com/img.jpg",
            "description": "lorem ipsum filler content here",
            "vendor_id": "real_vendor",
        })
        signals = evaluate_signals(doc)

        assert "lorem_description" in signals, (
            f"'lorem_description' signal should fire for description containing "
            f"'lorem ipsum filler'; got signals: {signals}"
        )

    def test_cleanup_signal_detection_seed_vendor(self):
        """
        A doc with a vendor_id that is in KNOWN_SEED_VENDOR_IDS must trigger
        the 'seed_vendor' signal.

        Validates: Requirements 2.1
        """
        # Pick a vendor ID that is definitely in the static set
        seed_vid = "seed_vendor_1"
        assert seed_vid in KNOWN_SEED_VENDOR_IDS, \
            f"Test setup: '{seed_vid}' must be in KNOWN_SEED_VENDOR_IDS"

        doc = make_doc({
            "title": "My Legitimate Product",
            "thumbnail": "https://real-cdn.com/img.jpg",
            "description": "A real product description.",
            "vendor_id": seed_vid,
        })
        signals = evaluate_signals(doc)

        assert "seed_vendor" in signals, (
            f"'seed_vendor' signal should fire for vendor_id='{seed_vid}'; "
            f"got signals: {signals}"
        )


# ???????????????????????????????????????????????????????????????????????????????
# 2. Recency protection tests (run_cleanup internal logic)
# ???????????????????????????????????????????????????????????????????????????????

class TestRecencyProtection:
    """
    Docs created within the last 30 calendar days must never be deleted,
    regardless of how many seed signals they fire.

    Boundary rule: days < 30 ? protected; days >= 30 ? eligible.
    """

    def _run_cleanup_and_capture_delete(self, doc: MagicMock, dry_run: bool = False):
        """
        Helper: run run_cleanup against a single-doc product collection and
        return the mock product document reference so callers can assert on
        its `.delete()` call count.
        """
        mock_db, mock_doc_ref = _build_mock_db(product_docs=[doc])

        with patch("scripts.cleanup_firestore_mock_products.db", mock_db), \
             patch("scripts.cleanup_firestore_mock_products.firebase_connected", True):
            run_cleanup(dry_run=dry_run)

        return mock_doc_ref

    def test_cleanup_recency_protection_5_days_old(self):
        """
        A candidate created 5 days ago (with 3 signals) must NOT be deleted -
        it is within the 30-day recency protection window.

        Validates: Requirements 2.2
        """
        doc = _make_seed_product_doc("doc_5d", days_old=5, extra={
            "vendor_id": "seed_vendor_1",   # adds 'seed_vendor' ? 3 signals total
        })
        mock_doc_ref = self._run_cleanup_and_capture_delete(doc, dry_run=False)

        mock_doc_ref.delete.assert_not_called(), \
            "A 5-day-old doc should be recency-protected, never deleted"

    def test_cleanup_recency_protection_29_days_old(self):
        """
        A candidate created exactly 29 days ago must NOT be deleted
        (boundary: days < 30 ? protected).

        Validates: Requirements 2.2
        """
        doc = _make_seed_product_doc("doc_29d", days_old=29)
        mock_doc_ref = self._run_cleanup_and_capture_delete(doc, dry_run=False)

        mock_doc_ref.delete.assert_not_called(), \
            "A 29-day-old doc should still be recency-protected (< 30 days)"

    def test_cleanup_recency_protection_30_days_old(self):
        """
        A candidate created exactly 30 days ago IS eligible for deletion
        (boundary: days >= 30 ? eligible).

        Validates: Requirements 2.2
        """
        doc = _make_seed_product_doc("doc_30d", days_old=30)
        mock_db, mock_doc_ref = _build_mock_db(product_docs=[doc])

        # We need all reference collections empty so the doc reaches deletion queue
        with patch("scripts.cleanup_firestore_mock_products.db", mock_db), \
             patch("scripts.cleanup_firestore_mock_products.firebase_connected", True):
            run_cleanup(dry_run=False)

        mock_doc_ref.delete.assert_called_once(), \
            "A 30-day-old doc should be eligible for deletion (age >= 30)"


# ???????????????????????????????????????????????????????????????????????????????
# 3. Referential integrity blocking tests
# ???????????????????????????????????????????????????????????????????????????????

class TestReferentialIntegrityBlocking:
    """
    Candidates that pass the recency guard must still be blocked if any
    referencing document exists in orders, reviews, analytics, etc.
    """

    def _run_and_get_ref(self, product_doc, order_docs=None, review_docs=None,
                         analytics_docs=None):
        """Run cleanup with given reference collections; return mock_doc_ref."""
        mock_db, mock_doc_ref = _build_mock_db(
            product_docs=[product_doc],
            order_docs=order_docs or [],
            review_docs=review_docs or [],
            analytics_docs=analytics_docs or [],
        )
        with patch("scripts.cleanup_firestore_mock_products.db", mock_db), \
             patch("scripts.cleanup_firestore_mock_products.firebase_connected", True):
            run_cleanup(dry_run=False)
        return mock_doc_ref

    def test_cleanup_blocked_by_order_reference(self):
        """
        A candidate that is referenced in the orders collection must be added
        to blocked_referenced and must NOT be deleted.

        Validates: Requirements 2.3
        """
        product_doc = _make_seed_product_doc("prod_order_blocked", days_old=60)

        # Build a matching order doc referencing this product
        order_doc = MagicMock()
        order_doc.id = "ORD-001"
        order_doc.to_dict.return_value = {
            "items": [{"productId": "prod_order_blocked"}],
        }

        mock_doc_ref = self._run_and_get_ref(
            product_doc, order_docs=[order_doc]
        )
        mock_doc_ref.delete.assert_not_called(), \
            "Product referenced in orders must be blocked from deletion"

    def test_cleanup_blocked_by_review_reference(self):
        """
        A candidate referenced in the reviews collection must be blocked.

        Validates: Requirements 2.3
        """
        product_doc = _make_seed_product_doc("prod_review_blocked", days_old=60)

        review_doc = MagicMock()
        review_doc.id = "REV-001"
        review_doc.to_dict.return_value = {"productId": "prod_review_blocked"}

        mock_doc_ref = self._run_and_get_ref(
            product_doc, review_docs=[review_doc]
        )
        mock_doc_ref.delete.assert_not_called(), \
            "Product referenced in reviews must be blocked from deletion"

    def test_cleanup_blocked_by_analytics_reference(self):
        """
        A candidate referenced in the analytics collection must be blocked.

        Validates: Requirements 2.3
        """
        product_doc = _make_seed_product_doc("prod_analytics_blocked", days_old=60)

        analytics_doc = MagicMock()
        analytics_doc.id = "ANLT-001"
        analytics_doc.to_dict.return_value = {"productId": "prod_analytics_blocked"}

        mock_doc_ref = self._run_and_get_ref(
            product_doc, analytics_docs=[analytics_doc]
        )
        mock_doc_ref.delete.assert_not_called(), \
            "Product referenced in analytics must be blocked from deletion"


# ???????????????????????????????????????????????????????????????????????????????
# 4. SQLite / ORM isolation test
# ???????????????????????????????????????????????????????????????????????????????

class TestNoSQLiteWrites:
    """
    The cleanup script must have zero SQLAlchemy / SQLite dependency -
    it should not import or use any ORM session at all.

    Validates: Requirements 2.4, 3.6
    """

    def test_cleanup_no_sqlite_writes(self):
        """
        Inspect the cleanup module source to confirm no SQLAlchemy Session
        import or usage exists.

        Validates: Requirements 2.4, 3.6
        """
        import scripts.cleanup_firestore_mock_products as cleanup_mod

        source = inspect.getsource(cleanup_mod)

        # These patterns would indicate SQLite/SQLAlchemy usage
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
                f"Cleanup script must NOT use SQLite/SQLAlchemy. "
                f"Found forbidden pattern: '{pattern}'"
            )


# ???????????????????????????????????????????????????????????????????????????????
# 5. Dry-run mode test
# ???????????????????????????????????????????????????????????????????????????????

class TestDryRun:
    """dry_run=True must never result in any Firestore document deletion."""

    def test_cleanup_dry_run_deletes_nothing(self):
        """
        With dry_run=True, Firestore delete() must never be called, even
        when there are eligible candidates (2+ signals, 30+ days old, no refs).

        Validates: Requirements 2.4
        """
        # 5 seed candidates - all old enough (60 days), all with 2+ signals
        candidates = [
            _make_seed_product_doc(f"dry_run_doc_{i}", days_old=60)
            for i in range(5)
        ]

        mock_db, mock_doc_ref = _build_mock_db(product_docs=candidates)

        with patch("scripts.cleanup_firestore_mock_products.db", mock_db), \
             patch("scripts.cleanup_firestore_mock_products.firebase_connected", True):
            run_cleanup(dry_run=True)

        mock_doc_ref.delete.assert_not_called(), \
            "With dry_run=True, Firestore delete() must never be called"


# ???????????????????????????????????????????????????????????????????????????????
# 6. Report generation test
# ???????????????????????????????????????????????????????????????????????????????

class TestReportContainsAllSections:
    """The final report printed by run_cleanup must include all 4 required sections."""

    def test_cleanup_report_contains_all_sections(self, capsys):
        """
        The structured cleanup report must contain all four sections:
          (a) deleted / would-be-deleted product document IDs
          (b) preserved product IDs
          (c) blocked product IDs
          (d) document counts (before / after)

        Validates: Requirements 2.4
        """
        # One eligible (old, 2+ signals, no refs) and one recent (protected)
        eligible_doc = _make_seed_product_doc("eligible_001", days_old=60)
        recent_doc = make_doc({
            "id": "recent_001",
            "title": "Product 55",
            "thumbnail": "https://images.unsplash.com/photo-recent",
            "vendor_id": "real_vendor",
            "description": "A normal description",
            "createdAt": _days_ago_iso(5),  # recency protected
        })

        mock_db, _ = _build_mock_db(product_docs=[eligible_doc, recent_doc])

        with patch("scripts.cleanup_firestore_mock_products.db", mock_db), \
             patch("scripts.cleanup_firestore_mock_products.firebase_connected", True):
            run_cleanup(dry_run=True)

        output = capsys.readouterr().out

        # (a) deleted / would-be-deleted section
        assert "(a)" in output, \
            "Report must contain section (a) - deleted/would-be-deleted IDs"
        # (b) preserved section
        assert "(b)" in output, \
            "Report must contain section (b) - preserved product IDs"
        # (c) blocked section
        assert "(c)" in output, \
            "Report must contain section (c) - blocked product IDs"
        # (d) document counts section
        assert "(d)" in output, \
            "Report must contain section (d) - document counts (before/after)"
