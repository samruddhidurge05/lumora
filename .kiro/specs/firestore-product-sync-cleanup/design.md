# Firestore Product Sync Cleanup — Bugfix Design

## Overview

This fix addresses two tightly coupled concerns in the Admin backend's Firestore
synchronization pipeline.

**Part 1 — Sync correctness:** `sync_product_to_firestore` in
`backend/admin/firestore/admin_firestore.py` writes six incorrect or missing fields
(`updatedAt`, `product_id`, `file_url`/`fileUrl`, `review_count`, `creatorAvatar`) and
`delete_product_from_firestore` deletes without referential-integrity checks and returns
no structured result. Two new lightweight PATCH endpoints for status/featured toggling
are added to `backend/admin/routes/products.py`.

**Part 2 — Safe cleanup:** A standalone script
`backend/scripts/cleanup_firestore_mock_products.py` identifies and removes seeded/mock
Firestore product documents using a multi-signal approach with recency protection and
pre-deletion referential-integrity checks across five Firestore collections.

SQLite remains the canonical source of truth throughout. Firestore is the real-time read
layer only.

---

## Glossary

| Term | Definition |
|------|-----------|
| **Bug_Condition (C)** | The set of inputs or states that trigger any one of the seven identified defects. |
| **Property (P)** | The desired post-condition that must hold after the fixed function executes on a buggy input. |
| **Preservation** | Existing correct behaviors (thumbnail chain, pCloud dual-key, idempotent upsert, etc.) that must remain unchanged after the fix. |
| **`sync_product_to_firestore`** | The function in `backend/admin/firestore/admin_firestore.py` that writes a SQLite-committed product record to the Firestore `products` collection via `set(..., merge=True)`. |
| **`delete_product_from_firestore`** | The function in the same file that removes a Firestore product document; must be extended with referential-integrity checks and structured return. |
| **Seed/mock product** | A Firestore document created by a development seed script, identifiable by ≥ 2 of the five detection signals. |
| **Referenced product** | A product whose Firestore document ID appears in `orders`, `reviews`, `downloads`, `analytics`, or customer-facing collections. |
| **Idempotent sync** | Calling `sync_product_to_firestore` N ≥ 1 times with the same product produces exactly one Firestore document with the expected field values. |

---

## Bug Details

### Bug Condition

The bug manifests across seven distinct defects in `sync_product_to_firestore` and
`delete_product_from_firestore`. A sync call is buggy when any of the following
conditions hold.

**Formal Specification:**

```
FUNCTION isBugCondition(product, call_context)
  INPUT:  product        — SQLite Product ORM object
          call_context   — one of {sync, delete}
  OUTPUT: boolean

  -- Defect 1: updatedAt uses wall-clock time instead of product.updated_at
  IF call_context == sync AND product.updated_at IS NOT NULL
     AND firestoreDoc["updatedAt"] != product.updated_at.isoformat() + "Z"
    RETURN TRUE

  -- Defect 2: product_id integer field is absent
  IF call_context == sync AND "product_id" NOT IN firestoreDoc
    RETURN TRUE

  -- Defect 3: file_url / fileUrl are absent
  IF call_context == sync AND product.file_url IS NOT NULL AND product.file_url != ""
     AND ("file_url" NOT IN firestoreDoc OR "fileUrl" NOT IN firestoreDoc)
    RETURN TRUE

  -- Defect 4: review_count key is absent (only "reviews" is written)
  IF call_context == sync AND "review_count" NOT IN firestoreDoc
    RETURN TRUE

  -- Defect 5: creatorAvatar is a hardcoded Unsplash URL
  IF call_context == sync
     AND "unsplash.com" IN firestoreDoc.get("creatorAvatar", "")
    RETURN TRUE

  -- Defect 6: delete proceeds without referential-integrity check
  IF call_context == delete AND noReferenceCheckPerformed
    RETURN TRUE

  RETURN FALSE
END FUNCTION
```

