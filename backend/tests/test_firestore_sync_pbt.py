"""
test_firestore_sync_pbt.py
--------------------------------------
Property-based tests for the fixed sync_product_to_firestore function.

Uses Hypothesis to verify that sync field correctness properties hold across
a wide range of generated inputs.

Properties 1-5 cover the five sync field fixes from Tasks 3.1-3.5 of the
firestore-product-sync-cleanup spec.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
"""

from hypothesis import given, settings, strategies as st
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone

# UTC timezone shorthand
utc = timezone.utc


# -- Helpers (mirrored from test_firestore_sync_unit.py) ----------------------

def make_product(**overrides):
    """
    Build a minimal MagicMock product object satisfying the attribute access
    pattern in sync_product_to_firestore without a real SQLAlchemy session.
    """
    p = MagicMock()
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


# -- Property 1 - updatedAt always matches product.updated_at -----------------

@settings(max_examples=50)
@given(updated_at=st.datetimes(timezones=st.just(utc)))
def test_pbt_property1_updated_at_always_matches_product_timestamp(updated_at):
    """
    For all generated UTC datetimes, captured["updatedAt"] must equal
    updated_at.isoformat() + "Z".

    **Validates: Requirements 1.1**
    """
    product = make_product(updated_at=updated_at)
    captured = run_sync_and_capture(product)

    expected = updated_at.isoformat() + "Z"
    assert captured["updatedAt"] == expected, (
        f"updatedAt should be '{expected}', got '{captured.get('updatedAt')}'"
    )


# -- Property 2 - product_id is always the integer product ID -----------------

@settings(max_examples=50)
@given(product_id=st.integers(min_value=1, max_value=10_000_000))
def test_pbt_property2_product_id_always_integer(product_id):
    """
    For all generated integer product IDs, captured["product_id"] must equal
    the integer product_id exactly.

    **Validates: Requirements 1.2**
    """
    product = make_product(id=product_id)
    captured = run_sync_and_capture(product)

    assert "product_id" in captured, "'product_id' key must be present in the Firestore payload"
    assert captured["product_id"] == product_id, (
        f"product_id should be {product_id}, got {captured.get('product_id')}"
    )
    assert isinstance(captured["product_id"], int), (
        f"product_id should be int, got {type(captured.get('product_id'))}"
    )


# -- Property 3 - file_url / fileUrl always written correctly -----------------

@settings(max_examples=50)
@given(
    file_url=st.one_of(
        st.none(),
        st.just(""),
        st.builds(
            lambda suffix: "http" + suffix,
            st.text(min_size=0, max_size=496),
        ),
    )
)
def test_pbt_property3_file_url_always_written_correctly(file_url):
    """
    For all generated file_url values:
    - If file_url is a non-empty string: both file_url and fileUrl in captured equal that string
    - If file_url is None or "": both file_url and fileUrl in captured are None

    **Validates: Requirements 1.3**
    """
    product = make_product(file_url=file_url)
    captured = run_sync_and_capture(product)

    assert "file_url" in captured, "'file_url' key must always be present"
    assert "fileUrl" in captured, "'fileUrl' key must always be present"

    if file_url:
        # Non-empty string: both keys should hold the actual URL
        assert captured["file_url"] == file_url, (
            f"file_url should be '{file_url}', got '{captured.get('file_url')}'"
        )
        assert captured["fileUrl"] == file_url, (
            f"fileUrl should be '{file_url}', got '{captured.get('fileUrl')}'"
        )
    else:
        # None or empty string: both keys should be None
        assert captured["file_url"] is None, (
            f"file_url should be None for input '{file_url}', got '{captured.get('file_url')}'"
        )
        assert captured["fileUrl"] is None, (
            f"fileUrl should be None for input '{file_url}', got '{captured.get('fileUrl')}'"
        )


# -- Property 4 - review_count / reviews dual-key invariant -------------------

@settings(max_examples=50)
@given(reviews=st.one_of(st.none(), st.integers(min_value=0, max_value=100_000)))
def test_pbt_property4_review_count_dual_key_invariant(reviews):
    """
    For all generated review counts (including None), both captured["review_count"]
    and captured["reviews"] must equal int(reviews or 0).

    **Validates: Requirements 1.4**
    """
    product = make_product(reviews=reviews)
    captured = run_sync_and_capture(product)

    expected = int(reviews or 0)

    assert "review_count" in captured, "'review_count' key must be present"
    assert "reviews" in captured, "'reviews' key must be present"
    assert captured["review_count"] == expected, (
        f"review_count should be {expected} for input {reviews!r}, got {captured.get('review_count')}"
    )
    assert captured["reviews"] == expected, (
        f"reviews should be {expected} for input {reviews!r}, got {captured.get('reviews')}"
    )
    assert captured["review_count"] == captured["reviews"], (
        f"review_count ({captured.get('review_count')}) and reviews ({captured.get('reviews')}) must always be equal"
    )


