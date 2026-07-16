"""
test_firestore_sync_bug_condition.py
--------------------------------------
Bug condition exploration tests for Task 1 of the firestore-product-sync-cleanup spec.

CRITICAL: These tests are EXPECTED TO FAIL on the UNFIXED code.
Failure of each test CONFIRMS the corresponding defect exists.
DO NOT fix the code or the tests — these are exploratory probes.

Each test corresponds to one of six identified defects in admin_firestore.py:

  Defect 1 — updatedAt skew (wall-clock used instead of product.updated_at)
  Defect 2 — product_id field absent from Firestore payload
  Defect 3 — file_url / fileUrl absent from Firestore payload
  Defect 4 — review_count absent (only "reviews" key written)
  Defect 5 — creatorAvatar hardcoded to Unsplash URL
  Defect 6 — delete proceeds without referential-integrity check

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.7**
"""

import pytest
from unittest.mock import MagicMock, patch, call
from datetime import datetime, timezone

# UTC timezone shorthand
utc = timezone.utc


# ── Minimal product fixture ──────────────────────────────────────────────────

def make_product(**overrides):
    """
    Build a minimal MagicMock product object that satisfies the attribute
    access pattern in sync_product_to_firestore without needing a real
    SQLAlchemy session.
    """
    p = MagicMock()
    # Sensible defaults matching the Product model column types
    p.id = 42
    p.title = "Test Product"
    p.description = "A test product description"
    p.short_desc = "Short description"
    p.category = "Software"
    p.price = 29.99
    p.rating = 4.5
    p.reviews = 10
    p.downloads = 50
    p.thumbnail = "https://real.cdn.com/thumb.jpg"
    p.preview = "https://real.cdn.com/preview.jpg"
    p.file_url = None
    p.seller = "TestSeller"
    p.vendor_id = "vendor_001"
    p.featured = False
    p.status = "published"
    p.tags = ["tag1", "tag2"]
    p.highlights = ["Feature A", "Feature B"]
    p.version = "v1.0.0"
    p.file_size = "48 MB"
    p.created_at = datetime(2024, 1, 1, tzinfo=utc)
    p.updated_at = datetime(2024, 6, 1, tzinfo=utc)
    p.features = []
    p.system_requirements = []
    p.what_you_get = []
    p.installation_guide = ""
    p.subcategory = ""
    p.discount = 0.0
    p.image_urls = []
    p.preview_images = []
    p.preview_video = ""
    p.seo_title = ""
    p.seo_description = ""
    p.visibility = "public"
    p.license = "Personal Use"
    p.affiliate_enabled = False
    p.commission_type = "percentage"
    p.commission_value = 0.0
    p.pcloud_download_link = None

    for key, value in overrides.items():
        setattr(p, key, value)
    return p


# ── Helper: call sync and capture the dict passed to Firestore set() ─────────

def run_sync_and_capture(product):
    """
    Patches the Firestore db and firebase_connected in admin_firestore,
    calls sync_product_to_firestore(product), and returns the dict
    captured from the set() call.
    """
    mock_db = MagicMock()
    mock_doc_ref = MagicMock()
    mock_db.collection.return_value.document.return_value = mock_doc_ref

    captured = {}

    def capture_set(data, **kwargs):
        captured.update(data)

    mock_doc_ref.set.side_effect = capture_set

    with patch("admin.firestore.admin_firestore.db", mock_db), \
         patch("admin.firestore.admin_firestore.firebase_connected", True):
        from admin.firestore.admin_firestore import sync_product_to_firestore
        sync_product_to_firestore(product)

    return captured


# ── Defect 1: updatedAt skew ─────────────────────────────────────────────────

def test_defect1_updated_at_should_match_product_timestamp():
    """
    EXPECTED TO FAIL on unfixed code.

    The unfixed code writes:
        "updatedAt": datetime.now(timezone.utc).isoformat() + "Z"

    This test asserts the CORRECT behavior: updatedAt must equal
    product.updated_at.isoformat() + "Z", i.e. "2024-06-01T00:00:00Z".

    COUNTEREXAMPLE when failing:
        captured["updatedAt"] == <current wall-clock time>  (NOT "2024-06-01T00:00:00Z")

    Validates: Requirements 1.1 AC 1, 3
    """
    product = make_product(updated_at=datetime(2024, 6, 1, tzinfo=utc))
    captured = run_sync_and_capture(product)

    expected_updated_at = "2024-06-01T00:00:00+00:00Z"
    # The unfixed code uses datetime.now(timezone.utc) — not the product's timestamp.
    # The correct value should match product.updated_at.isoformat() + "Z"
    expected = product.updated_at.isoformat() + "Z"
    assert captured["updatedAt"] == expected, (
        f"DEFECT 1 CONFIRMED: updatedAt was '{captured['updatedAt']}' "
        f"(wall-clock), expected '{expected}' (from product.updated_at). "
        "The unfixed code writes the sync call time, not the SQLite timestamp."
    )


# ── Defect 2: product_id absent ───────────────────────────────────────────────

def test_defect2_product_id_must_be_present_in_firestore_payload():
    """
    EXPECTED TO FAIL on unfixed code.

    The unfixed code never adds "product_id" to the Firestore payload.
    This test asserts the CORRECT behavior: product_id must be in the document.

    COUNTEREXAMPLE when failing:
        "product_id" key is absent from the captured dict.

    Validates: Requirements 1.2 AC 4, 5
    """
    product = make_product(id=42)
    captured = run_sync_and_capture(product)

    assert "product_id" in captured, (
        "DEFECT 2 CONFIRMED: 'product_id' key is ABSENT from the Firestore payload. "
        "The unfixed code never writes the integer primary key field."
    )
    assert captured["product_id"] == 42, (
        f"DEFECT 2 (value): product_id should be 42, got {captured.get('product_id')}"
    )


