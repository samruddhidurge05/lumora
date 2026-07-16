# Implementation Plan

## Overview

This plan implements the Firestore product sync cleanup bugfix following the exploratory bug condition methodology. Tasks 1 and 2 establish the test baseline (exploration and preservation tests) before any production code is modified. Tasks 3–6 apply the six sync field fixes, the delete referential-integrity rewrite, the two new PATCH endpoints, and the standalone cleanup script. Tasks 7–8 fill out the full unit and property-based test suites. Task 9 is the final checkpoint.

## Task Dependency Graph

```json
{
  "waves": [
    {"wave": 1, "tasks": ["1", "2"]},
    {"wave": 2, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5"]},
    {"wave": 3, "tasks": ["3.6", "3.7", "4.1"]},
    {"wave": 4, "tasks": ["4.2", "4.3", "4.4", "5.1"]},
    {"wave": 5, "tasks": ["5.2", "5.3", "6.1"]},
    {"wave": 6, "tasks": ["5.4", "6.2", "6.3"]},
    {"wave": 7, "tasks": ["6.4", "7.1", "7.2", "7.3", "7.4"]},
    {"wave": 8, "tasks": ["8.1", "8.2", "8.3"]},
    {"wave": 9, "tasks": ["9.1", "9.2", "9.3"]}
  ]
}
```

## Tasks

- [x] 1. Write bug condition exploration tests (BEFORE implementing any fix)
  - **Property 1: Bug Condition** - Six Sync Field Defects + Unsafe Delete
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms each bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Surface counterexamples that demonstrate each of the 6 defects
  - Create `backend/tests/test_firestore_sync_bug_condition.py`
  - Mock the Firestore `db` object to capture the dict passed to `set()`
  - **Defect 1 — updatedAt skew:** Build product with `updated_at = datetime(2024, 6, 1, tzinfo=utc)`. Call unfixed `sync_product_to_firestore`. Assert `captured["updatedAt"] == "2024-06-01T00:00:00Z"`. *Expect FAIL — unfixed code writes wall-clock time.*
  - **Defect 2 — product_id absent:** Assert `"product_id" in captured`. *Expect FAIL — key never written.*
  - **Defect 3 — file_url absent:** Build product with `file_url = "https://pcloud.example.com/dl/x"`. Assert `captured["file_url"] == "https://pcloud.example.com/dl/x"` and `captured["fileUrl"]` same. *Expect FAIL — neither key written.*
  - **Defect 4 — review_count absent:** Assert `"review_count" in captured`. *Expect FAIL — only `"reviews"` key written.*
  - **Defect 5 — creatorAvatar hardcoded:** Assert `"unsplash.com" not in (captured.get("creatorAvatar") or "")`. *Expect FAIL — Unsplash URL hardcoded.*
  - **Defect 6 — unsafe delete:** Patch Firestore `orders` with doc referencing product_id=7. Call unfixed `delete_product_from_firestore(7)`. Assert Firestore `delete()` was NOT called. *Expect FAIL — deletes unconditionally.*
  - Run tests on UNFIXED code (`backend/admin/firestore/admin_firestore.py` unchanged)
  - **EXPECTED OUTCOME**: All 6 sub-tests FAIL (this is correct — proves each defect exists)
  - Document the counterexamples found for each defect
  - Mark task complete when tests are written, run, and failures documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Unchanged Sync Behaviors (thumbnail chain, pCloud dual-key, idempotency, Firestore-unavailable no-op)
  - **IMPORTANT**: Follow observation-first methodology — run UNFIXED code with non-buggy inputs and record actual outputs
  - Create `backend/tests/test_firestore_sync_preservation.py`
  - **Observation 1 — thumbnail chain:** Product with `thumbnail = "https://real.cdn.com/img.jpg"` (no unsplash). Observe `captured["thumbnail"] == "https://real.cdn.com/img.jpg"`. Record all 8 combinations of thumbnail/image_urls/preview_images presence.
  - **Observation 2 — pCloud dual-key:** Product with `pcloud_download_link = "https://pcloud.example.com/dl/abc"`. Observe both `pcloud_download_link` and `pcloudDownloadLink` written with same value.
  - **Observation 3 — idempotency:** Call `sync_product_to_firestore(p)` 3 times with identical data. Observe Firestore `set()` called 3 times with `merge=True`, same payload each time.
  - **Observation 4 — Firestore unavailable no-op:** Set `firebase_connected = False`. Call `sync_product_to_firestore(p)`. Observe: no exception raised, no Firestore call made.
  - Write property-based tests capturing these observed behavior patterns
  - Verify ALL tests PASS on UNFIXED code (these behaviors are already correct)
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline preservation behaviors)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7, 3.8, 3.9_

