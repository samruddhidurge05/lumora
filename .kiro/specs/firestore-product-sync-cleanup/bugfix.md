# Bugfix Requirements Document

## Introduction

The Firestore product synchronization pipeline in the Admin backend has several field-level defects
that cause the Firestore documents to diverge from the SQLite source of truth after product
create/update operations. Additionally, approximately 50 old seeded/mock products occupy Firestore
storage that is approaching its quota limit. This bugfix covers two tightly related concerns:

1. **Sync correctness** — ensure every Admin create/update/delete/status-change writes a complete,
   accurate Firestore document with no stale, hardcoded, or missing fields.
2. **Safe cleanup** — remove only seeded/mock products from Firestore that are not referenced by
   any production workflow, while preserving all real products and all production data.

SQLite remains the canonical source of truth throughout. Firestore is the real-time read layer only.

---

## Glossary

| Term | Definition |
|------|-----------|
| Firestore sync | Writing a SQLite-committed product record to the Firestore `products` collection via `set(..., merge=True)`. |
| Seed/mock product | A Firestore document created by a development seed script, identifiable by at least two signals (see Requirement 2). |
| Referenced product | A product whose Firestore document ID appears in any Firestore `orders`, `reviews`, `downloads`, `analytics`, or customer collection document. |
| Idempotent sync | Calling `sync_product_to_firestore` multiple times with the same product produces the same Firestore document state each time, with no duplicate documents. |

---

## Bug Analysis

### Current Behavior (Defect)

**Part 1 — Sync Field Defects**

1.1 WHEN `sync_product_to_firestore` is called after any product write THEN the system stores `updatedAt` using `datetime.now(timezone.utc)` (wall-clock time of the sync call) instead of `product.updated_at` (the timestamp committed to SQLite), causing Firestore and SQLite to disagree on the last-modified time.

1.2 WHEN `sync_product_to_firestore` is called THEN the system does not include `product_id` (the integer primary key) as an explicit field in the Firestore document, forcing clients to parse the document ID string to obtain the numeric ID.

1.3 WHEN a product has a `file_url` field set in SQLite THEN the system omits `file_url` / `fileUrl` from the Firestore document (only `pcloud_download_link` / `pcloudDownloadLink` are written), leaving the download field absent for consumers that expect the `file_url` key.

1.4 WHEN `sync_product_to_firestore` writes the review count THEN the system stores the value under the key `reviews` only; the key `review_count` is absent, causing clients that query by `review_count` to receive `undefined`/`null`.

1.5 WHEN `sync_product_to_firestore` is called for any product THEN the system writes a hardcoded Unsplash CDN URL as `creatorAvatar` regardless of whether the product or vendor has a real avatar, exposing an external CDN dependency and storing data that does not originate from SQLite.

1.6 WHEN `sync_product_to_firestore` raises an exception THEN the system catches and logs it correctly; however the function is always called after `db.commit()` with no explicit confirmation the commit succeeded, so a caller that bypasses the normal route pattern could invoke sync before the SQLite transaction is durable.

1.7 WHEN `delete_product_from_firestore` is called THEN the system deletes the Firestore document immediately without checking whether the product is referenced in the Firestore `orders`, `reviews`, or `downloads` collections, risking orphaned references in those collections.

1.8 WHEN a product's status is toggled (draft ↔ published) or its `featured` flag is toggled via the `PUT /admin/products/{id}` endpoint THEN the system correctly calls `sync_product_to_firestore`, but there is no dedicated lightweight PATCH endpoint for these single-field changes, meaning every status or featured toggle transmits and reprocesses the entire product payload unnecessarily.

**Part 2 — Firestore Cleanup**

1.9 WHEN the Firestore `products` collection is queried THEN the system contains approximately 50 documents that originate from seed/mock scripts, identifiable by: generic generated names, Unsplash placeholder thumbnail URLs, identical batch-creation timestamps, generated vendor IDs, and generated filler descriptions — these documents consume quota without serving real users.