### Examples

**Defect 1 — updatedAt skew:**
- Product last updated 2024-06-01T10:00:00Z. Sync called at 2024-12-01T15:30:00Z.
  - Actual (buggy): `updatedAt = "2024-12-01T15:30:00Z"` (wall-clock)
  - Expected: `updatedAt = "2024-06-01T10:00:00Z"` (from SQLite)

**Defect 2 — product_id absent:**
- Product with `id = 42`. Firestore document at `/products/42` has no `product_id` field.
  - Client code that does `doc.get("product_id")` receives `null` instead of `42`.

**Defect 3 — file_url missing:**
- Product with `file_url = "https://pcloud.example.com/dl/abc123"`.
  - Firestore doc has `pcloud_download_link` and `pcloudDownloadLink` but no `file_url`/`fileUrl`.
  - Consumers using the `file_url` key receive `undefined`.

**Defect 4 — review_count absent:**
- Product with `reviews = 17`. Firestore doc contains `"reviews": 17` but no `"review_count"`.
  - Marketplace components querying `review_count` show `null` star counts.

**Defect 5 — hardcoded Unsplash avatar:**
- Any product sync stores
  `creatorAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?..."`.
  - Every product page shows the same generic avatar, not the creator's real one.

**Defect 6 — unsafe delete:**
- Product ID 7 is referenced in an `orders` document. Admin triggers delete.
  - Current code deletes Firestore `/products/7` immediately, leaving the order item
    pointing at a ghost document.

**Defect 7 (Cleanup) — 50 seed documents present:**
- Firestore `products` collection contains documents with `thumbnail` containing
  `"unsplash.com"` and `title` matching `"Product 12"`, created in a 60-second batch
  cluster — qualifying under ≥ 2 signals with no real order references.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `set(..., merge=True)` upsert strategy in `sync_product_to_firestore` must remain,
  preserving idempotent write semantics.
- `pcloud_download_link` and `pcloudDownloadLink` dual-key convention must be preserved.
- Thumbnail priority chain (non-Unsplash `product.thumbnail` → `image_urls[0]` →
  `preview_images[0]` → `None`) must remain unmodified.
- `createdAt` derivation from `product.created_at` (with UTC-now fallback) must remain
  unchanged.
- `preview` field resolution logic must remain unchanged.
- All route handlers (`POST /`, `PUT /{id}`, `DELETE /{id}`) must continue to call
  sync/delete after SQLite commit, in the same order as today.
- `sync_order_to_firestore`, `get_platform_settings`, `restore_sqlite_products_from_firestore`,
  and all team-management sync helpers must not be modified.
- Admin authentication, RBAC, session management, orders, payments, reviews, analytics,
  and reports modules must not be modified.

**Scope:**
All product fields not listed in the seven defects above (title, description, price,
category, rating, downloads, thumbnail, preview, status, featured, tags, highlights,
version, fileSize, createdAt, vendor_id, features, systemRequirements, whatYouGet,
installationGuide, shortDesc, subcategory, discount, image_urls, previewImages,
previewVideo, seoTitle, seoDescription, visibility, license, affiliate_enabled,
commission_type, commission_value, pcloud_download_link) must be written identically
to the current implementation.

The cleanup script must not touch SQLite in any way.

---

## Hypothesized Root Cause

### Part 1 — Sync Field Defects

1. **`updatedAt` wall-clock substitution (Defect 1):**
   The line `"updatedAt": datetime.now(timezone.utc).isoformat() + "Z"` was written
   without referencing `product.updated_at`, likely because the original author assumed
   the sync call time was "close enough" to the SQLite commit time. This assumption
   breaks when syncs are retried, replayed, or called from admin tooling.

2. **Missing `product_id` field (Defect 2):**
   The integer primary key was never added to the Firestore payload. The document ID
   is always `str(product.id)`, but there is no explicit integer field for clients that
   need a numeric ID without parsing a string.