- [x] 3. Fix sync field defects in `sync_product_to_firestore`

  - [x] 3.1 Fix Defect 1 — updatedAt uses product.updated_at instead of wall-clock
    - File: `backend/admin/firestore/admin_firestore.py`
    - Replace `"updatedAt": datetime.now(timezone.utc).isoformat() + "Z"` with conditional:
      `"updatedAt": (product.updated_at.isoformat() + "Z" if product.updated_at else datetime.now(timezone.utc).isoformat() + "Z")`
    - _Bug_Condition: isBugCondition — product.updated_at is not None AND firestoreDoc["updatedAt"] != product.updated_at.isoformat() + "Z"_
    - _Expected_Behavior: updatedAt == product.updated_at.isoformat() + "Z" when product.updated_at is not None_
    - _Preservation: createdAt derivation logic and all other timestamp fields remain unchanged_
    - _Requirements: 1.1_

  - [x] 3.2 Fix Defect 2 — add product_id integer field to Firestore payload
    - File: `backend/admin/firestore/admin_firestore.py`
    - Add `"product_id": int(product.id)` to the `doc_ref.set({...})` payload dict
    - _Bug_Condition: isBugCondition — "product_id" NOT IN firestoreDoc_
    - _Expected_Behavior: product_id == int(product.id) and equals int(str(product.id))_
    - _Requirements: 1.2_

  - [x] 3.3 Fix Defect 3 — add file_url and fileUrl fields to Firestore payload
    - File: `backend/admin/firestore/admin_firestore.py`
    - Add both keys to payload: `"file_url": product.file_url or None, "fileUrl": product.file_url or None`
    - Write `None` when absent so consumers can distinguish "not set" from a missing key
    - Verify existing `pcloud_download_link` / `pcloudDownloadLink` lines are untouched
    - _Bug_Condition: isBugCondition — product.file_url is not None AND ("file_url" NOT IN firestoreDoc OR "fileUrl" NOT IN firestoreDoc)_
    - _Expected_Behavior: both file_url and fileUrl == product.file_url when non-empty, else None_
    - _Preservation: pcloud_download_link and pcloudDownloadLink dual-key convention unchanged_
    - _Requirements: 1.3, 3.7, 3.8_

  - [x] 3.4 Fix Defect 4 — add review_count dual key alongside reviews
    - File: `backend/admin/firestore/admin_firestore.py`
    - Replace `"reviews": int(product.reviews or 0)` with two lines:
      `"reviews": int(product.reviews or 0), "review_count": int(product.reviews or 0)`
    - _Bug_Condition: isBugCondition — "review_count" NOT IN firestoreDoc_
    - _Expected_Behavior: review_count == reviews == int(product.reviews or 0)_
    - _Requirements: 1.4_

  - [x] 3.5 Fix Defect 5 — replace hardcoded Unsplash creatorAvatar with dynamic lookup
    - File: `backend/admin/firestore/admin_firestore.py`
    - Replace the hardcoded Unsplash string with:
      `"creatorAvatar": (product.creator_avatar if getattr(product, "creator_avatar", None) and "unsplash.com" not in product.creator_avatar else None)`
    - When `Product` model has no `creator_avatar` column, `getattr` returns `None` and value becomes `None` (acceptable per AC 11)
    - _Bug_Condition: isBugCondition — "unsplash.com" IN firestoreDoc.get("creatorAvatar", "")_
    - _Expected_Behavior: creatorAvatar does not contain "unsplash.com"; is None when no real avatar available_
    - _Requirements: 1.5_

  - [x] 3.6 Verify bug condition exploration tests now pass after sync fixes
    - **Property 1: Expected Behavior** - Six Sync Field Defects Resolved
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - Run `backend/tests/test_firestore_sync_bug_condition.py` against the fixed code
    - **EXPECTED OUTCOME**: All 6 Defect 1–5 sub-tests PASS (confirms sync defects resolved)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 3.7 Verify preservation tests still pass after sync fixes
    - **Property 2: Preservation** - Unchanged Sync Behaviors
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run `backend/tests/test_firestore_sync_preservation.py`
    - **EXPECTED OUTCOME**: All preservation tests PASS (no regressions in thumbnail chain, pCloud dual-key, idempotency, Firestore-unavailable no-op)
    - _Requirements: 3.2, 3.3, 3.4, 3.7, 3.8, 3.9_