1.10 WHEN seed/mock products are candidates for deletion THEN the system does not have a safe automated check that cross-references them against Firestore `orders`, `reviews`, `downloads`, `analytics`, and customer collections before removal, meaning manual deletion could inadvertently remove products referenced by real production data.

---

### Expected Behavior (Correct)

---

## Requirement 1: Firestore Product Sync Field Defects

**User Story:** As an Admin, I want every product create/update/delete/status-change to immediately write a complete and accurate Firestore document, so that the Customer Dashboard, Marketplace, and Product pages always reflect the latest SQLite data without any stale, hardcoded, or missing fields.

### Acceptance Criteria

**1.1 — updatedAt correctness**
1. WHEN `sync_product_to_firestore(product)` is called AND `product.updated_at` is not None THEN the Firestore document SHALL contain `updatedAt` equal to `product.updated_at.isoformat() + "Z"`.
2. WHEN `sync_product_to_firestore(product)` is called AND `product.updated_at` is None THEN `updatedAt` SHALL fall back to `datetime.now(timezone.utc).isoformat() + "Z"`.
3. The Firestore `updatedAt` field SHALL NOT be the wall-clock time of the sync call when `product.updated_at` is available.

**1.2 — product_id field**
4. WHEN `sync_product_to_firestore(product)` is called THEN the Firestore document SHALL include `product_id` as an integer field equal to `product.id`.
5. The `product_id` integer field SHALL equal the numeric value of the Firestore document ID (which is `str(product.id)`).

**1.3 — file_url / fileUrl fields**
6. WHEN `product.file_url` is non-None and non-empty THEN the Firestore document SHALL include both `file_url` and `fileUrl` keys set to that value.
7. WHEN `product.file_url` is None or empty THEN both `file_url` and `fileUrl` SHALL be written as `None` (not omitted).
8. The existing `pcloud_download_link` and `pcloudDownloadLink` fields SHALL continue to be written with their current values unchanged.

**1.4 — review_count / reviews dual keys**
9. WHEN `sync_product_to_firestore(product)` is called THEN the Firestore document SHALL contain both `reviews` and `review_count` set to the same integer value: `int(product.reviews or 0)`.

**1.5 — creatorAvatar: no hardcoded Unsplash URL**
10. WHEN `sync_product_to_firestore(product)` is called THEN the Firestore document SHALL NOT contain any URL containing "unsplash.com" as the value of `creatorAvatar`.
11. `creatorAvatar` SHALL be set to a real avatar URL only if one is available from the product or vendor record and that URL is non-None, non-empty, and does not contain "unsplash.com"; otherwise `creatorAvatar` SHALL be `None`.

**1.6 — SQLite commit-first guard**
12. WHEN `sync_product_to_firestore(product)` is called inside a route handler THEN it SHALL only be called after `db.commit()` returns without raising an exception, ensuring SQLite durability precedes any Firestore write.
13. WHEN `sync_product_to_firestore` raises any exception THEN the exception SHALL be caught, a server-side log entry SHALL be written (`[firestore-sync] Error syncing product {id}: {e}`), and the function SHALL return without re-raising so the HTTP response reflects the already-committed SQLite state.
14. WHEN Firestore is unavailable (`firebase_connected is False` or `db is None`) THEN `sync_product_to_firestore` SHALL return immediately (no-op) without raising.

**1.7 — delete referential integrity**
15. WHEN `delete_product_from_firestore(product_id)` is called AND Firestore is unavailable THEN the function SHALL return `{"blocked": True, "reason": "firestore_unavailable", "references": []}` without attempting deletion.
16. WHEN `delete_product_from_firestore(product_id)` is called AND Firestore is available THEN the system SHALL query the Firestore `orders` collection for any document containing an item with `productId == str(product_id)`.
17. WHEN `delete_product_from_firestore(product_id)` is called THEN the system SHALL query the Firestore `reviews` collection for documents where `productId == str(product_id)`.
18. WHEN `delete_product_from_firestore(product_id)` is called THEN the system SHALL query the Firestore `downloads` collection for documents where `productId == str(product_id)`.
19. IF any reference is found in orders, reviews, or downloads THEN the Firestore document SHALL NOT be deleted and the function SHALL return `{"blocked": True, "references": [{"collection": "<name>", "doc_id": "<id>"},...]}`.
20. ONLY IF zero references are found across all checked collections THEN the Firestore document SHALL be deleted and the function SHALL return `{"blocked": False, "references": []}`.

