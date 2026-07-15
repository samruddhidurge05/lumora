# Implementation Plan: Admin RC Console Audit

## Overview

This plan converts all bug fixes from the admin RC audit into discrete coding tasks ordered by
priority tier (P1 → P2 → P3 → P4) with tests wired close to each implementation task. Every task
builds on the previous steps; no code is left hanging or un-integrated.

---

## Tasks

- [x] 1. Product Photo Upload Fix (P1)
  - [x] 1.1 Add `verify_upload_allowed` dependency to `status_checks.py`
    - In `backend/admin/validators/status_checks.py`, add the `verify_upload_allowed` function after `verify_affiliate_active`
    - Admin role → immediate return (bypass all vendor checks)
    - Vendor role → delegate to existing `verify_vendor_active(current_user)` call
    - Any other role → raise `LumoraException(HTTP 403, code="ROLE_REQUIRED")`
    - Import `get_current_user_required` and `LumoraException` are already present; no new imports needed at module level
    - _Requirements: 16_

  - [x] 1.2 Replace `verify_vendor_active` with `verify_upload_allowed` in `upload_router.py`
    - In `backend/app/api/upload_router.py`, update the import: replace `from admin.validators.status_checks import verify_vendor_active` with `from admin.validators.status_checks import verify_upload_allowed`
    - On both `POST /` and `POST /image` endpoint signatures, rename the dependency parameter from `_active = Depends(verify_vendor_active)` to `_allowed = Depends(verify_upload_allowed)`
    - _Requirements: 16_

  - [x] 1.3 Apply `mapAdminProductToApi()` in `ProductForm.handleSubmit` in `ProductsManagement.jsx`
    - In `frontend/src/pages/admin/ProductsManagement.jsx`, locate `ProductForm.handleSubmit()`
    - After building `rawData` (the spread of form state with numeric price and split tags/gallery), add: `const apiPayload = mapAdminProductToApi(rawData);`
    - Replace `onSubmit(readyData)` / `onSubmit(rawData)` with `onSubmit(apiPayload)`
    - `mapAdminProductToApi` is already defined at the top of the file; no new function needed
    - _Requirements: 16_

  - [ ]* 1.4 Write unit tests for `mapAdminProductToApi` field mapping
    - Create `frontend/src/tests/mapAdminProductToApi.test.js`
    - Test 1: `name` → `title`, `name` key absent in result (Property 14)
    - Test 2: all critical admin fields map correctly (`creatorName → seller`, `isFeatured → featured`, `downloadUrl → file_url`, `fileSize → file_size` with "MB" suffix, `status` lowercased, `tagsInput` split to array)
    - Test 3: missing optional fields don't crash; `featured` defaults to `false`
    - _Requirements: 16_

- [x] 2. Order Firestore Sync on Creation (P1)
  - [x] 2.1 Implement `sync_order_to_firestore` in `admin_firestore.py` if not present
    - In `backend/admin/firestore/admin_firestore.py`, add (or verify) the `sync_order_to_firestore(order)` function
    - Document shape: `{ orderId: f"ORD-{order.id}", userId: str(order.user_id), vendorId: items[0].vendor_id if items else "", items: [{productId, productName, price}], totalAmount: float(order.total_amount), status: order.status, paymentMethod: order.payment_method, createdAt: order.created_at.isoformat() }`
    - Use `set(..., merge=True)` keyed on `orderId` for upsert / idempotent semantics
    - _Requirements: 2.1, 2.2, 2.5, 15.1, 15.2_

  - [x] 2.2 Call `sync_order_to_firestore` after `db.commit()` in `orders/routes.py`
    - In `backend/app/api/orders/routes.py`, after the `db.commit()` line in the `POST /` handler, add a best-effort try/except block that imports and calls `sync_order_to_firestore(order)`
    - On exception: log `logger.error("Firestore order sync failed for order %s: %s — order preserved in SQLite", order.id, fs_err)` and continue (do NOT roll back)
    - Add an inline comment documenting the Platform Pause policy (Option A): checkout is blocked when `isPlatformPaused` is true (Requirement 13 / 12 documentation)
    - _Requirements: 2.1, 2.3, 12.2_