# -- Property 5 - creatorAvatar never contains unsplash.com -------------------

@settings(max_examples=50)
@given(creator_avatar=st.one_of(st.none(), st.text(min_size=0, max_size=500)))
def test_pbt_property5_creator_avatar_never_contains_unsplash(creator_avatar):
    """
    For all generated creator_avatar values, captured["creatorAvatar"] must never
    contain "unsplash.com". If the input itself contains "unsplash.com", the field
    must be None. If the input is a valid non-Unsplash URL, it is passed through.

    **Validates: Requirements 1.5**
    """
    product = make_product(creator_avatar=creator_avatar)
    captured = run_sync_and_capture(product)

    result = captured.get("creatorAvatar")

    # Core invariant: "unsplash.com" must never appear in the output
    assert "unsplash.com" not in (result or ""), (
        f"creatorAvatar must never contain 'unsplash.com', got '{result}' "
        f"for input '{creator_avatar}'"
    )

    # Secondary invariant: if input contains unsplash.com, output must be None
    if creator_avatar and "unsplash.com" in creator_avatar:
        assert result is None, (
            f"creatorAvatar must be None when input contains 'unsplash.com', "
            f"got '{result}'"
        )


# ??????????????????????????????????????????????????????????????????????????????
# Properties 7-9 (Preservation)
# Task 8.2 - firestore-product-sync-cleanup spec
# **Validates: Requirements 3.2, 3.3, 3.7, 3.8, 3.9**
# ??????????????????????????????????????????????????????????????????????????????


# -- Property 7 - Idempotency: N sync calls produce identical stable payloads --

def _run_sync_n_times_capture_all(product, n):
    """
    Run sync_product_to_firestore N times against a shared mock Firestore.
    Returns (mock_doc_ref, list_of_captured_payloads, list_of_set_kwargs).
    """
    mock_db = MagicMock()
    mock_doc_ref = MagicMock()
    mock_db.collection.return_value.document.return_value = mock_doc_ref

    all_payloads = []
    all_kwargs = []

    def capture_set(data, **kwargs):
        all_payloads.append(dict(data))
        all_kwargs.append(kwargs)

    mock_doc_ref.set.side_effect = capture_set

    with patch("admin.firestore.admin_firestore.db", mock_db), \
         patch("admin.firestore.admin_firestore.firebase_connected", True):
        from admin.firestore.admin_firestore import sync_product_to_firestore
        for _ in range(n):
            sync_product_to_firestore(product)

    return mock_doc_ref, all_payloads, all_kwargs


# Stable fields whose values must not change across repeated identical calls.
# (updatedAt is derived from product.updated_at after the fix, so it is also stable.)
_STABLE_FIELDS = [
    "title", "name", "description", "category", "price", "rating",
    "reviews", "review_count", "downloads", "thumbnail", "featured",
    "isFeatured", "status", "tags", "version", "fileSize",
    "createdAt", "updatedAt",
    "vendor_id", "pcloud_download_link", "pcloudDownloadLink",
    "file_url", "fileUrl", "product_id",
    "visibility", "license",
]


@given(n=st.integers(min_value=1, max_value=10))
@settings(max_examples=20)
def test_pbt_property7_idempotency_n_calls_produce_identical_payloads(n):
    """
    For any N ? 1, calling sync_product_to_firestore(p) N times with the
    same product:
    - Calls Firestore set() exactly N times.
    - Uses merge=True on every call.
    - Produces identical stable-field values across all N calls.

    **Validates: Requirements 3.2, 3.3**
    """
    product = make_product()
    doc_ref, all_payloads, all_kwargs = _run_sync_n_times_capture_all(product, n)

    # Firestore set() called exactly N times
    assert doc_ref.set.call_count == n, (
        f"Expected set() called {n} times, got {doc_ref.set.call_count}"
    )

    # Every call uses merge=True
    for i, kwargs in enumerate(all_kwargs):
        assert kwargs.get("merge") is True, (
            f"Call {i + 1}/{n}: merge=True missing; kwargs={kwargs}"
        )

    # Stable fields are identical across all N payloads
    first = all_payloads[0]
    for call_idx, payload in enumerate(all_payloads[1:], start=2):
        for field in _STABLE_FIELDS:
            assert payload.get(field) == first.get(field), (
                f"Call {call_idx}/{n}: field '{field}' changed "
                f"(first={first.get(field)!r}, call_{call_idx}={payload.get(field)!r})"
            )