3. **Missing `file_url` / `fileUrl` (Defect 3):**
   The payload only maps `product.pcloud_download_link` under two keys. `product.file_url`
   — a separate field used by download consumers — was never included, likely because
   `pcloud_download_link` was assumed to be the only download field at the time of initial
   implementation.

4. **Missing `review_count` key (Defect 4):**
   Only `"reviews"` was added to match the SQLite column name. A secondary camelCase alias
   `review_count` was never written, yet client components query that key.

5. **Hardcoded `creatorAvatar` (Defect 5):**
   A placeholder Unsplash URL was inserted as a development default and was never replaced
   with a dynamic lookup. The product and vendor models do carry avatar fields that were
   overlooked.

6. **No referential check in `delete_product_from_firestore` (Defect 6):**
   The delete path was written as a simple one-liner with no cross-collection query.
   Referential integrity between `products` and `orders`/`reviews`/`downloads` was never
   implemented. The function also returns `None` implicitly, preventing callers from
   distinguishing a blocked delete from a successful one.

### Part 2 — Cleanup Gap

7. **No automated seed removal (Defect 7):**
   No cleanup tooling exists. Seed documents were created during development and were
   never removed. The 30-day recency guard and multi-signal detection logic were also
   never implemented.

---

## Correctness Properties

Property 1: Bug Condition — updatedAt reflects SQLite timestamp

_For any_ product `p` where `p.updated_at` is not `None`, calling the fixed
`sync_product_to_firestore(p)` SHALL write `updatedAt` equal to
`p.updated_at.isoformat() + "Z"` — never the wall-clock time of the sync call.

**Validates: Requirements 1.1 (AC 1, 3)**

---

Property 2: Bug Condition — product_id integer field present

_For any_ product `p`, calling the fixed `sync_product_to_firestore(p)` SHALL write
`product_id` as an integer field equal to `p.id` in the Firestore document.

**Validates: Requirements 1.2 (AC 4, 5)**

---

Property 3: Bug Condition — file_url and fileUrl both written

_For any_ product `p`, calling the fixed `sync_product_to_firestore(p)` SHALL write
both `file_url` and `fileUrl` keys: set to `p.file_url` when it is non-empty, or
`None` when it is absent/empty.

**Validates: Requirements 1.3 (AC 6, 7)**

---

Property 4: Bug Condition — review_count and reviews dual keys

_For any_ product `p`, calling the fixed `sync_product_to_firestore(p)` SHALL write
both `review_count` and `reviews` with the value `int(p.reviews or 0)`.

**Validates: Requirements 1.4 (AC 9)**

---

Property 5: Bug Condition — creatorAvatar never contains unsplash.com

_For any_ product `p`, calling the fixed `sync_product_to_firestore(p)` SHALL write
`creatorAvatar` to a value that does NOT contain `"unsplash.com"`. When no real avatar
is available, `creatorAvatar` SHALL be `None`.

**Validates: Requirements 1.5 (AC 10, 11)**

---

Property 6: Bug Condition — delete returns structured result and checks references

_For any_ product ID `pid`, calling the fixed `delete_product_from_firestore(pid)` SHALL:
- Return `{"blocked": True, "reason": "firestore_unavailable", "references": []}` when
  Firestore is unavailable.
- Return `{"blocked": True, "references": [...]}` (without deleting) when any reference
  exists in `orders`, `reviews`, or `downloads`.
- Return `{"blocked": False, "references": []}` (and delete) only when zero references
  are found.

**Validates: Requirements 1.7 (AC 15–20)**

---

Property 7: Preservation — idempotent sync produces no duplicate documents

_For any_ product `p` and any integer `N ≥ 1`, calling the fixed
`sync_product_to_firestore(p)` N times SHALL result in exactly one document at
`/products/{str(p.id)}` with field values equal to those of the most recent call.