**1.8 — Status/featured PATCH endpoints**
21. WHEN `PATCH /admin/products/{id}/status` is called with a valid `{"status": "published" | "draft"}` THEN the system SHALL update the product `status` in SQLite and immediately call `sync_product_to_firestore`.
22. WHEN `PATCH /admin/products/{id}/status` is called and the product does not exist THEN the system SHALL return HTTP 404.
23. WHEN `PATCH /admin/products/{id}/featured` is called with a valid `{"featured": true | false}` THEN the system SHALL update the `featured` flag in SQLite and immediately call `sync_product_to_firestore`.
24. WHEN `PATCH /admin/products/{id}/featured` is called and the product does not exist THEN the system SHALL return HTTP 404.
25. The existing `PUT /admin/products/{id}` endpoint SHALL continue to trigger `sync_product_to_firestore` for all full-update operations (unchanged behavior).

---

## Requirement 2: Safe Firestore Cleanup of Seeded/Mock Products

**User Story:** As a system operator, I want to safely remove old seeded/mock products from the Firestore `products` collection, so that Firestore storage quota is reduced without deleting any real, recently created, or production-referenced products.

### Acceptance Criteria

**2.1 — Mock product identification**
1. WHEN the cleanup script runs THEN it SHALL fetch all documents from the Firestore `products` collection.
2. A product SHALL be flagged as a seed/mock candidate IF it satisfies at least TWO of the following signals:
   a. `thumbnail` contains "unsplash.com"
   b. `title` or `name` matches the case-insensitive regex `^(product\s*\d+|test\s+product|sample.*|mock.*|demo.*|seed.*)$`
   c. `createdAt` falls within a cluster of 3+ documents sharing the same UTC minute (floor to `YYYY-MM-DDTHH:MM`)
   d. `vendor_id` matches one of the known seed-script vendor IDs (to be determined at execution time by scanning repository seed scripts and `products.json`)
   e. `description` matches the case-insensitive pattern `(lorem ipsum|this is a sample|generated|placeholder|filler)`
3. WHEN the cleanup script runs THEN it SHALL log each candidate product ID, its title/name, and the list of signals that triggered the flag before any deletion.

**2.2 — Recency protection**
4. WHEN a product's `createdAt` is within 30 calendar days (UTC midnight) of the script execution date THEN it SHALL NOT be deleted regardless of how many seed/mock signals it satisfies.

**2.3 — Pre-deletion referential integrity check**
5. WHEN a product is flagged as a seed/mock candidate THEN the script SHALL query the Firestore `orders` collection for any document containing an item with `productId == candidate_id`.
6. WHEN a product is flagged as a seed/mock candidate THEN the script SHALL query the Firestore `reviews` collection for documents where `productId == candidate_id`.
7. WHEN a product is flagged as a seed/mock candidate THEN the script SHALL query the Firestore `downloads` collection for documents where `productId == candidate_id`.
8. WHEN a product is flagged as a seed/mock candidate THEN the script SHALL query the Firestore `analytics` collection for documents referencing `candidate_id`.
9. WHEN a product is flagged as a seed/mock candidate THEN the script SHALL query any customer-facing Firestore collections (wishlist, favorites, bookmarks, recommendations) for references to `candidate_id`.
10. IF any reference is found in any of the above collections THEN the product SHALL be excluded from deletion and added to the "blocked — referenced" section of the cleanup report.