- [x] 4. Fix Defect 6 — replace `delete_product_from_firestore` with referential-integrity-checked version

  - [x] 4.1 Rewrite `delete_product_from_firestore` with structured return and cross-collection checks
    - File: `backend/admin/firestore/admin_firestore.py`
    - Change signature to `def delete_product_from_firestore(product_id: int) -> dict:`
    - Return `{"blocked": True, "reason": "firestore_unavailable", "references": []}` when `firebase_connected is False or db is None`
    - Query `orders` collection: stream all docs, check items array for `productId == str(product_id)`; append `{"collection": "orders", "doc_id": doc.id}` for each match
    - Query `reviews` collection: `.where("productId", "==", pid).stream()`; append matches
    - Query `downloads` collection: `.where("productId", "==", pid).stream()`; append matches
    - If `references` is non-empty: return `{"blocked": True, "references": references}` without deleting
    - If `references` is empty: call `.delete()` then return `{"blocked": False, "references": []}`
    - Wrap body in try/except; on exception log `[firestore-sync] Error deleting product {product_id} from Firestore: {e}` and return `{"blocked": True, "reason": "exception", "references": []}`
    - _Bug_Condition: isBugCondition — call_context == delete AND noReferenceCheckPerformed_
    - _Expected_Behavior: blocked==True with references list when any order/review/download reference found; blocked==False and delete called only when zero references_
    - _Preservation: exception logging pattern unchanged; Firestore-unavailable early-return unchanged_
    - _Requirements: 1.7_

  - [x] 4.2 Update the `DELETE /admin/products/{id}` route handler to log structured result
    - File: `backend/admin/routes/products.py`
    - The route already calls `delete_product_from_firestore(product_id)` after `db.commit()`; capture the return value
    - If `result["blocked"] == True` and `result.get("reason") != "firestore_unavailable"`, emit a warning log: `[firestore-sync] Firestore delete blocked for product {product_id}: {result["references"]}`
    - HTTP response remains `204 No Content` (SQLite deletion already succeeded; Firestore block is a warning, not an error)
    - _Requirements: 1.7, 3.5_

  - [x] 4.3 Verify Defect 6 exploration test now passes
    - **Property 1: Expected Behavior** - Delete Referential Integrity
    - Re-run the delete sub-test from task 1 against fixed code
    - **EXPECTED OUTCOME**: Test PASSES — delete is blocked when order reference exists
    - _Requirements: 1.7_

  - [x] 4.4 Verify preservation tests still pass after delete fix
    - **Property 2: Preservation** - Unchanged behaviors (no-op when Firestore unavailable, etc.)
    - Re-run `backend/tests/test_firestore_sync_preservation.py`
    - **EXPECTED OUTCOME**: All tests PASS
    - _Requirements: 3.5_

