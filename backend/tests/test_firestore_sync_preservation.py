"""
test_firestore_sync_preservation.py
--------------------------------------
Preservation property tests for Task 2 of the firestore-product-sync-cleanup spec.

CRITICAL: These tests run against the UNFIXED code and are ALL EXPECTED TO PASS.
They document the already-correct baseline behaviors that must not regress after
any fix is applied.

The four observed behaviors tested here:

  Property 2a - Thumbnail chain priority is preserved
  Property 2b - pCloud dual-key invariant is preserved
  Property 2c - Idempotency: identical calls produce identical payloads
  Property 2d - Firestore unavailable results in a clean no-op

**Validates: Requirements 3.2, 3.3, 3.4, 3.7, 3.8, 3.9**
"""

import pytest
from unittest.mock import MagicMock, patch, call
from datetime import datetime, timezone
from hypothesis import given, settings, strategies as st

# UTC timezone shorthand
utc = timezone.utc


# -- Minimal product fixture --------------------------------------------------

def make_product(**overrides):
    """
    Build a minimal MagicMock product that satisfies the attribute access
    pattern in sync_product_to_firestore without needing a real SQLAlchemy
    session.  Defaults represent a "clean" product with no seed/mock signals.
    """
    p = MagicMock()
    p.id = 42
    p.title = "Test Product"
    p.description = "A real product description"
    p.short_desc = "Short description"
    p.category = "Software"
    p.price = 29.99
    p.rating = 4.5
    p.reviews = 10
    p.downloads = 50
    p.thumbnail = "https://real.cdn.com/img.jpg"
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


# -- Helper: call sync and capture the dict passed to Firestore set() ---------

def run_sync_and_capture(product, mock_db=None):
    """
    Patches the Firestore db and firebase_connected in admin_firestore,
    calls sync_product_to_firestore(product), and returns (captured_dict, mock_doc_ref).
    """
    if mock_db is None:
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

    return captured, mock_doc_ref


# ???????????????????????????????????????????????????????????????????????????????
# OBSERVATION 1 - Thumbnail chain
# ???????????????????????????????????????????????????????????????????????????????
#
# Observed behavior (unfixed code):
#   thumbnail priority chain = non-Unsplash product.thumbnail
#                              ? image_urls[0]
#                              ? preview_images[0]
#                              ? None
#
# All 8 combinations of (thumbnail presence) ? (image_urls presence)
# ? (preview_images presence) are tested below.
#
# Validates: Requirements 3.9
# ???????????????????????????????????????????????????????????????????????????????