**2.4 — Deletion execution**
11. WHEN a product passes BOTH criteria (identified as seed/mock AND zero live references AND not within the 30-day recency window) THEN the script SHALL delete its Firestore document.
12. WHEN the cleanup completes THEN the script SHALL output a final report containing:
    a. List of deleted product document IDs
    b. The 50 most recent product IDs (by `createdAt` descending) that were preserved
    c. List of blocked product IDs with their blocking reference details
    d. Total document count before and after cleanup
13. WHEN the cleanup runs THEN it SHALL NOT modify the SQLite database in any way.

---

## Requirement 3: Regression Prevention

**User Story:** As a developer, I want existing sync behaviors, authentication, and non-product workflows to remain completely unchanged after this fix, so that no regression is introduced in production.

### Acceptance Criteria

1. WHEN a product is created via `POST /admin/products` THEN the SQLite insert SHALL occur and `db.commit()` SHALL succeed before `sync_product_to_firestore` is called (create-then-sync order preserved).
2. WHEN a product is updated via `PUT /admin/products/{id}` THEN `sync_product_to_firestore` SHALL use `set(..., merge=True)`, maintaining idempotent upsert behavior.
3. WHEN `sync_product_to_firestore` is called N times (N ≥ 1) with identical field values for the same product THEN the Firestore `products` collection SHALL contain exactly one document for that product ID, with field values equal to the input (no duplicate documents created, no extra documents with different IDs).
4. WHEN Firestore is unavailable (`firebase_connected is False` or `db is None`) THEN `sync_product_to_firestore` SHALL return immediately without raising, and the calling route handler SHALL return its normal HTTP response.
5. WHEN a product is deleted via `DELETE /admin/products/{id}` THEN the SQLite `db.delete()` and `db.commit()` SHALL occur before `delete_product_from_firestore` is called (delete-then-remove order preserved).
6. WHEN the Firestore cleanup script executes THEN zero rows SHALL be modified, inserted, or deleted in the SQLite database.
7. WHEN `pcloud_download_link` and `pcloudDownloadLink` are written to Firestore THEN both keys SHALL be present in the document with identical values (dual-key convention preserved).
8. WHEN thumbnail resolution logic executes THEN the priority chain SHALL be: non-Unsplash `product.thumbnail` → `image_urls[0]` (if non-empty) → `preview_images[0]` (if non-empty) → `None`; this chain SHALL NOT change.
9. WHEN admin authentication, RBAC, session management, order, payment, review, analytics, or report workflows execute THEN no code in those modules SHALL be modified by this fix; all tests for those modules SHALL continue to pass without change.

---

### Unchanged Behavior (Regression Prevention — Summary)

3.1 WHEN a product is created via `POST /admin/products` THEN the system SHALL CONTINUE TO commit to SQLite first, then sync to Firestore.

3.2 WHEN a product is updated via `PUT /admin/products/{id}` THEN `sync_product_to_firestore` SHALL CONTINUE TO use `set(..., merge=True)` (idempotent upsert).

3.3 WHEN `sync_product_to_firestore` is called multiple times with identical data THEN repeated calls SHALL produce the same Firestore document state with no duplicates.

3.4 WHEN Firestore is unavailable THEN `sync_product_to_firestore` SHALL CONTINUE TO return immediately without raising.

3.5 WHEN a product is deleted via `DELETE /admin/products/{id}` THEN the system SHALL CONTINUE TO delete from SQLite first, then remove from Firestore.

3.6 WHEN the cleanup removes seed/mock products THEN no SQLite records SHALL be modified.

3.7 WHEN admin authentication, RBAC, session management, orders, payments, reviews, analytics, or reports code executes THEN no behavior SHALL change (these modules are out of scope and SHALL NOT be modified).

3.8 WHEN `pcloud_download_link` / `pcloudDownloadLink` are written to Firestore THEN both naming conventions SHALL continue to be written.

3.9 WHEN thumbnail resolution logic runs THEN the priority chain SHALL remain unchanged.