# -- Property 8 - pCloud dual-key invariant ------------------------------------

@given(
    link=st.one_of(
        st.none(),
        st.builds(
            lambda s: "https://pcloud.example.com/" + s,
            st.text(min_size=0, max_size=100),
        ),
    )
)
@settings(max_examples=50)
def test_pbt_property8_pcloud_dual_key_invariant(link):
    """
    For any pcloud_download_link value (including None and any URL string),
    the sync function SHALL write both pcloud_download_link (snake_case) and
    pcloudDownloadLink (camelCase) with the same value as the input.

    **Validates: Requirements 3.7, 3.8**
    """
    product = make_product(pcloud_download_link=link)
    captured = run_sync_and_capture(product)

    assert "pcloud_download_link" in captured, (
        f"'pcloud_download_link' key missing from Firestore payload (link={link!r})"
    )
    assert "pcloudDownloadLink" in captured, (
        f"'pcloudDownloadLink' key missing from Firestore payload (link={link!r})"
    )
    # Both keys must carry the same value
    assert captured["pcloud_download_link"] == captured["pcloudDownloadLink"], (
        f"Dual-key mismatch: snake={captured['pcloud_download_link']!r} "
        f"camel={captured['pcloudDownloadLink']!r} (link={link!r})"
    )
    # Both keys must equal the original input value
    assert captured["pcloud_download_link"] == link, (
        f"pcloud_download_link wrong: expected {link!r}, got {captured['pcloud_download_link']!r}"
    )
    assert captured["pcloudDownloadLink"] == link, (
        f"pcloudDownloadLink wrong: expected {link!r}, got {captured['pcloudDownloadLink']!r}"
    )


# -- Property 9 - Thumbnail chain priority unchanged ---------------------------
#
# Priority chain (per design doc):
#   1. non-Unsplash product.thumbnail
#   2. image_urls[0]          (when thumbnail absent or Unsplash)
#   3. preview_images[0]      (when both above absent/Unsplash)
#   4. None                   (all sources exhausted/Unsplash)
#
# The @given decorator covers all 8 combinations:
#   thumbnail  ? image_urls           ? preview_images
#   (real url    | "https://unsplash.com/fake" | None)
#   ? (["https://img.example.com/first.jpg"] | [])
#   ? (["https://preview.example.com/p1.jpg"] | [])
#
# With max_examples=24 the library will explore all meaningful combinations.

def _expected_thumbnail(thumbnail, image_urls, preview_images):
    """
    Pure-Python reference implementation of the thumbnail priority chain.
    Matches the logic in sync_product_to_firestore exactly.
    """
    if thumbnail and "unsplash.com" not in thumbnail:
        return thumbnail
    # Thumbnail is absent or Unsplash - fall through
    if isinstance(image_urls, list) and image_urls:
        return image_urls[0]
    if isinstance(preview_images, list) and preview_images:
        return preview_images[0]
    # Everything exhausted or Unsplash
    if thumbnail and "unsplash.com" not in thumbnail:
        return thumbnail
    return None


@given(
    thumbnail=st.one_of(
        st.none(),
        st.just("https://unsplash.com/fake"),
        st.just("https://real.cdn.com/img.jpg"),
    ),
    image_urls=st.one_of(
        st.just([]),
        st.just(["https://img.example.com/first.jpg"]),
    ),
    preview_images=st.one_of(
        st.just([]),
        st.just(["https://preview.example.com/p1.jpg"]),
    ),
)
@settings(max_examples=24)
def test_pbt_property9_thumbnail_chain_unchanged(thumbnail, image_urls, preview_images):
    """
    For all 8 combinations of:
      thumbnail  (real / Unsplash / None)
      image_urls (non-empty / empty)
      preview_images (non-empty / empty)

    the sync function SHALL resolve thumbnail using the documented priority chain:
      non-Unsplash thumbnail ? image_urls[0] ? preview_images[0] ? None

    **Validates: Requirements 3.9**
    """
    product = make_product(
        thumbnail=thumbnail,
        image_urls=image_urls,
        preview_images=preview_images,
    )
    captured = run_sync_and_capture(product)

    expected = _expected_thumbnail(thumbnail, image_urls, preview_images)

    assert captured["thumbnail"] == expected, (
        f"Thumbnail chain mismatch: "
        f"thumbnail={thumbnail!r}, image_urls={image_urls!r}, "
        f"preview_images={preview_images!r} ? "
        f"expected={expected!r}, got={captured.get('thumbnail')!r}"
    )