**Validates: Requirements 3.2, 3.3**

---

Property 8: Preservation — pcloud_download_link dual-key invariant

_For any_ product `p`, the fixed `sync_product_to_firestore(p)` SHALL write both
`pcloud_download_link` and `pcloudDownloadLink` with identical values (unchanged from
the current implementation).

**Validates: Requirements 3.7, 3.8**

---

Property 9: Preservation — thumbnail priority chain unchanged

_For any_ product `p`, the fixed `sync_product_to_firestore(p)` SHALL resolve
`thumbnail` using the priority chain:
`non-Unsplash p.thumbnail` → `p.image_urls[0]` → `p.preview_images[0]` → `None`.
This chain SHALL be identical to the current implementation.

**Validates: Requirements 3.9**

---

Property 10: Bug Condition — seed/mock detection is signal-threshold based

_For any_ Firestore product document `d`, the cleanup script SHALL flag `d` as a
seed/mock candidate if and only if it satisfies ≥ 2 of the five defined signals
(Unsplash thumbnail, generic title regex, batch timestamp cluster, known seed vendor ID,
lorem-ipsum description).

**Validates: Requirements 2.1 (AC 1, 2)**

---

Property 11: Bug Condition — recency protection

_For any_ product document `d` where `d.createdAt` is within 30 calendar days (UTC) of
the script execution date, the cleanup script SHALL NOT delete `d` regardless of how
many seed/mock signals it satisfies.

**Validates: Requirements 2.2 (AC 4)**

---

Property 12: Bug Condition — cleanup referential integrity

_For any_ seed/mock candidate `d`, the cleanup script SHALL NOT delete `d` if any
reference to `d`'s document ID exists in `orders`, `reviews`, `downloads`, `analytics`,
or customer-facing collections.

**Validates: Requirements 2.3 (AC 5–10)**

---

Property 13: Preservation — cleanup does not modify SQLite

_For any_ execution of the cleanup script, the SQLite database SHALL contain the same
rows, column values, and row count before and after the script completes.

**Validates: Requirements 2.4 (AC 13), 3.6**


---

## Fix Implementation

### Part 1 — `sync_product_to_firestore` changes

**File:** `backend/admin/firestore/admin_firestore.py`
**Function:** `sync_product_to_firestore`

**Specific Changes:**

1. **Fix `updatedAt`:**
   Replace the hardcoded wall-clock assignment with a conditional:
   ```python
   "updatedAt": (
       product.updated_at.isoformat() + "Z"
       if product.updated_at
       else datetime.now(timezone.utc).isoformat() + "Z"
   ),
   ```

2. **Add `product_id` integer field:**
   Add to the payload dict:
   ```python
   "product_id": int(product.id),
   ```

3. **Add `file_url` / `fileUrl` fields:**
   Add both keys; write `None` when absent so consumers can distinguish
   "not set" from a key that was never written:
   ```python
   "file_url":  product.file_url or None,
   "fileUrl":   product.file_url or None,
   ```

4. **Add `review_count` alongside `reviews`:**
   Replace the existing `"reviews": int(product.reviews or 0)` line with:
   ```python
   "reviews":      int(product.reviews or 0),
   "review_count": int(product.reviews or 0),
   ```

5. **Fix `creatorAvatar` — remove hardcoded Unsplash URL:**
   Replace the hardcoded string with a dynamic lookup that filters out Unsplash URLs:
   ```python
   "creatorAvatar": (
       product.creator_avatar
       if getattr(product, "creator_avatar", None)
          and "unsplash.com" not in product.creator_avatar
       else None
   ),
   ```
   If the `Product` model does not have a `creator_avatar` column, this evaluates to
   `None` (acceptable per AC 11).


### Part 1 — `delete_product_from_firestore` changes

**Function:** `delete_product_from_firestore`

**Specific Changes:**