- [x] 3. Order Status SQLite Sync (P1)
  - [x] 3.1 Update `PUT /{order_id}/status` in `app/admin_api/orders/routes.py`
    - In `backend/app/admin_api/orders/routes.py`, in the `PUT /{order_id}/status` handler:
      1. Before calling `modify_order_status`, query the SQLite `Order` row and capture `old_status = order.status`
      2. Call `modify_order_status(order_id, status)` (existing Firestore update)
      3. After Firestore success, set `order.status = status` and call `db.commit()`
      4. If `db.commit()` raises, call `db.rollback()`, log the inconsistency (`order_id`, `new_status`), and raise `HTTPException(status_code=500, detail="...")`
      5. In the audit log call (already present or to be added), pass `metadata={"old_status": old_status, "new_status": status}`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Settings Service Security Fix (P2)
  - [x] 4.1 Replace `setDoc` with `backendFetch` in `settingsService.js`
    - In `frontend/src/services/settingsService.js`, rewrite `updatePlatformSetting(key, val)`:
      - Remove the `setDoc(docRef, { [key]: val }, { merge: true })` call
      - Add `import { backendFetch } from '../utils/api';` (or the correct relative path)
      - Replace with `await backendFetch('/admin/settings/', { method: 'PUT', body: JSON.stringify({ [key]: val }) })`
      - Wrap in try/catch; on error log `console.error('[settingsService] Error updating setting via backend:', error)` and rethrow
      - Leave `subscribeToPlatformSettings` and `initPlatformSettings` (read-only functions) completely unchanged
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 4.2 Write unit tests for `settingsService.js` — no direct Firestore writes
    - Create `frontend/src/tests/settingsService.test.js`
    - Mock `backendFetch` and `firebase/firestore.setDoc`
    - Assert `backendFetch` is called with `PUT /admin/settings/` (Property 11)
    - Assert `setDoc` is never called (Property 11)
    - _Requirements: 5.1, 5.2_

- [x] 5. Affiliate Backend Migration (P2)
  - [x] 5.1 Replace `createConversionsForOrder` call with `backendFetch` in `ecosystemService.js`
    - In `frontend/src/services/ecosystemService.js`, in `onPurchaseComplete`, find the step that calls `affiliateService.createConversionsForOrder()` (or equivalent)
    - Replace it with a `safeRun('affiliateCommissions', ...)` block that calls `backendFetch('/api/affiliate/commissions', { method: 'POST', body: JSON.stringify({ affiliate_code: affCode, order_id: orderId, customer_id: uid, items: items.map(...) }) })`
    - Do NOT include `commission_amount` or `commission_rate` in the request body (Property 12)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 5.2 Add `adminReferralLinks` conversion tracking in `ecosystemService.js`
    - After the affiliate commission `safeRun` block added in 5.1, add a second `safeRun('adminReferralConversion', ...)` block
    - Query `adminReferralLinks` collection where `code == affCode`; if found, `addDoc` to `adminAffiliateOrders` with `{ campaignId, code, orderId, customerId, totalAmount, createdAt }`
    - This is additive — runs alongside the affiliate flow, not instead of it
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [x] 5.3 Replace `requestPayout` Firestore write with `backendFetch` in `affiliateService.js`
    - In `frontend/src/services/affiliateService.js`, in `requestPayout(affiliateId, amount)`:
      - Remove `addDoc(collection(db, 'affiliatePayoutRequests'), ...)` call
      - Replace with `return await backendFetch('/api/affiliate/payouts', { method: 'POST', body: JSON.stringify({ affiliate_id: affiliateId, amount }) })`
      - Surface HTTP 400 errors to the caller (do not swallow them)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 6. Checkpoint — Verify P1 and P2 fixes integrate correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Vendor Status ID Fix (P3)
  - [ ] 7.1 Fix `firebase_uid` vs `str(id)` mismatch in `verify_vendor_active` in `status_checks.py`
    - In `backend/admin/validators/status_checks.py`, in `verify_vendor_active`, find the call to `get_vendor_status_from_firestore(str(current_user.id))`
    - Replace argument with `current_user.firebase_uid`
    - Add null-guard: if `current_user.firebase_uid` is `None` or empty string, skip the Firestore check, log a warning (`logger.warning("verify_vendor_active: user %s has no firebase_uid — skipping Firestore status check", current_user.id)`), and set `status_val = None`
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

  - [ ] 7.2 Apply same `firebase_uid` fix to `verify_affiliate_active` in `status_checks.py`
    - In the same file, apply the identical fix to `verify_affiliate_active`: replace `str(current_user.id)` with `current_user.firebase_uid` in the `get_affiliate_status_from_firestore()` call
    - Add same null-guard with warning log
    - _Requirements: 8.3_

