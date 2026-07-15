"""
test_firestore_delete_unit.py
------------------------------
Unit tests for the fixed `delete_product_from_firestore` function.

These tests verify the referential-integrity-checked delete implementation
introduced in Task 4.1 of the firestore-product-sync-cleanup spec.

All tests must PASS on the fixed code.

**Validates: Requirements 1.7**
"""

import pytest
from unittest.mock import MagicMock, patch


# ── Helpers ──────────────────────────────────────────────────────────────────

def make_order_doc(doc_id: str, product_id: str) -> MagicMock:
    """Build a mock Firestore order document referencing a given product_id."""
    doc = MagicMock()
    doc.id = doc_id
    doc.to_dict.return_value = {
        "orderId": doc_id,
        "userId": "user_123",
        "items": [
            {"productId": product_id, "productName": "Some Product", "price": 19.99}
        ],
        "totalAmount": 19.99,
        "status": "completed",
    }
    return doc


def make_review_doc(doc_id: str) -> MagicMock:
    """Build a mock Firestore review document."""
    doc = MagicMock()
    doc.id = doc_id
    doc.to_dict.return_value = {"productId": "7", "userId": "user_abc", "rating": 5}
    return doc


def make_download_doc(doc_id: str) -> MagicMock:
    """Build a mock Firestore download document."""
    doc = MagicMock()
    doc.id = doc_id
    doc.to_dict.return_value = {"productId": "7", "userId": "user_xyz"}
    return doc


def build_mock_db(
    order_docs=None,
    review_docs=None,
    download_docs=None,
):
    """
    Build a mock Firestore db using the collection_router side_effect pattern
    (matching the pattern established in test_firestore_sync_bug_condition.py).
    """
    mock_db = MagicMock()
    mock_product_doc_ref = MagicMock()

    def collection_router(name):
        coll_mock = MagicMock()
        if name == "orders":
            coll_mock.stream.return_value = order_docs or []
        elif name == "reviews":
            coll_mock.where.return_value.stream.return_value = review_docs or []
        elif name == "downloads":
            coll_mock.where.return_value.stream.return_value = download_docs or []
        elif name == "products":
            coll_mock.document.return_value = mock_product_doc_ref
        else:
            coll_mock.stream.return_value = []
            coll_mock.where.return_value.stream.return_value = []
        return coll_mock

    mock_db.collection.side_effect = collection_router
    return mock_db, mock_product_doc_ref


def call_delete(product_id: int, mock_db, firebase_connected: bool = True) -> dict:
    """
    Patch admin_firestore globals and call delete_product_from_firestore,
    returning its result dict.
    """
    with patch("admin.firestore.admin_firestore.db", mock_db), \
         patch("admin.firestore.admin_firestore.firebase_connected", firebase_connected):
        # Import inside the patch context to pick up the patched globals
        from admin.firestore.admin_firestore import delete_product_from_firestore
        return delete_product_from_firestore(product_id)


# ── Tests ────────────────────────────────────────────────────────────────────

class TestDeleteFirestoreUnavailable:
    """When Firebase is not connected, return early without touching Firestore."""

    def test_delete_returns_firestore_unavailable(self):
        """
        When firebase_connected is False, delete must return the
        firestore_unavailable sentinel and must NOT call Firestore delete().

        Validates: Requirements 1.7
        """
        mock_db, mock_product_doc_ref = build_mock_db()

        result = call_delete(product_id=7, mock_db=mock_db, firebase_connected=False)

        assert result == {
            "blocked": True,
            "reason": "firestore_unavailable",
            "references": [],
        }, f"Expected firestore_unavailable sentinel, got: {result}"

        mock_product_doc_ref.delete.assert_not_called()


class TestDeleteBlockedByReferences:
    """Delete must be blocked (and delete() not called) when references exist."""

    def test_delete_blocked_when_order_reference_exists(self):
        """
        When the orders collection contains a doc whose items array references
        productId == '7', the delete must be blocked.

        Validates: Requirements 1.7
        """
        order_doc = make_order_doc("ORD-001", product_id="7")
        mock_db, mock_product_doc_ref = build_mock_db(order_docs=[order_doc])

        result = call_delete(product_id=7, mock_db=mock_db)

        assert result["blocked"] is True, \
            f"Expected blocked=True when order reference exists, got: {result}"
        assert len(result["references"]) > 0, \
            f"Expected non-empty references list, got: {result['references']}"
        mock_product_doc_ref.delete.assert_not_called()

    def test_delete_blocked_when_review_reference_exists(self):
        """
        When the reviews collection has a document matching the product,
        delete must be blocked.

        Validates: Requirements 1.7
        """
        review_doc = make_review_doc("REV-001")
        mock_db, mock_product_doc_ref = build_mock_db(review_docs=[review_doc])

        result = call_delete(product_id=7, mock_db=mock_db)

        assert result["blocked"] is True, \
            f"Expected blocked=True when review reference exists, got: {result}"
        assert len(result["references"]) > 0, \
            f"Expected non-empty references list for reviews, got: {result['references']}"
        mock_product_doc_ref.delete.assert_not_called()

    def test_delete_blocked_when_download_reference_exists(self):
        """
        When the downloads collection has a matching document, delete must
        be blocked.

        Validates: Requirements 1.7
        """
        download_doc = make_download_doc("DL-001")
        mock_db, mock_product_doc_ref = build_mock_db(download_docs=[download_doc])

        result = call_delete(product_id=7, mock_db=mock_db)

        assert result["blocked"] is True, \
            f"Expected blocked=True when download reference exists, got: {result}"
        assert len(result["references"]) > 0, \
            f"Expected non-empty references list for downloads, got: {result['references']}"
        mock_product_doc_ref.delete.assert_not_called()


class TestDeleteSucceeds:
    """When no references exist, delete must proceed and delete() must be called."""

    def test_delete_succeeds_when_no_references(self):
        """
        When orders, reviews, and downloads all return empty, the product
        document must be deleted and the return value must be
        {"blocked": False, "references": []}.

        Validates: Requirements 1.7
        """
        mock_db, mock_product_doc_ref = build_mock_db(
            order_docs=[],
            review_docs=[],
            download_docs=[],
        )

        result = call_delete(product_id=7, mock_db=mock_db)

        assert result == {"blocked": False, "references": []}, \
            f"Expected unblocked result, got: {result}"
        mock_product_doc_ref.delete.assert_called_once()


class TestDeleteMultipleReferences:
    """References from multiple collections are all included in the response."""

    def test_delete_returns_multiple_reference_entries(self):
        """
        When both orders and reviews have matching documents, the references
        list must contain entries for both collections.

        Validates: Requirements 1.7
        """
        order_doc = make_order_doc("ORD-001", product_id="7")
        review_doc = make_review_doc("REV-001")
        mock_db, mock_product_doc_ref = build_mock_db(
            order_docs=[order_doc],
            review_docs=[review_doc],
        )

        result = call_delete(product_id=7, mock_db=mock_db)

        assert result["blocked"] is True, \
            f"Expected blocked=True when multiple references exist, got: {result}"

        collections_in_refs = {ref["collection"] for ref in result["references"]}
        assert "orders" in collections_in_refs, \
            f"Expected 'orders' in reference collections, got: {collections_in_refs}"
        assert "reviews" in collections_in_refs, \
            f"Expected 'reviews' in reference collections, got: {collections_in_refs}"
        assert len(result["references"]) >= 2, \
            f"Expected at least 2 reference entries, got: {result['references']}"

        mock_product_doc_ref.delete.assert_not_called()