Replace the current single-line delete body with:

```python
def delete_product_from_firestore(product_id: int) -> dict:
    if not firebase_connected or db is None:
        return {"blocked": True, "reason": "firestore_unavailable", "references": []}
    try:
        pid = str(product_id)
        references = []

        # Check orders collection (items array contains productId)
        for doc in db.collection("orders").stream():
            data = doc.to_dict() or {}
            items = data.get("items", [])
            if any(str(item.get("productId", "")) == pid for item in items):
                references.append({"collection": "orders", "doc_id": doc.id})

        # Check reviews
        for doc in db.collection("reviews").where("productId", "==", pid).stream():
            references.append({"collection": "reviews", "doc_id": doc.id})

        # Check downloads
        for doc in db.collection("downloads").where("productId", "==", pid).stream():
            references.append({"collection": "downloads", "doc_id": doc.id})

        if references:
            return {"blocked": True, "references": references}

        db.collection("products").document(pid).delete()
        return {"blocked": False, "references": []}
    except Exception as e:
        print(f"[firestore-sync] Error deleting product {product_id} from Firestore: {e}")
        return {"blocked": True, "reason": "exception", "references": []}
```

The caller in `DELETE /admin/products/{id}` route handler may log the structured
result but does not need to change its HTTP response (204 is still returned after
SQLite deletion regardless of Firestore block status, which should be surfaced via
a warning log rather than an error response — the product is already gone from SQLite).


### Part 1 — New PATCH endpoints

**File:** `backend/admin/routes/products.py`

**Changes:**

Add two new route handlers after the existing `PUT /{product_id}` handler:

```python
from pydantic import BaseModel
from typing import Literal

class StatusPatch(BaseModel):
    status: Literal["published", "draft"]

class FeaturedPatch(BaseModel):
    featured: bool

@router.patch("/{product_id}/status", response_model=ProductResponse)
def patch_product_status(
    product_id: int,
    body: StatusPatch,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin_role)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.status = body.status
    db.commit()
    db.refresh(product)
    sync_product_to_firestore(product)
    return product

@router.patch("/{product_id}/featured", response_model=ProductResponse)
def patch_product_featured(
    product_id: int,
    body: FeaturedPatch,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin_role)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.featured = body.featured
    db.commit()
    db.refresh(product)
    sync_product_to_firestore(product)
    return product
```


### Part 2 — Cleanup script

**File:** `backend/scripts/cleanup_firestore_mock_products.py`

**Design:**

```
FUNCTION run_cleanup(dry_run=True):
  run_date = UTC today (midnight)
  products = fetch all documents from Firestore "products" collection

  candidates = []
  FOR each doc IN products:
    signals = evaluate_signals(doc)
    IF len(signals) >= 2:
      candidates.append((doc.id, doc.data, signals))

  deleted = []
  blocked_recent = []
  blocked_referenced = []

  FOR (doc_id, data, signals) IN candidates:
    created_at = parse(data.get("createdAt"))
    IF created_at AND (run_date - created_at).days < 30:
      blocked_recent.append(doc_id)
      CONTINUE

    refs = check_references(doc_id)  -- queries orders, reviews, downloads,
                                     -- analytics, and customer collections
    IF refs:
      blocked_referenced.append({doc_id: refs})
      CONTINUE

    IF NOT dry_run:
      db.collection("products").document(doc_id).delete()
    deleted.append(doc_id)

  PRINT structured cleanup report

FUNCTION evaluate_signals(doc) -> list[str]:
  data = doc.to_dict()
  signals = []
  IF "unsplash.com" IN (data.get("thumbnail") or ""):
    signals.append("unsplash_thumbnail")
  title = data.get("title") or data.get("name") or ""
  IF re.match(r"^(product\s*\d+|test\s+product|sample.*|mock.*|demo.*|seed.*)", title, re.I):
    signals.append("generic_title")
  IF data.get("vendor_id") IN KNOWN_SEED_VENDOR_IDS:
    signals.append("seed_vendor")
  desc = data.get("description") or ""
  IF re.search(r"(lorem ipsum|this is a sample|generated|placeholder|filler)", desc, re.I):
    signals.append("lorem_description")
  -- batch timestamp signal evaluated across all candidates after initial pass
  RETURN signals

FUNCTION check_references(pid: str) -> list[dict]:
  refs = []
  -- orders: items array
  -- reviews, downloads, analytics: where("productId", "==", pid)
  -- customer collections: wishlist, favorites, bookmarks, recommendations
  RETURN refs
```