- [ ] 8. Dead Code Removal (P3)
  - [ ] 8.1 Delete unmounted `admin_controls/vendor/routes.py`
    - Delete `backend/admin_controls/vendor/routes.py`
    - Verify the file is not imported anywhere in `main.py` or any `__init__.py` before deleting
    - _Requirements: 9.1, 9.5_

  - [ ] 8.2 Delete unmounted `admin_controls/affiliate/routes.py`
    - Delete `backend/admin_controls/affiliate/routes.py`
    - Verify the file is not imported in `main.py` or any `__init__.py`
    - _Requirements: 9.2, 9.5_

  - [ ] 8.3 Delete vestigial `app/core/database.py`
    - Delete `backend/app/core/database.py`
    - Search for any `from app.core.database import` statements across the codebase; if found, update them to use `from app.db.database import` instead
    - _Requirements: 9.6_

  - [ ] 8.4 Remove duplicate `purchases` Firestore write from `purchaseService.js`
    - In `frontend/src/services/purchaseService.js`, in `recordPurchase()`, remove the `addDoc(collection(db, 'purchases'), ...)` call entirely
    - Keep all other logic in the function intact
    - _Requirements: 9.3_

  - [ ] 8.5 Remove `vendorStats` Firestore write from `ecosystemService.js`
    - In `frontend/src/services/ecosystemService.js`, remove the entire `safeRun('vendorStats(${item.id})', ...)` block (Step 3 per the design)
    - _Requirements: 9.4_

- [ ] 9. Audit Log Coverage Extension (P3)
  - [ ] 9.1 Add audit log calls to product CRUD endpoints in `admin/routes/products.py`
    - In `backend/admin/routes/products.py`, wrap `log_admin_action(...)` calls in try/except with pass (non-blocking) at the end of:
      - `POST /admin/products/` → `action="product_created"`, `target_id=str(product.id)`
      - `PUT /admin/products/{id}` → `action="product_updated"`, `target_id=str(id)`
      - `DELETE /admin/products/{id}` → `action="product_deleted"`, `target_id=str(id)`
    - _Requirements: 10.9, 10.14_

  - [ ] 9.2 Add audit log calls to settings endpoints in `admin/routes/settings.py`
    - In `backend/admin/routes/settings.py`, add non-blocking `log_admin_action` calls:
      - `POST /admin/settings/pause` → `action="platform_pause"`, no target
      - `POST /admin/settings/resume` → `action="platform_resume"`, no target
    - _Requirements: 10.6, 10.7, 10.14_

  - [ ] 9.3 Add audit log call to `PUT /admin/settings/` in `app/admin_api/settings/routes.py`
    - In `backend/app/admin_api/settings/routes.py`, add a non-blocking `log_admin_action` call with `action="settings_updated"` and `metadata={"keys": list(payload.keys())}` (or equivalent changed-key info)
    - _Requirements: 10.14_

  - [ ] 9.4 Add audit log calls to review moderation endpoints in `admin/routes/reviews.py`
    - In `backend/admin/routes/reviews.py`, add a non-blocking `log_admin_action` call with `action="review_moderated"`, `target_type="review"`, and `target_id=str(review_id)` on all moderation state-change routes
    - _Requirements: 10.10, 10.14_

  - [ ] 9.5 Add audit log calls to report endpoints in `admin/routes/reports.py`
    - In `backend/admin/routes/reports.py`, add non-blocking `log_admin_action` calls:
      - Resolve route → `action="report_resolved"`, `target_id=str(report_id)`
      - Reject route → `action="report_rejected"`, `target_id=str(report_id)`
      - Assign route → `action="report_assigned"`, `target_id=str(report_id)`
    - _Requirements: 10.11, 10.14_

  - [ ] 9.6 Add audit log calls to referral link endpoints in `admin/routes/referral_links.py`
    - In `backend/admin/routes/referral_links.py`, add non-blocking `log_admin_action` calls:
      - Create referral link route → `action="admin_referral_link_created"`, `target_id=str(link_id)`
      - Delete referral link route → `action="admin_referral_link_deleted"`, `target_id=str(link_id)`
    - _Requirements: 10.12, 10.14_

  - [ ] 9.7 Extend `ACTION_COLORS` map in `AuditLogs.jsx`
    - In `frontend/src/pages/admin/AuditLogs.jsx`, add entries to the `ACTION_COLORS` (or equivalent color-mapping object) for all new action types:
      `product_created`, `product_updated`, `product_deleted`, `platform_pause`, `platform_resume`, `settings_updated`, `review_moderated`, `report_resolved`, `report_rejected`, `report_assigned`, `admin_referral_link_created`, `admin_referral_link_deleted`
    - _Requirements: 10.13_