class TestThumbnailChain:
    """
    All 8 combinations of thumbnail / image_urls / preview_images.
    Naming: T = real thumbnail, U = unsplash thumbnail, _ = absent
            I = image_urls non-empty, _ = image_urls empty
            P = preview_images non-empty, _ = preview_images empty
    """

    def test_real_thumbnail_takes_priority_over_image_urls_and_preview(self):
        """T, I, P ? product.thumbnail (chain stops at first valid source)."""
        p = make_product(
            thumbnail="https://real.cdn.com/img.jpg",
            image_urls=["https://img.example.com/first.jpg"],
            preview_images=["https://preview.example.com/p1.jpg"],
        )
        captured, _ = run_sync_and_capture(p)
        assert captured["thumbnail"] == "https://real.cdn.com/img.jpg", (
            f"Expected real thumbnail, got: {captured['thumbnail']}"
        )

    def test_real_thumbnail_takes_priority_when_no_image_urls(self):
        """T, _, P ? product.thumbnail."""
        p = make_product(
            thumbnail="https://real.cdn.com/img.jpg",
            image_urls=[],
            preview_images=["https://preview.example.com/p1.jpg"],
        )
        captured, _ = run_sync_and_capture(p)
        assert captured["thumbnail"] == "https://real.cdn.com/img.jpg"

    def test_real_thumbnail_takes_priority_when_no_previews(self):
        """T, I, _ ? product.thumbnail."""
        p = make_product(
            thumbnail="https://real.cdn.com/img.jpg",
            image_urls=["https://img.example.com/first.jpg"],
            preview_images=[],
        )
        captured, _ = run_sync_and_capture(p)
        assert captured["thumbnail"] == "https://real.cdn.com/img.jpg"

    def test_real_thumbnail_only(self):
        """T, _, _ ? product.thumbnail."""
        p = make_product(
            thumbnail="https://real.cdn.com/img.jpg",
            image_urls=[],
            preview_images=[],
        )
        captured, _ = run_sync_and_capture(p)
        assert captured["thumbnail"] == "https://real.cdn.com/img.jpg"

    def test_unsplash_thumbnail_falls_through_to_image_urls(self):
        """U, I, P ? image_urls[0] (Unsplash is rejected, falls through)."""
        p = make_product(
            thumbnail="https://images.unsplash.com/photo-xyz?w=800",
            image_urls=["https://real.cdn.com/first.jpg"],
            preview_images=["https://preview.example.com/p1.jpg"],
        )
        captured, _ = run_sync_and_capture(p)
        assert captured["thumbnail"] == "https://real.cdn.com/first.jpg", (
            f"Expected image_urls[0] fallback, got: {captured['thumbnail']}"
        )

    def test_unsplash_thumbnail_falls_through_to_preview_images_when_no_image_urls(self):
        """U, _, P ? preview_images[0]."""
        p = make_product(
            thumbnail="https://images.unsplash.com/photo-xyz?w=800",
            image_urls=[],
            preview_images=["https://preview.example.com/p1.jpg"],
        )
        captured, _ = run_sync_and_capture(p)
        assert captured["thumbnail"] == "https://preview.example.com/p1.jpg", (
            f"Expected preview_images[0] fallback, got: {captured['thumbnail']}"
        )

    def test_unsplash_thumbnail_with_image_urls_ignores_preview_images(self):
        """U, I, _ ? image_urls[0] (preview_images not needed)."""
        p = make_product(
            thumbnail="https://images.unsplash.com/photo-xyz?w=800",
            image_urls=["https://real.cdn.com/first.jpg"],
            preview_images=[],
        )
        captured, _ = run_sync_and_capture(p)
        assert captured["thumbnail"] == "https://real.cdn.com/first.jpg"

    def test_all_absent_or_unsplash_resolves_to_none(self):
        """U, _, _ ? None (all sources exhausted)."""
        p = make_product(
            thumbnail="https://images.unsplash.com/photo-xyz?w=800",
            image_urls=[],
            preview_images=[],
        )
        captured, _ = run_sync_and_capture(p)
        assert captured["thumbnail"] is None, (
            f"Expected None when all thumbnail sources are Unsplash/empty, got: {captured['thumbnail']}"
        )

    def test_no_thumbnail_falls_to_image_urls(self):
        """None, I, P ? image_urls[0]."""
        p = make_product(
            thumbnail=None,
            image_urls=["https://real.cdn.com/first.jpg"],
            preview_images=["https://preview.example.com/p1.jpg"],
        )
        captured, _ = run_sync_and_capture(p)
        assert captured["thumbnail"] == "https://real.cdn.com/first.jpg"

    def test_no_thumbnail_no_image_urls_falls_to_preview(self):
        """None, _, P ? preview_images[0]."""
        p = make_product(
            thumbnail=None,
            image_urls=[],
            preview_images=["https://preview.example.com/p1.jpg"],
        )
        captured, _ = run_sync_and_capture(p)
        assert captured["thumbnail"] == "https://preview.example.com/p1.jpg"

    def test_completely_empty_product_thumbnail_is_none(self):
        """None, _, _ ? None."""
        p = make_product(
            thumbnail=None,
            image_urls=[],
            preview_images=[],
        )
        captured, _ = run_sync_and_capture(p)
        assert captured["thumbnail"] is None


# ???????????????????????????????????????????????????????????????????????????????
# OBSERVATION 2 - pCloud dual-key invariant
# ???????????????????????????????????????????????????????????????????????????????
#
# Observed behavior (unfixed code):
#   Both "pcloud_download_link" and "pcloudDownloadLink" are ALWAYS written
#   with the SAME value as product.pcloud_download_link (including None).
#
# Validates: Requirements 3.7, 3.8
# ???????????????????????????????????????????????????????????????????????????????