---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach:

1. **Exploratory (pre-fix):** Write tests that run against the current unfixed
   `sync_product_to_firestore`. These tests are expected to fail and surface the
   exact defect. They confirm (or refute) our root-cause hypotheses before we change
   any production code.
2. **Fix + Preservation checking (post-fix):** After the fix is applied, the same
   tests must pass. Preservation tests verify that behaviors outside the bug condition
   are identical before and after the fix.

### Exploratory Bug Condition Checking

**Goal:** Surface counterexamples that demonstrate each defect on the UNFIXED code.
Confirm root-cause hypotheses. If any test passes unexpectedly (bug not reproduced),
re-examine the hypothesis before proceeding.

**Test Plan:** Mock the Firestore `db` object to capture the dict passed to `set()`.
Run `sync_product_to_firestore` with a product fixture and assert on the captured dict.

**Test Cases (all expected to FAIL on unfixed code):**

1. **updatedAt skew:** Product with `updated_at = datetime(2024, 6, 1, tzinfo=utc)`.
   Assert `captured["updatedAt"] == "2024-06-01T00:00:00Z"`.
   *Will fail* — unfixed code writes current wall-clock time.

2. **product_id absent:** Assert `"product_id" in captured`.
   *Will fail* — unfixed code never writes this key.

3. **file_url absent:** Product with `file_url = "https://pcloud.example.com/dl/x"`.
   Assert `captured["file_url"] == "https://pcloud.example.com/dl/x"` and
   `captured["fileUrl"] == "https://pcloud.example.com/dl/x"`.
   *Will fail* — neither key is written.

4. **review_count absent:** Assert `"review_count" in captured`.
   *Will fail* — only `"reviews"` key is written.

5. **creatorAvatar hardcoded:** Assert `"unsplash.com" not in (captured.get("creatorAvatar") or "")`.
   *Will fail* — hardcoded Unsplash URL is always written.

6. **delete no-op referential check:** Patch Firestore to have an order referencing
   product_id=7. Call unfixed `delete_product_from_firestore(7)`. Assert
   Firestore delete was NOT called.
   *Will fail* — unfixed code deletes unconditionally.

**Expected Counterexamples:**
- `updatedAt` does not match `product.updated_at.isoformat() + "Z"` — confirms Defect 1.
- `product_id` key is absent — confirms Defect 2.
- `file_url` / `fileUrl` keys absent — confirms Defect 3.
- `review_count` key absent — confirms Defect 4.
- `creatorAvatar` contains "unsplash.com" — confirms Defect 5.
- Firestore document deleted despite active order reference — confirms Defect 6.


### Fix Checking

**Goal:** For all inputs where the bug condition holds, the fixed function produces the
expected behavior (Properties 1–6, 10–12).

**Pseudocode:**

