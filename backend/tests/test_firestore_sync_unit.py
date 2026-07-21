"""
test_firestore_sync_unit.py
--------------------------------------
Unit tests for the fixed sync_product_to_firestore function.

These tests verify the CORRECT behavior of all six sync field fixes applied
in Tasks 3.1-3.5 of the firestore-product-sync-cleanup spec.

Each test uses the same make_product() / run_sync_and_capture() helper pattern
established in test_firestore_sync_bug_condition.py so that the test surface is
consistent and the helpers are easy to maintain.

Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
"""

import pytest
import re
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone

# UTC timezone shorthand
utc = timezone.utc

# ISO-8601 pattern used to validate fallback timestamps
_ISO8601_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?\+\d{2}:\d{2}Z$"
    r"|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$"
)


# -- Minimal product fixture --------------------------------------------------

def make_product(**overrides):
    """
    Build a minimal MagicMock product object satisfying the attribute access
    pattern in sync_product_to_firestore without a real SQLAlchemy session.

    Mirrors the helper in test_firestore_sync_bug_condition.py exactly so both
    test files share the same product shape.
    """
    p = MagicMock()
    # Sensible defaults matching Product model column types
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
    p.creator_avatar = None

    for key, value in overrides.items():
        setattr(p, key, value)
    return p


# -- Helper: call sync and capture the dict passed to Firestore set() ---------

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


# -- Requirement 1.1 - updatedAt correctness ----------------------------------

def test_updated_at_uses_product_timestamp():
    """
    WHEN product.updated_at = datetime(2024, 6, 1, tzinfo=utc)
    THEN captured["updatedAt"] == "2024-06-01T00:00:00+00:00Z"

    Validates: Requirements 1.1 AC 1, 3
    """
    product = make_product(updated_at=datetime(2024, 6, 1, tzinfo=utc))
    captured = run_sync_and_capture(product)

    expected = product.updated_at.isoformat() + "Z"  # "2024-06-01T00:00:00+00:00Z"
    assert captured["updatedAt"] == expected, (
        f"updatedAt should be '{expected}' (from product.updated_at), "
        f"got '{captured.get('updatedAt')}'"
    )


def test_updated_at_fallback_when_none():
    """
    WHEN product.updated_at is None
    THEN captured["updatedAt"] is a valid ISO-8601 string (not None, not the
         product timestamp - a fallback wall-clock value is used).

    Validates: Requirements 1.1 AC 2
    """
    product = make_product(updated_at=None)
    captured = run_sync_and_capture(product)

    value = captured.get("updatedAt")
    assert value is not None, "updatedAt should NOT be None when falling back to wall-clock"
    assert isinstance(value, str), f"updatedAt should be a string, got {type(value)}"
    assert _ISO8601_RE.match(value), (
        f"updatedAt fallback '{value}' does not look like a valid ISO-8601 string"
    )


# -- Requirement 1.2 - product_id integer field --------------------------------

def test_product_id_integer_field():
    """
    WHEN sync_product_to_firestore is called
    THEN captured["product_id"] == p.id (integer)

    Validates: Requirements 1.2 AC 4, 5
    """
    product = make_product(id=42)
    captured = run_sync_and_capture(product)

    assert "product_id" in captured, "'product_id' key must be present in the Firestore payload"
    assert captured["product_id"] == product.id, (
        f"product_id should equal product.id ({product.id}), got {captured.get('product_id')}"
    )
    assert isinstance(captured["product_id"], int), (
        f"product_id should be an int, got {type(captured.get('product_id'))}"
    )


# -- Requirement 1.3 - file_url / fileUrl fields -------------------------------

def test_file_url_written_when_set():
    """
    WHEN product.file_url = "https://pcloud.example.com/dl/x"
    THEN both file_url and fileUrl are "https://pcloud.example.com/dl/x"

    Validates: Requirements 1.3 AC 6
    """
    url = "https://pcloud.example.com/dl/x"
    product = make_product(file_url=url)
    captured = run_sync_and_capture(product)

    assert "file_url" in captured, "'file_url' key must be present in the Firestore payload"
    assert captured["file_url"] == url, (
        f"file_url should be '{url}', got '{captured.get('file_url')}'"
    )
    assert "fileUrl" in captured, "'fileUrl' key must be present in the Firestore payload"
    assert captured["fileUrl"] == url, (
        f"fileUrl should be '{url}', got '{captured.get('fileUrl')}'"
    )