class TestPCloudDualKey:

    def test_pcloud_both_keys_written_with_same_value(self):
        """Both snake_case and camelCase keys written when a URL is set."""
        p = make_product(pcloud_download_link="https://pcloud.example.com/dl/abc")
        captured, _ = run_sync_and_capture(p)

        assert "pcloud_download_link" in captured, (
            "'pcloud_download_link' key missing from Firestore payload"
        )
        assert "pcloudDownloadLink" in captured, (
            "'pcloudDownloadLink' key missing from Firestore payload"
        )
        assert captured["pcloud_download_link"] == "https://pcloud.example.com/dl/abc"
        assert captured["pcloudDownloadLink"] == "https://pcloud.example.com/dl/abc"
        assert captured["pcloud_download_link"] == captured["pcloudDownloadLink"], (
            "Both pCloud keys must be identical"
        )

    def test_pcloud_both_keys_written_as_none_when_absent(self):
        """Both keys are present and set to None when pcloud_download_link is None."""
        p = make_product(pcloud_download_link=None)
        captured, _ = run_sync_and_capture(p)

        assert "pcloud_download_link" in captured
        assert "pcloudDownloadLink" in captured
        assert captured["pcloud_download_link"] is None
        assert captured["pcloudDownloadLink"] is None

    @given(
        link=st.one_of(
            st.none(),
            st.text(min_size=0, max_size=300).filter(lambda s: not s or s.startswith("http")),
        )
    )
    @settings(max_examples=50)
    def test_pcloud_dual_key_invariant_property(self, link):
        """
        **Validates: Requirements 3.7, 3.8**

        Property 2b (PBT): For ANY pcloud_download_link value (including None),
        both pcloud_download_link and pcloudDownloadLink are ALWAYS written with
        identical values.
        """
        p = make_product(pcloud_download_link=link)
        captured, _ = run_sync_and_capture(p)

        assert "pcloud_download_link" in captured, (
            f"pcloud_download_link missing from payload (link={link!r})"
        )
        assert "pcloudDownloadLink" in captured, (
            f"pcloudDownloadLink missing from payload (link={link!r})"
        )
        assert captured["pcloud_download_link"] == captured["pcloudDownloadLink"], (
            f"Dual-key mismatch: snake={captured['pcloud_download_link']!r} "
            f"camel={captured['pcloudDownloadLink']!r} (link={link!r})"
        )
        assert captured["pcloud_download_link"] == link, (
            f"pcloud_download_link value wrong: expected {link!r}, got {captured['pcloud_download_link']!r}"
        )


# ???????????????????????????????????????????????????????????????????????????????
# OBSERVATION 3 - Idempotency
# ???????????????????????????????????????????????????????????????????????????????
#
# Observed behavior (unfixed code):
#   Calling sync_product_to_firestore(p) N times with identical data:
#   - Calls Firestore set() exactly N times (one per call)
#   - Each call passes merge=True
#   - The payload dict is identical on every call (for non-wall-clock fields)
#
# Note: The UNFIXED code writes wall-clock time for updatedAt, so the payload
# will differ across calls for that one field. We test that all OTHER fields
# are stable across calls - i.e., the function is deterministic for non-time fields.
# After the fix, even updatedAt will be stable (it'll use product.updated_at).
#
# Validates: Requirements 3.2, 3.3
# ???????????????????????????????????????????????????????????????????????????????