- [x] 5. Add PATCH endpoints for status and featured toggling

  - [x] 5.1 Add Pydantic models `StatusPatch` and `FeaturedPatch`
    - File: `backend/admin/routes/products.py`
    - Add at top of file (after existing imports):
      `from pydantic import BaseModel` (if not already imported) and `from typing import Literal`
    - `class StatusPatch(BaseModel): status: Literal["published", "draft"]`
    - `class FeaturedPatch(BaseModel): featured: bool`
    - _Requirements: 1.8_

  - [x] 5.2 Add `PATCH /{product_id}/status` route handler
    - File: `backend/admin/routes/products.py`
    - Add after the existing `PUT /{product_id}` handler
    - Fetch product by id; raise HTTP 404 if not found
    - Set `product.status = body.status`; call `db.commit()`; call `db.refresh(product)`
    - Call `sync_product_to_firestore(product)` after commit
    - Return product (response_model=ProductResponse)
    - Wrap `log_admin_action` call in try/except (matching existing pattern)
    - _Bug_Condition: status toggle re-syncs entire payload; no lightweight path exists_
    - _Expected_Behavior: PATCH updates status in SQLite, syncs to Firestore, returns 200 with updated product; 404 when product not found_
    - _Preservation: existing PUT endpoint behavior and full-update Firestore sync call unchanged_
    - _Requirements: 1.8_

  - [x] 5.3 Add `PATCH /{product_id}/featured` route handler
    - File: `backend/admin/routes/products.py`
    - Add after the `PATCH /{product_id}/status` handler
    - Fetch product by id; raise HTTP 404 if not found
    - Set `product.featured = body.featured`; call `db.commit()`; call `db.refresh(product)`
    - Call `sync_product_to_firestore(product)` after commit
    - Return product (response_model=ProductResponse)
    - Wrap `log_admin_action` call in try/except
    - _Requirements: 1.8_

  - [x] 5.4 Verify PATCH endpoints work and bug condition exploration tests pass
    - **Property 1: Expected Behavior** - Status/Featured PATCH Endpoints
    - Confirm `test_patch_status_endpoint_200` and `test_patch_featured_endpoint_200` (from task 7) pass
    - Confirm `test_patch_status_endpoint_404` and `test_patch_featured_endpoint_404` pass
    - Confirm existing `PUT /admin/products/{id}` tests still pass (no regression)
    - _Requirements: 1.8, 3.1, 3.2_

- [x] 6. Create cleanup script for seeded/mock Firestore products

  - [x] 6.1 Create `backend/scripts/cleanup_firestore_mock_products.py` with signal detection
    - Create the file; import `re`, `datetime`, `timezone`, and the Firestore `db` / `firebase_connected` from `app.shared.firebase.connection`
    - Define `KNOWN_SEED_VENDOR_IDS: set[str]` — populate by scanning repo seed scripts and `products.json` at execution time
    - Implement `evaluate_signals(doc) -> list[str]`:
      - Signal `"unsplash_thumbnail"`: `"unsplash.com" in (data.get("thumbnail") or "")`
      - Signal `"generic_title"`: title/name matches `^(product\s*\d+|test\s+product|sample.*|mock.*|demo.*|seed.*)$` (case-insensitive)
      - Signal `"seed_vendor"`: `data.get("vendor_id") in KNOWN_SEED_VENDOR_IDS`
      - Signal `"lorem_description"`: description matches `(lorem ipsum|this is a sample|generated|placeholder|filler)` (case-insensitive)
      - Signal `"batch_timestamp"`: evaluated as a second pass across all candidates (docs sharing same UTC minute cluster of 3+)
    - _Bug_Condition: isBugCondition — product flagged only if signals >= 2_
    - _Requirements: 2.1_

  - [x] 6.2 Implement recency protection (30-day guard)
    - In `run_cleanup()`: compute `run_date = datetime.now(timezone.utc).date()`
    - For each candidate: parse `data.get("createdAt")`; if `(run_date - created_date).days < 30`, add to `blocked_recent` list and continue (skip to next candidate)
    - Log each skipped product ID with reason "recency_protected"
    - _Bug_Condition: isBugCondition — product with createdAt within 30 days deleted despite seed signals_
    - _Expected_Behavior: no product with createdAt <= 29 days ago is ever deleted_
    - _Requirements: 2.2_

  - [x] 6.3 Implement pre-deletion referential integrity checks for cleanup
    - Implement `check_references(pid: str) -> list[dict]`:
      - Query `orders` collection: stream all docs, check items array for `productId == pid`
      - Query `reviews` collection: `.where("productId", "==", pid).stream()`
      - Query `downloads` collection: `.where("productId", "==", pid).stream()`
      - Query `analytics` collection: `.where("productId", "==", pid).stream()` (or equivalent field)
      - Query customer-facing collections (`wishlist`, `favorites`, `bookmarks`, `recommendations`): `.where("productId", "==", pid).stream()`
      - Return list of `{"collection": name, "doc_id": doc.id}` for all matches
    - If `check_references(candidate_id)` returns non-empty list: add to `blocked_referenced`, do not delete
    - _Bug_Condition: isBugCondition — seed/mock candidate deleted without checking orders/reviews/downloads/analytics/customer collections_
    - _Expected_Behavior: any non-empty reference set blocks deletion with full reference details logged_
    - _Requirements: 2.3_

  - [x] 6.4 Implement deletion execution and report generation
    - Candidates that pass recency guard AND zero references: delete `db.collection("products").document(doc_id).delete()` (when `dry_run=False`)
    - Implement `run_cleanup(dry_run=True)` with `--dry-run` CLI flag (default True for safety)
    - Log each candidate before any deletion: product ID, title/name, and signal list
    - Print final structured report containing:
      a. List of deleted product document IDs
      b. 50 most recent product IDs by `createdAt` descending that were preserved
      c. List of blocked product IDs with blocking reference details
      d. Total document count before and after cleanup
    - Script must NOT import or reference any SQLite session or ORM model
    - _Bug_Condition: cleanup runs without dry-run safety, no report generated, SQLite potentially touched_
    - _Expected_Behavior: dry_run=True by default; comprehensive report always generated; SQLite untouched_
    - _Preservation: zero SQLite rows modified, inserted, or deleted_
    - _Requirements: 2.4, 3.6_