```
FOR ALL product p WHERE isBugCondition(p, "sync") DO
  captured_doc = call fixed sync_product_to_firestore(p) with mocked Firestore
  ASSERT captured_doc["updatedAt"] == p.updated_at.isoformat() + "Z"  -- when not None
  ASSERT captured_doc["product_id"] == int(p.id)
  ASSERT captured_doc["file_url"]   == p.file_url or None
  ASSERT captured_doc["fileUrl"]    == p.file_url or None
  ASSERT captured_doc["review_count"] == int(p.reviews or 0)
  ASSERT "unsplash.com" NOT IN (captured_doc.get("creatorAvatar") or "")
END FOR

FOR ALL product_id WHERE references_exist DO
  result = call fixed delete_product_from_firestore(product_id)
  ASSERT result["blocked"] == True
  ASSERT len(result["references"]) > 0
  ASSERT Firestore delete NOT called
END FOR
```

### Preservation Checking

**Goal:** For all inputs where the bug condition does NOT hold, the fixed function
produces the same result as the original (Properties 7–9, 13).

**Pseudocode:**

```
FOR ALL product p WHERE NOT isBugCondition(p, "sync") DO
  original_doc = call ORIGINAL sync_product_to_firestore(p)
  fixed_doc    = call FIXED    sync_product_to_firestore(p)
  -- Fields outside the seven defects must be identical
  FOR field IN PRESERVED_FIELDS:
    ASSERT original_doc[field] == fixed_doc[field]
END FOR

FOR ALL N >= 1, product p DO
  call fixed sync_product_to_firestore(p) N times
  ASSERT Firestore set() called exactly N times (merge=True each time)
  ASSERT final document == expected_payload(p)   -- no duplicates, no extra keys
END FOR
```

**Testing Approach:** Property-based testing is recommended for preservation checking
because it exercises the full range of product configurations (nullable fields, empty
lists, long strings, zero prices, etc.) and is more thorough than a fixed set of
hand-written examples.

**Test Cases:**

1. **Thumbnail chain preservation:** Generate products with all 8 combinations of
   `thumbnail` (set/unset, Unsplash/real), `image_urls` (empty/non-empty),
   `preview_images` (empty/non-empty). Verify the fixed implementation resolves
   `thumbnail` identically to the original.

2. **pCloud dual-key preservation:** For any product with `pcloud_download_link` set,
   verify both `pcloud_download_link` and `pcloudDownloadLink` are written with the
   same value.

3. **Idempotency:** Call `sync_product_to_firestore(p)` 3 times with identical data;
   verify the captured payload is identical each time and there is still only one
   document path targeted.

4. **Firestore unavailable no-op:** Set `firebase_connected = False`. Call
   `sync_product_to_firestore(p)`. Verify no exception is raised and no Firestore
   call is made.

5. **Cleanup SQLite integrity:** Run cleanup script against a mock Firestore with
   5 seed candidates and a mock SQLite. Verify zero SQL writes occur.


### Unit Tests

- `test_updated_at_uses_product_timestamp` — product with `updated_at` set; assert
  Firestore `updatedAt` matches.
- `test_updated_at_fallback_when_none` — product with `updated_at = None`; assert
  Firestore `updatedAt` is a valid ISO-8601 string (not the product timestamp).
- `test_product_id_integer_field` — assert `product_id` in captured doc equals `p.id`.
- `test_file_url_written_when_set` — assert both `file_url` and `fileUrl` present and
  correct.
- `test_file_url_written_as_none_when_absent` — assert both keys present and `None`.
- `test_review_count_dual_key` — assert `review_count` equals `reviews`.
- `test_creator_avatar_no_unsplash` — any product, assert `creatorAvatar` never
  contains `"unsplash.com"`.
- `test_delete_blocked_when_order_reference_exists` — mock orders collection with
  matching item; assert `blocked == True` and delete not called.
- `test_delete_blocked_when_review_reference_exists` — same for reviews collection.
- `test_delete_blocked_when_download_reference_exists` — same for downloads.
- `test_delete_succeeds_when_no_references` — no matching docs; assert
  `blocked == False` and delete called once.
- `test_delete_returns_firestore_unavailable` — `firebase_connected = False`; assert
  structured return without calling Firestore.
- `test_patch_status_endpoint_200` — valid `{"status": "published"}`; assert 200 and
  Firestore sync called.