class TestIdempotency:

    def _run_sync_n_times(self, product, n):
        """Run sync N times against a shared mock, collect all call args."""
        mock_db = MagicMock()
        mock_doc_ref = MagicMock()
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        all_captured = []

        def capture_set(data, **kwargs):
            all_captured.append((dict(data), kwargs))

        mock_doc_ref.set.side_effect = capture_set

        with patch("admin.firestore.admin_firestore.db", mock_db), \
             patch("admin.firestore.admin_firestore.firebase_connected", True):
            from admin.firestore.admin_firestore import sync_product_to_firestore
            for _ in range(n):
                sync_product_to_firestore(product)

        return mock_doc_ref, all_captured

    def test_firestore_set_called_once_per_sync_call(self):
        """Calling sync once results in exactly one Firestore set() call."""
        p = make_product()
        doc_ref, captured_calls = self._run_sync_n_times(p, 1)
        assert doc_ref.set.call_count == 1

    def test_firestore_set_called_three_times_for_three_calls(self):
        """Calling sync 3 times results in exactly 3 Firestore set() calls."""
        p = make_product()
        doc_ref, captured_calls = self._run_sync_n_times(p, 3)
        assert doc_ref.set.call_count == 3

    def test_all_sync_calls_use_merge_true(self):
        """Every set() call uses merge=True."""
        p = make_product()
        doc_ref, captured_calls = self._run_sync_n_times(p, 3)
        for payload, kwargs in captured_calls:
            assert kwargs.get("merge") is True, (
                f"merge=True not passed on a set() call; kwargs={kwargs}"
            )

    def test_stable_fields_are_identical_across_repeated_calls(self):
        """
        Stable fields (everything except updatedAt which uses wall-clock in
        unfixed code) are identical across repeated calls with the same product.
        """
        # Fields that should be stable (not wall-clock-dependent) in unfixed code
        stable_fields = [
            "title", "name", "description", "category", "price", "rating",
            "reviews", "downloads", "thumbnail", "featured", "isFeatured",
            "status", "tags", "version", "fileSize", "createdAt",
            "vendor_id", "pcloud_download_link", "pcloudDownloadLink",
            "visibility", "license",
        ]
        p = make_product()
        doc_ref, captured_calls = self._run_sync_n_times(p, 3)

        first_payload = captured_calls[0][0]
        for payload, _ in captured_calls[1:]:
            for field in stable_fields:
                assert payload.get(field) == first_payload.get(field), (
                    f"Field '{field}' changed across sync calls: "
                    f"first={first_payload.get(field)!r}, subsequent={payload.get(field)!r}"
                )

    def test_document_path_is_same_for_all_repeated_calls(self):
        """All N calls target the same document path (/products/{product.id})."""
        p = make_product(id=99)
        mock_db = MagicMock()
        mock_coll = MagicMock()
        mock_doc_ref = MagicMock()
        mock_db.collection.return_value = mock_coll
        mock_coll.document.return_value = mock_doc_ref

        with patch("admin.firestore.admin_firestore.db", mock_db), \
             patch("admin.firestore.admin_firestore.firebase_connected", True):
            from admin.firestore.admin_firestore import sync_product_to_firestore
            sync_product_to_firestore(p)
            sync_product_to_firestore(p)
            sync_product_to_firestore(p)

        # collection("products") called 3 times
        assert mock_db.collection.call_count == 3
        for c in mock_db.collection.call_args_list:
            assert c.args[0] == "products"

        # document("99") called 3 times - same path every time
        assert mock_coll.document.call_count == 3
        for c in mock_coll.document.call_args_list:
            assert c.args[0] == "99"

    @given(n=st.integers(min_value=1, max_value=10))
    @settings(max_examples=20)
    def test_idempotency_set_called_exactly_n_times(self, n):
        """
        **Validates: Requirements 3.2, 3.3**

        Property 2c (PBT): For any N ? 1, calling sync N times results in
        exactly N Firestore set() calls, all with merge=True.
        """
        p = make_product()
        doc_ref, captured_calls = self._run_sync_n_times(p, n)

        assert doc_ref.set.call_count == n, (
            f"Expected set() to be called {n} times, got {doc_ref.set.call_count}"
        )
        for payload, kwargs in captured_calls:
            assert kwargs.get("merge") is True, (
                f"merge=True missing on call (n={n}): kwargs={kwargs}"
            )


# ???????????????????????????????????????????????????????????????????????????????
# OBSERVATION 4 - Firestore unavailable no-op
# ???????????????????????????????????????????????????????????????????????????????
#
# Observed behavior (unfixed code):
#   When firebase_connected is False (or db is None):
#   - sync_product_to_firestore returns immediately with no exception
#   - No Firestore call is made whatsoever
#   - The calling code can proceed normally
#
# Validates: Requirements 3.4, 1.6 (AC 14)
# ???????????????????????????????????????????????????????????????????????????????