- [x] 7. Write unit tests for all fixes
  - Create `backend/tests/test_firestore_sync_unit.py` (sync function unit tests)
  - Create `backend/tests/test_firestore_delete_unit.py` (delete function unit tests)
  - Create `backend/tests/test_product_patch_endpoints.py` (PATCH endpoint unit tests)
  - Create `backend/tests/test_cleanup_script_unit.py` (cleanup script unit tests)

  - [x] 7.1 Unit tests for `sync_product_to_firestore` fixes
    - `test_updated_at_uses_product_timestamp` — product with `updated_at = datetime(2024,6,1,tzinfo=utc)`; assert `captured["updatedAt"] == "2024-06-01T00:00:00Z"`
    - `test_updated_at_fallback_when_none` — product with `updated_at = None`; assert `captured["updatedAt"]` is a valid ISO-8601 string (not None, not the product timestamp)
    - `test_product_id_integer_field` — assert `captured["product_id"] == p.id` (integer)
    - `test_file_url_written_when_set` — product with `file_url = "https://pcloud.example.com/dl/x"`; assert both `file_url` and `fileUrl` are `"https://pcloud.example.com/dl/x"`
    - `test_file_url_written_as_none_when_absent` — product with `file_url = None`; assert both keys present and equal `None`
    - `test_file_url_written_as_none_when_empty_string` — product with `file_url = ""`; assert both keys `None`
    - `test_review_count_dual_key` — product with `reviews = 17`; assert `captured["review_count"] == 17` and `captured["reviews"] == 17`
    - `test_review_count_zero_when_none` — product with `reviews = None`; assert both keys equal `0`
    - `test_creator_avatar_no_unsplash_when_no_avatar` — product with no `creator_avatar`; assert `captured["creatorAvatar"] is None`
    - `test_creator_avatar_real_url_used` — product with `creator_avatar = "https://real.cdn.com/avatar.jpg"`; assert `captured["creatorAvatar"] == "https://real.cdn.com/avatar.jpg"`
    - `test_creator_avatar_unsplash_filtered_to_none` — product with `creator_avatar = "https://images.unsplash.com/photo-xxx"`; assert `captured["creatorAvatar"] is None`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 7.2 Unit tests for `delete_product_from_firestore` fix
    - `test_delete_returns_firestore_unavailable` — set `firebase_connected = False`; assert returns `{"blocked": True, "reason": "firestore_unavailable", "references": []}` and Firestore `delete()` not called
    - `test_delete_blocked_when_order_reference_exists` — mock orders collection with doc containing items with `productId == "7"`; call `delete_product_from_firestore(7)`; assert `result["blocked"] == True`, `len(result["references"]) > 0`, and `delete()` not called
    - `test_delete_blocked_when_review_reference_exists` — mock reviews collection with matching doc; assert blocked
    - `test_delete_blocked_when_download_reference_exists` — mock downloads collection with matching doc; assert blocked
    - `test_delete_succeeds_when_no_references` — mock all three collections returning empty; assert `result == {"blocked": False, "references": []}` and `delete()` called exactly once
    - `test_delete_returns_multiple_reference_entries` — mock both orders and reviews matching; assert `references` list contains entries for both collections
    - _Requirements: 1.7_

  - [x] 7.3 Unit tests for PATCH endpoints
    - `test_patch_status_endpoint_200` — POST test product, PATCH `{"status": "published"}` to `/admin/products/{id}/status`; assert HTTP 200 and `sync_product_to_firestore` called
    - `test_patch_status_endpoint_draft` — PATCH `{"status": "draft"}`; assert 200 and status field updated
    - `test_patch_status_endpoint_invalid_value` — PATCH `{"status": "pending"}`; assert HTTP 422 (Literal validation)
    - `test_patch_status_endpoint_404` — non-existent product_id; assert HTTP 404
    - `test_patch_featured_endpoint_200` — PATCH `{"featured": true}`; assert HTTP 200 and `sync_product_to_firestore` called
    - `test_patch_featured_endpoint_false` — PATCH `{"featured": false}`; assert 200 and featured field updated
    - `test_patch_featured_endpoint_404` — non-existent product_id; assert HTTP 404
    - `test_put_endpoint_still_syncs_firestore` — PUT full product update; assert `sync_product_to_firestore` still called (no regression)
    - _Requirements: 1.8, 3.1, 3.2_

  - [x] 7.4 Unit tests for cleanup script
    - `test_cleanup_signal_detection_two_signals` — doc with Unsplash thumbnail + generic title (e.g. `"Product 12"`); assert `evaluate_signals(doc)` returns list with 2+ entries and candidate is flagged
    - `test_cleanup_signal_detection_one_signal` — doc with only Unsplash thumbnail, no other signals; assert not flagged (< 2 signals)
    - `test_cleanup_signal_detection_lorem_description` — doc with `description = "lorem ipsum filler"`; assert `"lorem_description"` in signals
    - `test_cleanup_signal_detection_seed_vendor` — doc with `vendor_id` in `KNOWN_SEED_VENDOR_IDS`; assert `"seed_vendor"` in signals
    - `test_cleanup_recency_protection_5_days_old` — candidate with `createdAt` 5 days ago; assert not deleted (even with 3 signals)
    - `test_cleanup_recency_protection_29_days_old` — 29 days ago; assert not deleted
    - `test_cleanup_recency_protection_30_days_old` — exactly 30 days ago; assert eligible for deletion (boundary: < 30 is protected)
    - `test_cleanup_blocked_by_order_reference` — candidate with matching order reference; assert added to `blocked_referenced`, not deleted
    - `test_cleanup_blocked_by_review_reference` — same for reviews
    - `test_cleanup_blocked_by_analytics_reference` — same for analytics collection
    - `test_cleanup_no_sqlite_writes` — run `run_cleanup(dry_run=False)` against mock Firestore with 5 seed candidates; assert no SQLite session is ever instantiated or called
    - `test_cleanup_dry_run_deletes_nothing` — `dry_run=True`; assert Firestore `delete()` never called regardless of eligible candidates
    - `test_cleanup_report_contains_all_sections` — assert final report contains deleted IDs, preserved IDs, blocked IDs, and before/after counts
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.6_