- [ ] 10. Checkpoint — Verify P3 fixes and run backend tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Vendor Analytics Data Integrity (P4)
  - [ ] 11.1 Remove fake view multiplier calculations from `Analytics.jsx`
    - In `frontend/src/pages/vendor/Analytics.jsx`:
      - Replace `const storeViews = Math.round(totalOrders * 32.5 + products.length * 18.2 + 85)` with `const storeViews = null; // Real view tracking not yet implemented`
      - Replace the Store Views stat card value with `storeViews !== null ? storeViews : '—'`; set `sub: 'Not yet tracked'` and `delta: null`
      - Set `avgConv = null` when `storeViews` is null; display `'—'` in the Conversion Rate stat card
      - In the 7d / 30d / 3m / 12m period loops, remove `dayViews`, `wViews`, `mViews` multiplier calculations and set `convSeries` values to `0`
    - _Requirements: 11.1, 11.2, 11.3_

- [ ] 12. Admin Referral Links Tracking (P4)
  - _Note: The core `adminReferralLinks` conversion write was implemented as part of task 5.2. This task confirms and validates the integration._
  - [ ] 12.1 Validate `adminReferralLinks` integration end-to-end
    - Confirm the `safeRun('adminReferralConversion', ...)` block added in 5.2 writes correctly to `adminAffiliateOrders` with all required fields (`campaignId`, `code`, `orderId`, `customerId`, `totalAmount`, `createdAt`)
    - Confirm `CampaignManager.jsx` reads from `adminAffiliateOrders` without changes (read-only, no modifications needed)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ] 13. Backend Test Suite
  - [ ] 13.1 Write auth regression tests in `test_admin_auth_regression.py`
    - Create `backend/tests/test_admin_auth_regression.py`
    - `test_no_auth_returns_401`: GET `/admin/orders/` with no header → 401 (Req 14.1)
    - `test_vendor_jwt_returns_403`: GET `/admin/orders/` with vendor JWT → 403 (Req 14.2)
    - `test_admin_login_success_writes_audit_log`: POST `/admin/auth/login` with mock admin Firebase token → 200, `access_token` present, `admin_login_success` AuditLog entry exists (Req 14.3)
    - `test_non_admin_login_failure_writes_audit_log`: POST `/admin/auth/login` with customer token → 403, `admin_login_failure` AuditLog entry exists (Req 14.4)
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [ ] 13.2 Write upload auth enforcement tests in `test_upload_auth.py`
    - Create `backend/tests/test_upload_auth.py`
    - `test_admin_can_upload_file`: admin JWT → POST `/api/uploads/` → 200, `url` in response (Req 16)
    - `test_admin_can_upload_image`: admin JWT → POST `/api/uploads/image` → 200 (Req 16)
    - `test_unauthenticated_upload_rejected`: no JWT → 401
    - `test_customer_upload_rejected`: customer JWT → 403
    - _Requirements: 16_

  - [ ]* 13.3 Write property-based test for order sync idempotency (Property 4)
    - In `backend/tests/` (new or existing property test file), use `hypothesis` with `@given(order=order_strategy())` and `@settings(max_examples=100)`
    - Call `sync_order_to_firestore(order)` twice with the same order against a mock Firestore
    - Assert exactly one document exists in `orders` collection for that `orderId`
    - Tag: `# Feature: admin-rc-console-audit, Property 4: Order sync is idempotent`
    - **Property 4: Order sync is idempotent**
    - **Validates: Requirements 2.5, 15.1, 15.2**

  - [ ]* 13.4 Write property-based test for auth bypass invariant (Property 1)
    - In the same property test file, use `@given(email=st.emails())` / `@given(idToken=st.text(min_size=1, max_size=500))`
    - POST `/admin/auth/login` with any made-up `idToken` must return 401 or 403 (never 200)
    - Tag: `# Feature: admin-rc-console-audit, Property 1: No auth bypass for any email`
    - **Property 1: No auth bypass for any email**
    - **Validates: Requirements 1.4, 14**

  - [ ]* 13.5 Write property-based test for payment endpoint auth enforcement (Property 7)
    - Use `@given(path=st.sampled_from(["/admin/payments/payout", ...]))` to verify every payment path returns 401 or 403 without a valid admin JWT
    - Tag: `# Feature: admin-rc-console-audit, Property 7: All admin payment endpoints reject unauthenticated requests`
    - **Property 7: All admin payment endpoints reject unauthenticated requests**
    - **Validates: Requirement 4**