- `test_patch_status_endpoint_404` — non-existent product_id; assert 404.
- `test_patch_featured_endpoint_200` — valid `{"featured": true}`; assert 200 and
  Firestore sync called.
- `test_patch_featured_endpoint_404` — non-existent product_id; assert 404.
- `test_cleanup_signal_detection_two_signals` — doc with Unsplash thumbnail + generic
  title; assert flagged.
- `test_cleanup_signal_detection_one_signal` — doc with only Unsplash thumbnail; assert
  not flagged.
- `test_cleanup_recency_protection` — candidate created 5 days ago; assert not deleted.
- `test_cleanup_blocked_by_order_reference` — candidate with matching order; assert
  blocked, not deleted.
- `test_cleanup_no_sqlite_writes` — run cleanup; assert SQLite session never called
  with add/delete/commit.

### Property-Based Tests

- **Property 1 (PBT):** Generate arbitrary `updated_at` datetime values; assert
  `updatedAt` in captured doc always equals `updated_at.isoformat() + "Z"`.
- **Property 2 (PBT):** Generate arbitrary product `id` integers; assert `product_id`
  in captured doc always equals the integer.
- **Property 3 (PBT):** Generate arbitrary `file_url` strings (including None, empty,
  long URLs); assert `file_url` and `fileUrl` always written correctly.
- **Property 4 (PBT):** Generate arbitrary `reviews` values (0, None, positive int);
  assert `review_count == reviews` always.
- **Property 5 (PBT):** Generate arbitrary `creator_avatar` values (including
  Unsplash-like URLs, real URLs, None); assert `creatorAvatar` never contains
  `"unsplash.com"`.
- **Property 7 (PBT):** Generate N ∈ [1, 10] sync calls with the same product;
  assert the captured payload is identical across all calls (idempotency).
- **Property 8 (PBT):** Generate arbitrary `pcloud_download_link` strings; assert
  both `pcloud_download_link` and `pcloudDownloadLink` in captured doc always equal
  the input.
- **Property 9 (PBT):** Generate all combinations of thumbnail/image_urls/
  preview_images field presence and Unsplash-vs-real URLs; assert thumbnail resolution
  follows the documented priority chain.
- **Property 10 (PBT):** Generate product documents with 0, 1, 2, 3, 4, 5 signals
  set; assert flagged iff signal count ≥ 2.
- **Property 11 (PBT):** Generate `createdAt` values spanning −90 to +1 days relative
  to run date; assert products with ≤ 29 days age are never deleted.
- **Property 12 (PBT):** Generate candidates with random reference sets across five
  collections; assert any non-empty reference set blocks deletion.
- **Property 13 (PBT):** Generate Firestore collections with N seed candidates; run
  cleanup; assert SQLite mock records exactly 0 write operations.

### Integration Tests

- **End-to-end product create → Firestore verify:** POST a product via the API, read
  back the Firestore document, assert all seven fixed fields are correct.
- **End-to-end product update → Firestore verify:** PUT a product update, assert
  `updatedAt` in Firestore matches the SQLite `updated_at`.
- **Status PATCH → Firestore verify:** PATCH status, read Firestore doc, assert
  `status` field updated and all other fields preserved.
- **Featured PATCH → Firestore verify:** PATCH featured, read Firestore doc, assert
  `featured`/`isFeatured` updated.
- **Delete with active reference → 204 + Firestore undeleted:** DELETE a product that
  has an order reference; assert HTTP 204 (SQLite delete succeeds), Firestore document
  still exists, and server log contains a warning.
- **Cleanup dry-run:** Run cleanup script in dry-run mode against a seeded Firestore
  collection; assert no documents are deleted, report lists correct candidates.
- **Cleanup live run:** Run cleanup script (live) against a test Firestore project;
  assert qualifying mock documents are deleted and production-like documents survive.