- [x] 8. Write property-based tests
  - Create `backend/tests/test_firestore_sync_pbt.py`
  - Use `hypothesis` library (`from hypothesis import given, strategies as st`)
  - Install `hypothesis` if not already in `requirements.txt`

  - [x] 8.1 PBT for Properties 1–5 (sync field correctness)
    - **Property 1 (PBT):** `@given(updated_at=st.datetimes(timezones=st.just(utc)))` — assert `captured["updatedAt"] == updated_at.isoformat() + "Z"` for all generated datetime values
    - **Property 2 (PBT):** `@given(product_id=st.integers(min_value=1, max_value=10_000_000))` — assert `captured["product_id"] == product_id` always
    - **Property 3 (PBT):** `@given(file_url=st.one_of(st.none(), st.just(""), st.text(min_size=1, max_size=500).filter(lambda s: s.startswith("http"))))` — assert `file_url` and `fileUrl` always written correctly (non-empty value or `None`)
    - **Property 4 (PBT):** `@given(reviews=st.one_of(st.none(), st.integers(min_value=0, max_value=100_000)))` — assert `captured["review_count"] == captured["reviews"] == int(reviews or 0)` always
    - **Property 5 (PBT):** `@given(creator_avatar=st.one_of(st.none(), st.text(min_size=0, max_size=500)))` — assert `"unsplash.com" not in (captured.get("creatorAvatar") or "")` always
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 8.2 PBT for Properties 7–9 (preservation)
    - **Property 7 (PBT) — Idempotency:** `@given(n=st.integers(min_value=1, max_value=10))` — call `sync_product_to_firestore(p)` N times; assert the captured payload dict is identical across all calls and Firestore `set()` called exactly N times
    - **Property 8 (PBT) — pCloud dual-key:** `@given(link=st.one_of(st.none(), st.text(min_size=0, max_size=300)))` — assert `captured["pcloud_download_link"] == captured["pcloudDownloadLink"] == link` for all generated values
    - **Property 9 (PBT) — thumbnail chain:** Generate all 8 combinations of `(thumbnail: real/Unsplash/None) × (image_urls: non-empty/empty) × (preview_images: non-empty/empty)`; assert thumbnail resolution follows documented priority chain unchanged
    - _Requirements: 3.2, 3.3, 3.7, 3.8, 3.9_

  - [x] 8.3 PBT for Properties 10–13 (cleanup correctness)
    - **Property 10 (PBT) — signal threshold:** Generate product docs with 0–5 signals set; assert flagged iff `len(signals) >= 2`
    - **Property 11 (PBT) — recency protection:** `@given(days_ago=st.integers(min_value=0, max_value=89))` — generate `createdAt` at `days_ago` days before run date; assert docs with `days_ago < 30` are NEVER deleted regardless of signals
    - **Property 12 (PBT) — cleanup referential integrity:** `@given(references=st.lists(st.sampled_from(["orders","reviews","downloads","analytics","wishlist"]), min_size=1))` — generate candidates with non-empty reference sets; assert ALL blocked and zero deleted
    - **Property 13 (PBT) — SQLite untouched:** Generate Firestore mock with N seed candidates; run cleanup; assert mock SQLite session records 0 add/delete/commit calls
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.6_