def test_file_url_written_as_none_when_absent():
    """
    WHEN product.file_url is None
    THEN both file_url and fileUrl are present and equal None

    Validates: Requirements 1.3 AC 7
    """
    product = make_product(file_url=None)
    captured = run_sync_and_capture(product)

    assert "file_url" in captured, "'file_url' key must be present even when None"
    assert captured["file_url"] is None, (
        f"file_url should be None when product.file_url is None, got '{captured.get('file_url')}'"
    )
    assert "fileUrl" in captured, "'fileUrl' key must be present even when None"
    assert captured["fileUrl"] is None, (
        f"fileUrl should be None when product.file_url is None, got '{captured.get('fileUrl')}'"
    )


def test_file_url_written_as_none_when_empty_string():
    """
    WHEN product.file_url is "" (empty string)
    THEN both file_url and fileUrl are present and equal None
    (empty string is treated the same as absent/None)

    Validates: Requirements 1.3 AC 7
    """
    product = make_product(file_url="")
    captured = run_sync_and_capture(product)

    assert "file_url" in captured, "'file_url' key must be present even when empty string"
    assert captured["file_url"] is None, (
        f"file_url should be None when product.file_url is '', got '{captured.get('file_url')}'"
    )
    assert "fileUrl" in captured, "'fileUrl' key must be present even when empty string"
    assert captured["fileUrl"] is None, (
        f"fileUrl should be None when product.file_url is '', got '{captured.get('fileUrl')}'"
    )


# -- Requirement 1.4 - review_count / reviews dual keys -----------------------

def test_review_count_dual_key():
    """
    WHEN product.reviews = 17
    THEN captured["review_count"] == 17 AND captured["reviews"] == 17

    Validates: Requirements 1.4 AC 9
    """
    product = make_product(reviews=17)
    captured = run_sync_and_capture(product)

    assert "review_count" in captured, "'review_count' key must be present in the Firestore payload"
    assert captured["review_count"] == 17, (
        f"review_count should be 17, got {captured.get('review_count')}"
    )
    assert "reviews" in captured, "'reviews' key must be present in the Firestore payload"
    assert captured["reviews"] == 17, (
        f"reviews should be 17, got {captured.get('reviews')}"
    )


def test_review_count_zero_when_none():
    """
    WHEN product.reviews is None
    THEN both review_count and reviews equal 0

    Validates: Requirements 1.4 AC 9
    """
    product = make_product(reviews=None)
    captured = run_sync_and_capture(product)

    assert "review_count" in captured, "'review_count' key must be present even when reviews is None"
    assert captured["review_count"] == 0, (
        f"review_count should be 0 when reviews is None, got {captured.get('review_count')}"
    )
    assert "reviews" in captured, "'reviews' key must be present even when reviews is None"
    assert captured["reviews"] == 0, (
        f"reviews should be 0 when reviews is None, got {captured.get('reviews')}"
    )


# -- Requirement 1.5 - creatorAvatar: no hardcoded Unsplash URL ---------------

def test_creator_avatar_no_unsplash_when_no_avatar():
    """
    WHEN product has no creator_avatar (None)
    THEN captured["creatorAvatar"] is None

    Validates: Requirements 1.5 AC 11
    """
    product = make_product(creator_avatar=None)
    captured = run_sync_and_capture(product)

    assert captured.get("creatorAvatar") is None, (
        f"creatorAvatar should be None when no avatar is available, "
        f"got '{captured.get('creatorAvatar')}'"
    )


def test_creator_avatar_real_url_used():
    """
    WHEN product.creator_avatar = "https://real.cdn.com/avatar.jpg"
    THEN captured["creatorAvatar"] == "https://real.cdn.com/avatar.jpg"

    Validates: Requirements 1.5 AC 10, 11
    """
    avatar_url = "https://real.cdn.com/avatar.jpg"
    product = make_product(creator_avatar=avatar_url)
    captured = run_sync_and_capture(product)

    assert captured.get("creatorAvatar") == avatar_url, (
        f"creatorAvatar should be '{avatar_url}' (real CDN URL), "
        f"got '{captured.get('creatorAvatar')}'"
    )


def test_creator_avatar_unsplash_filtered_to_none():
    """
    WHEN product.creator_avatar = "https://images.unsplash.com/photo-xxx"
    THEN captured["creatorAvatar"] is None
    (Unsplash URLs are filtered out - they represent placeholder/seed data)

    Validates: Requirements 1.5 AC 10, 11
    """
    unsplash_url = "https://images.unsplash.com/photo-xxx"
    product = make_product(creator_avatar=unsplash_url)
    captured = run_sync_and_capture(product)

    creator_avatar = captured.get("creatorAvatar")
    assert creator_avatar is None, (
        f"creatorAvatar should be None when the URL contains 'unsplash.com', "
        f"got '{creator_avatar}'"
    )
    # Double-check: no unsplash.com string leaked through
    if creator_avatar is not None:
        assert "unsplash.com" not in creator_avatar, (
            f"creatorAvatar must not contain 'unsplash.com', got '{creator_avatar}'"
        )