- [ ] 14. Frontend Test Suite
  - [ ] 14.1 Confirm `mapAdminProductToApi` tests created in task 1.4 pass
    - Run `frontend/src/tests/mapAdminProductToApi.test.js`; fix any failures
    - _Requirements: 16_

  - [ ]* 14.2 Write `settingsService.js` unit tests (Property 11)
    - Confirm `frontend/src/tests/settingsService.test.js` created in task 4.2 passes
    - Run tests; assert `backendFetch` called with `PUT /admin/settings/`, `setDoc` not called
    - **Property 11: Platform settings writes always pass through FastAPI**
    - **Validates: Requirements 5.1, 5.2**

- [ ] 15. Final Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- P1 tasks (1–3) must be completed before P2 tasks (4–5); P2 before P3 (7–9); P3 before P4 (11–12)
- Checkpoints at tasks 6, 10, and 15 validate incremental correctness
- All audit log writes MUST be wrapped in `try/except: pass` (non-blocking per Requirement 10.14)
- `sync_order_to_firestore` MUST use `set(..., merge=True)` for idempotency (Property 4)
- The `purchaseService.js` and `ecosystemService.js` changes in task 8 are destructive removals — verify no other callers exist before deleting
- Property-based tests use `hypothesis` (Python) and run 100+ iterations per property
- Frontend tests use Jest; run with `--run` flag for single-pass execution

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2", "3.1"] },
    { "id": 2, "tasks": ["1.4", "4.1", "5.1"] },
    { "id": 3, "tasks": ["4.2", "5.2", "5.3"] },
    { "id": 4, "tasks": ["7.1", "8.1", "8.2", "8.3", "8.4"] },
    { "id": 5, "tasks": ["7.2", "8.5", "9.1", "9.2", "9.3"] },
    { "id": 6, "tasks": ["9.4", "9.5", "9.6", "9.7", "11.1"] },
    { "id": 7, "tasks": ["12.1", "13.1", "13.2"] },
    { "id": 8, "tasks": ["13.3", "13.4", "13.5", "14.1"] },
    { "id": 9, "tasks": ["14.2"] }
  ]
}
```