- [x] 9. Checkpoint — Ensure all tests pass and no regressions

  - [x] 9.1 Run full unit and PBT test suites
    - Run: `pytest backend/tests/test_firestore_sync_bug_condition.py backend/tests/test_firestore_sync_preservation.py backend/tests/test_firestore_sync_unit.py backend/tests/test_firestore_delete_unit.py backend/tests/test_product_patch_endpoints.py backend/tests/test_cleanup_script_unit.py backend/tests/test_firestore_sync_pbt.py -v`
    - All tests must PASS
    - No existing tests in other test modules may be broken (run full suite to confirm)
    - Ask the user if any questions arise about failures

  - [x] 9.2 Verify out-of-scope modules are untouched
    - Confirm no changes were made to: `admin_firestore.py` functions other than `sync_product_to_firestore` and `delete_product_from_firestore` (i.e. `sync_order_to_firestore`, `get_platform_settings`, `restore_sqlite_products_from_firestore`, team-management helpers are unchanged)
    - Confirm no changes to auth, RBAC, session management, orders, payments, reviews, analytics, or reports modules
    - _Requirements: 3.7_

  - [x] 9.3 Validate SQLite-first ordering is preserved
    - Confirm `POST /admin/products` still calls `db.commit()` before `sync_product_to_firestore`
    - Confirm `PUT /admin/products/{id}` still calls `db.commit()` before `sync_product_to_firestore`
    - Confirm `DELETE /admin/products/{id}` still calls `db.commit()` before `delete_product_from_firestore`
    - Confirm both new PATCH endpoints call `db.commit()` before `sync_product_to_firestore`
    - _Requirements: 1.6, 3.1, 3.5_

## Notes

- All fixes are in `backend/admin/firestore/admin_firestore.py` and `backend/admin/routes/products.py` only — no other modules are modified.
- The cleanup script `backend/scripts/cleanup_firestore_mock_products.py` is a standalone script with no SQLite dependency.
- Use `hypothesis` for PBT; it must be added to `requirements.txt` if not present.
- Run the cleanup script with `--dry-run` (default) first; pass `--no-dry-run` only after confirming the report looks correct.
- The `DELETE /admin/products/{id}` route always returns HTTP 204 after SQLite deletion; a Firestore block produces a warning log, not an HTTP error.
- PBT tasks in tasks 8.1–8.3 use the `**Property N: Type** - [Title]` format required for hover status tracking.