class TestFirestoreUnavailableNoOp:

    def test_no_exception_when_firebase_not_connected(self):
        """sync_product_to_firestore does not raise when firebase_connected=False."""
        p = make_product()
        mock_db = MagicMock()

        # Should not raise
        with patch("admin.firestore.admin_firestore.db", mock_db), \
             patch("admin.firestore.admin_firestore.firebase_connected", False):
            from admin.firestore.admin_firestore import sync_product_to_firestore
            sync_product_to_firestore(p)  # must return cleanly

    def test_no_firestore_call_when_firebase_not_connected(self):
        """No Firestore set() or collection() call is made when not connected."""
        p = make_product()
        mock_db = MagicMock()

        with patch("admin.firestore.admin_firestore.db", mock_db), \
             patch("admin.firestore.admin_firestore.firebase_connected", False):
            from admin.firestore.admin_firestore import sync_product_to_firestore
            sync_product_to_firestore(p)

        mock_db.collection.assert_not_called()

    def test_no_exception_when_db_is_none(self):
        """sync_product_to_firestore does not raise when db is None."""
        p = make_product()

        with patch("admin.firestore.admin_firestore.db", None), \
             patch("admin.firestore.admin_firestore.firebase_connected", True):
            from admin.firestore.admin_firestore import sync_product_to_firestore
            sync_product_to_firestore(p)  # must return cleanly

    def test_no_firestore_call_when_db_is_none(self):
        """No Firestore operation is attempted when db is None."""
        p = make_product()
        sentinel = MagicMock()

        # Patch db to None - no call should land on sentinel
        with patch("admin.firestore.admin_firestore.db", None), \
             patch("admin.firestore.admin_firestore.firebase_connected", True):
            from admin.firestore.admin_firestore import sync_product_to_firestore
            sync_product_to_firestore(p)
        # If we get here without exception, the test passes

    def test_function_returns_none_when_unavailable(self):
        """Return value is None (implicit return) when Firestore is unavailable."""
        p = make_product()

        with patch("admin.firestore.admin_firestore.db", MagicMock()), \
             patch("admin.firestore.admin_firestore.firebase_connected", False):
            from admin.firestore.admin_firestore import sync_product_to_firestore
            result = sync_product_to_firestore(p)

        assert result is None

    @given(
        connected=st.booleans(),
        db_none=st.booleans(),
    )
    @settings(max_examples=30)
    def test_no_op_property_when_unavailable(self, connected, db_none):
        """
        **Validates: Requirements 3.4**

        Property 2d (PBT): When firebase_connected is False OR db is None,
        sync_product_to_firestore NEVER raises an exception and NEVER calls
        any Firestore method.
        """
        # Only test the unavailable scenarios
        if connected and not db_none:
            return  # Skip the connected+db-present case (that's not a no-op)

        p = make_product()
        mock_db = MagicMock() if not db_none else None

        with patch("admin.firestore.admin_firestore.db", mock_db), \
             patch("admin.firestore.admin_firestore.firebase_connected", connected):
            from admin.firestore.admin_firestore import sync_product_to_firestore
            try:
                sync_product_to_firestore(p)
            except Exception as e:
                pytest.fail(
                    f"sync_product_to_firestore raised {type(e).__name__} when "
                    f"firebase_connected={connected}, db={'None' if db_none else 'mock'}. "
                    f"Expected a clean no-op."
                )

        # If db was a mock, verify no Firestore calls were made
        if mock_db is not None:
            mock_db.collection.assert_not_called()


# ???????????????????????????????????????????????????????????????????????????????
# ADDITIONAL PRESERVATION: pCloud dual-key also works post-sync correctly
# (cross-checks that pcloud fields survive regardless of file_url and thumbnail)
# ???????????????????????????????????????????????????????????????????????????????

class TestPCloudAndThumbnailCombinations:

    def test_pcloud_preserved_with_real_thumbnail(self):
        """pCloud dual-key is present and correct even when thumbnail is a real URL."""
        p = make_product(
            pcloud_download_link="https://pcloud.example.com/dl/abc",
            thumbnail="https://real.cdn.com/img.jpg",
        )
        captured, _ = run_sync_and_capture(p)

        assert captured["pcloud_download_link"] == "https://pcloud.example.com/dl/abc"
        assert captured["pcloudDownloadLink"] == "https://pcloud.example.com/dl/abc"
        assert captured["thumbnail"] == "https://real.cdn.com/img.jpg"

    def test_pcloud_preserved_when_thumbnail_is_none(self):
        """pCloud dual-key is present even when thumbnail is None."""
        p = make_product(
            pcloud_download_link="https://pcloud.example.com/dl/abc",
            thumbnail=None,
            image_urls=[],
            preview_images=[],
        )
        captured, _ = run_sync_and_capture(p)

        assert captured["pcloud_download_link"] == "https://pcloud.example.com/dl/abc"
        assert captured["pcloudDownloadLink"] == "https://pcloud.example.com/dl/abc"
        assert captured["thumbnail"] is None