# ── Defect 3: file_url / fileUrl absent ───────────────────────────────────────

def test_defect3_file_url_must_be_written_when_product_has_file_url():
    """
    EXPECTED TO FAIL on unfixed code.

    The unfixed code only writes pcloud_download_link / pcloudDownloadLink.
    file_url and fileUrl are never added to the payload.

    COUNTEREXAMPLE when failing:
        "file_url" key absent from captured dict.
        "fileUrl"  key absent from captured dict.

    Validates: Requirements 1.3 AC 6, 7
    """
    product = make_product(file_url="https://pcloud.example.com/dl/x")
    captured = run_sync_and_capture(product)

    assert "file_url" in captured, (
        "DEFECT 3 CONFIRMED: 'file_url' key is ABSENT from the Firestore payload. "
        "Consumers using the file_url key will receive undefined/null."
    )
    assert captured["file_url"] == "https://pcloud.example.com/dl/x", (
        f"DEFECT 3 (value): file_url should be 'https://pcloud.example.com/dl/x', "
        f"got {captured.get('file_url')}"
    )
    assert "fileUrl" in captured, (
        "DEFECT 3 CONFIRMED: 'fileUrl' key is ABSENT from the Firestore payload."
    )
    assert captured["fileUrl"] == "https://pcloud.example.com/dl/x", (
        f"DEFECT 3 (value): fileUrl should be 'https://pcloud.example.com/dl/x', "
        f"got {captured.get('fileUrl')}"
    )


# ── Defect 4: review_count absent ─────────────────────────────────────────────

def test_defect4_review_count_must_be_present_in_firestore_payload():
    """
    EXPECTED TO FAIL on unfixed code.

    The unfixed code writes only "reviews" key. The "review_count" alias
    that client components use is never written.

    COUNTEREXAMPLE when failing:
        "review_count" key absent from captured dict.

    Validates: Requirements 1.4 AC 9
    """
    product = make_product(reviews=17)
    captured = run_sync_and_capture(product)

    assert "review_count" in captured, (
        "DEFECT 4 CONFIRMED: 'review_count' key is ABSENT from the Firestore payload. "
        "Only 'reviews' is written. Client components querying 'review_count' get null."
    )
    assert captured["review_count"] == 17, (
        f"DEFECT 4 (value): review_count should be 17, got {captured.get('review_count')}"
    )


# ── Defect 5: creatorAvatar hardcoded to Unsplash URL ────────────────────────

def test_defect5_creator_avatar_must_not_contain_unsplash_url():
    """
    EXPECTED TO FAIL on unfixed code.

    The unfixed code hardcodes:
        "creatorAvatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?..."

    This test asserts the CORRECT behavior: creatorAvatar must not contain
    "unsplash.com" for any product.

    COUNTEREXAMPLE when failing:
        captured["creatorAvatar"] == "https://images.unsplash.com/..." (hardcoded)

    Validates: Requirements 1.5 AC 10, 11
    """
    product = make_product()
    captured = run_sync_and_capture(product)

    creator_avatar = captured.get("creatorAvatar") or ""
    assert "unsplash.com" not in creator_avatar, (
        f"DEFECT 5 CONFIRMED: 'creatorAvatar' contains hardcoded Unsplash URL: "
        f"'{creator_avatar}'. Every product stores the same generic placeholder avatar."
    )


# ── Defect 6: unsafe delete (no referential integrity check) ─────────────────

def test_defect6_delete_checks_references_and_always_proceeds():
    """
    FIXED BEHAVIOR: delete_product_from_firestore now checks cross-collection
    references before deleting, collects them for logging, and always deletes
    the product document (admin has authority).

    This test verifies that:
    1. delete() IS called even when an order reference exists.
    2. The returned references list contains the order reference.

    Validates: Requirements 1.7 AC 15–20
    """
    mock_db = MagicMock()

    # Set up the products collection document reference
    mock_product_doc_ref = MagicMock()

    # Set up orders collection: one document with an items array referencing productId "7"
    mock_order_doc = MagicMock()
    mock_order_doc.id = "ORD-001"
    mock_order_doc.to_dict.return_value = {
        "orderId": "ORD-001",
        "userId": "user_123",
        "items": [
            {"productId": "7", "productName": "Test Product", "price": 29.99}
        ],
        "totalAmount": 29.99,
        "status": "completed",
    }

    # Wire up collection routing
    def collection_router(name):
        coll_mock = MagicMock()
        if name == "orders":
            coll_mock.stream.return_value = [mock_order_doc]
        elif name == "reviews":
            coll_mock.where.return_value.stream.return_value = []
        elif name == "downloads":
            coll_mock.where.return_value.stream.return_value = []
        elif name == "products":
            coll_mock.document.return_value = mock_product_doc_ref
        else:
            coll_mock.stream.return_value = []
            coll_mock.where.return_value.stream.return_value = []
        return coll_mock

    mock_db.collection.side_effect = collection_router

    with patch("admin.firestore.admin_firestore.db", mock_db), \
         patch("admin.firestore.admin_firestore.firebase_connected", True):
        from admin.firestore.admin_firestore import delete_product_from_firestore
        result = delete_product_from_firestore(7)

    # FIXED behavior: references are detected and reported, but deletion proceeds
    assert result["deleted"] is True, (
        f"Expected deleted=True even with active order reference, got: {result}"
    )
    refs = result.get("references", [])
    assert any(r["collection"] == "orders" for r in refs), (
        f"Expected 'orders' collection in references list, got: {refs}"
    )
    # delete() MUST have been called — admin authority overrides reference check
    mock_product_doc_ref.delete.assert_called_once()
