# Requirements Document

## Introduction

This document captures all bug fixes and correctness restorations for the Lumora digital
marketplace admin RC (release candidate) console. An architectural audit of the codebase
identified 13 distinct issues spanning authentication, data synchronisation, authorisation,
dead code, and analytics integrity. Issues are grouped by severity: Critical (P1), High (P2),
Medium (P3), and Low (P4).

The system is a hybrid FastAPI + Firestore + SQLite digital marketplace. The admin console
depends on a backend JWT issued by `POST /admin/auth/login` and reads order, vendor, affiliate,
and platform data from both SQLite (via FastAPI) and Firestore (via real-time listeners). Any
break in the chain between these layers renders entire admin pages non-functional.

---

## Glossary

- **Admin_Console**: The React front-end admin portal served at `/admin/*`.
- **AuthContext**: `frontend/src/context/AuthContext.jsx` — the global React auth provider.
- **Admin_Auth_Service**: `backend/admin/routes/auth.py` — the `POST /admin/auth/login` endpoint that verifies a Firebase ID token and returns a signed Lumora JWT.
- **Admin_JWT**: A signed JSON Web Token issued by `Admin_Auth_Service`, required by every FastAPI admin endpoint.
- **Firebase_ID_Token**: A short-lived credential issued by Firebase Authentication after the user signs in client-side.
- **Firebase_UID**: The immutable string identifier that Firebase Authentication assigns to each user account (e.g., `"abc123XYZ"`). This is distinct from the SQLite `users.id` integer.
- **SQLite_ID**: The auto-incremented integer primary key `users.id` in the SQLite database.
- **Firestore**: Google Cloud Firestore — the real-time document database used for orders, platform settings, vendor/affiliate status flags, and analytics collections.
- **Orders_Collection**: The Firestore `orders` collection consumed by Admin Dashboard, Analytics, Orders Management, and Payments pages.
- **require_admin_role**: FastAPI dependency in `backend/admin/validators/admin_auth.py` that decodes the Admin_JWT and verifies the user has `role = "admin"` in SQLite.
- **PurchaseService**: `backend/app/services/purchase_service.py` — orchestrates SQLite order creation.
- **settingsService**: `frontend/src/services/settingsService.js` — previously wrote platform settings directly to Firestore, bypassing FastAPI auth checks.
- **platformService**: `frontend/src/pages/admin/platform/platformService.js` — correctly calls FastAPI for platform pause/resume.
- **ecosystemService**: `frontend/src/services/ecosystemService.js` — client-side post-purchase service that writes to Firestore (affiliate conversions, vendor stats, etc.).
- **affiliateService**: `frontend/src/services/affiliateService.js` — client-side service for affiliate payout requests.
- **AuditLog**: The SQLite `audit_logs` table and `backend/app/models/audit_log.py` model that persists all admin action records.
- **_insert_audit_log**: Helper function in `backend/admin/routes/auth.py` that writes an `AuditLog` row and immediately commits.
- **verify_vendor_active**: FastAPI dependency in `backend/admin/validators/status_checks.py` that checks vendor status in both SQLite and Firestore.
- **verify_affiliate_active**: FastAPI dependency in `backend/admin/validators/status_checks.py` that checks affiliate status in both SQLite and Firestore.
- **backendFetch**: `frontend/src/utils/api.js` utility that attaches the Admin_JWT `Authorization: Bearer` header to every request.
- **Platform_Pause**: A global operational flag (`platformSettings/global.isPlatformPaused` in Firestore) that stops customer checkout when active.

---

## Requirements

---

## CRITICAL (P1) — System-Breaking Issues

---

### Requirement 1: Restore Real Admin Authentication

**User Story:** As a platform administrator, I want my login credentials to be verified by the real backend authentication system, so that all admin API endpoints are accessible and my actions are properly secured and audited.

#### Acceptance Criteria

1. WHEN an admin submits valid credentials on the admin login page, THE Admin_Console SHALL obtain a Firebase ID token from Firebase Authentication and exchange it for an Admin_JWT by calling `POST /admin/auth/login`.
2. WHEN `POST /admin/auth/login` returns a valid Admin_JWT, THE Admin_Console SHALL store the token using the existing `clearBackendToken` / `adminLogin` flow and set `lumora_active_role` to `"admin"` in localStorage.
3. IF `POST /admin/auth/login` returns HTTP 401 or HTTP 403, THEN THE Admin_Console SHALL display an authentication error message and SHALL NOT grant access to any admin page.
4. THE Admin_Console SHALL NOT bypass Firebase Authentication by setting a hardcoded `lumora_mock_user` in localStorage for any email address.
5. WHEN an admin makes any request to a FastAPI admin endpoint, THE Admin_Console SHALL include the Admin_JWT in the `Authorization: Bearer` header via `backendFetch`.
6. WHEN an admin's session is active, THE AuthContext SHALL call `adminRefreshToken` every 60 seconds to refresh the Admin_JWT when it has fewer than 30 minutes remaining.
7. IF the Admin_JWT refresh fails, THEN THE AuthContext SHALL sign out the admin from Firebase and redirect to `/admin/login`.
8. THE Admin_Auth_Service SHALL log `admin_login_success` to the AuditLog upon successful authentication and `admin_login_failure` with a reason upon any rejection.

**Correctness Properties:**

- **Round-trip authentication**: FOR ALL valid Firebase ID tokens belonging to an admin-role SQLite user, calling `POST /admin/auth/login` with the token SHALL return an Admin_JWT that `require_admin_role` accepts on a subsequent protected request.
- **No bypass invariant**: FOR ALL email addresses including `admin@lumora.co` and `admin@gmail.com`, THE AuthContext SHALL NOT set any auth state without a successful Firebase sign-in AND a valid Admin_JWT from the backend.
- **Audit completeness**: FOR EVERY admin login attempt (success or failure), exactly one AuditLog row SHALL be written before the HTTP response is returned.

---

### Requirement 2: Synchronise Orders to Firestore on Creation

**User Story:** As a platform administrator, I want every customer order to appear in the Firestore `orders` collection immediately after purchase, so that the Dashboard, Analytics, Orders Management, and Payments pages display real data.

#### Acceptance Criteria

1. WHEN `POST /api/orders/` successfully commits an order to SQLite, THE Orders_Service SHALL call `sync_order_to_firestore()` to write the order to the Firestore `orders` collection within the same request lifecycle.
2. THE Firestore order document SHALL include at minimum: `orderId`, `userId`, `vendorId`, `items`, `totalAmount`, `status`, `paymentMethod`, `createdAt`, matching the schema expected by Admin Dashboard, Analytics, Orders Management, and Payments pages.
3. IF the Firestore sync call fails (network error, permission denied), THEN THE Orders_Service SHALL log the error and SHALL NOT roll back the SQLite order — the SQLite record is the source of truth and SHALL be preserved.
4. WHILE the Firestore sync fails, THE Orders_Service SHALL retry the sync asynchronously so that the order appears in Firestore eventually.
5. WHERE payment idempotency is active (duplicate `payment_id` submission), THE Orders_Service SHALL return the existing SQLite order and SHALL NOT create a duplicate Firestore document.
6. THE Admin Dashboard, Analytics, Orders Management, and Payments pages SHALL reflect newly created orders without requiring a manual page refresh.

**Correctness Properties:**

- **Write consistency**: FOR ALL orders successfully inserted into SQLite, a corresponding document SHALL exist in the Firestore `orders` collection with the same `orderId` and `totalAmount`.
- **Idempotency**: FOR ALL duplicate `payment_id` submissions, the Firestore `orders` collection SHALL contain exactly one document per payment — calling `sync_order_to_firestore()` twice with the same order SHALL produce the same single Firestore document (upsert semantics).
- **No data loss on sync failure**: FOR ALL SQLite commit successes, the order record SHALL remain in SQLite regardless of the outcome of the Firestore sync call.

---

### Requirement 3: Synchronise Order Status Updates Back to SQLite

**User Story:** As a platform administrator, I want order status changes made through the admin panel to be persisted in SQLite as well as Firestore, so that all system components share a consistent view of order state.

#### Acceptance Criteria

1. WHEN an admin calls `PUT /admin/orders/{id}/status` to update an order's status, THE Orders_Admin_Service SHALL update the `orders.status` field in SQLite after updating Firestore.
2. THE SQLite update and the Firestore update SHALL both succeed before the endpoint returns HTTP 200 to the caller.
3. IF the SQLite update fails after the Firestore update has succeeded, THEN THE Orders_Admin_Service SHALL return HTTP 500 and log the inconsistency so that it can be reconciled.
4. WHEN an order status is updated, THE Orders_Admin_Service SHALL write an `order_status_change` entry to the AuditLog including the `order_id`, old status, and new status in `metadata_json`.
5. WHEN an admin views an order in the Orders Management page after a status update, THE Admin_Console SHALL display the updated status from the FastAPI response.

**Correctness Properties:**

- **Bidirectional consistency**: FOR ALL status updates applied through `PUT /admin/orders/{id}/status`, the value of `orders.status` in SQLite SHALL equal the value of the `status` field in the corresponding Firestore `orders` document after the endpoint returns 200.
- **Audit trail completeness**: FOR EVERY successful order status change, exactly one AuditLog row with `action = "order_status_change"` SHALL be present in the `audit_logs` table.

---

## HIGH (P2) — Security and Integration Bypass Issues

---

### Requirement 4: Secure All Admin Payment Endpoints

**User Story:** As a security engineer, I want every admin payment endpoint to require a valid Admin_JWT with admin role, so that vendor payouts cannot be triggered by unauthenticated or unauthorised callers.

#### Acceptance Criteria

1. THE Payments_Admin_Router SHALL apply the `require_admin_role` dependency to `POST /admin/payments/payout` and to every other endpoint defined in the payments admin router.
2. WHEN an unauthenticated request (no `Authorization` header) is sent to `POST /admin/payments/payout`, THE Payments_Admin_Router SHALL return HTTP 401 Unauthorized.
3. WHEN a request with a valid non-admin JWT (e.g., a vendor or customer token) is sent to `POST /admin/payments/payout`, THE Payments_Admin_Router SHALL return HTTP 403 Forbidden.
4. WHEN an authenticated admin calls `POST /admin/payments/payout` with a valid vendor ID and amount, THE Payments_Admin_Router SHALL process the payout and return HTTP 200.
5. THE Admin_Console `triggerVendorPayout` function SHALL continue to use `backendFetch` which attaches the Admin_JWT automatically — no change to the frontend call site is required beyond the backend now enforcing auth.

**Correctness Properties:**

- **Auth enforcement invariant**: FOR ALL HTTP methods and paths under `/admin/payments/`, requests without a valid admin-role JWT SHALL receive HTTP 401 or HTTP 403 — no payout operation SHALL succeed unauthenticated.

---

### Requirement 5: Route Platform Settings Writes Through FastAPI

**User Story:** As a security engineer, I want all platform settings changes to go through the authenticated FastAPI endpoint, so that direct Firestore writes cannot bypass admin authentication and access control.

#### Acceptance Criteria

1. THE settingsService SHALL replace any direct Firestore write to `platformSettings/global` with a `backendFetch` call to `PUT /admin/settings/`.
2. WHEN an admin saves platform settings through the Settings page, THE Admin_Console SHALL call `PUT /admin/settings/` using `backendFetch` with the Admin_JWT attached.
3. IF `PUT /admin/settings/` returns HTTP 401 or HTTP 403, THEN THE Admin_Console SHALL display an error and SHALL NOT update the local settings state.
4. WHEN `PUT /admin/settings/` returns HTTP 200, THE Firestore `platformSettings/global` document SHALL be updated by the backend, and the Settings page SHALL reflect the change via its existing `onSnapshot` listener.
5. THE `POST /admin/settings/pause` and `POST /admin/settings/resume` endpoints in `platformService.js` are already correctly wired through FastAPI and SHALL remain unchanged.

**Correctness Properties:**

- **Single write path**: FOR ALL platform settings updates initiated by the Admin_Console, the write SHALL pass through FastAPI `PUT /admin/settings/` — direct Firestore writes from the browser to `platformSettings/global` SHALL NOT occur.

---

### Requirement 6: Move Affiliate Commission Calculation to the Backend

**User Story:** As a marketplace operator, I want affiliate commission records to be created server-side via FastAPI, so that commission rates cannot be manipulated client-side and all commissions are validated before being stored.

#### Acceptance Criteria

1. WHEN a customer completes a purchase that includes an affiliate referral code, THE ecosystemService SHALL call `POST /api/affiliate/commissions` via `backendFetch` instead of writing an `affiliateConversions` document directly to Firestore.
2. THE FastAPI `POST /api/affiliate/commissions` endpoint SHALL validate the affiliate code, apply the server-side commission rate, and write the `affiliateConversions` record to Firestore.
3. IF `POST /api/affiliate/commissions` returns an error, THEN THE ecosystemService SHALL log the error but SHALL NOT block the customer's post-purchase flow.
4. THE commission rate used for calculation SHALL be the rate stored in the backend for the affiliate, not a hardcoded client-side constant.
5. WHEN an affiliate commission is created, THE Admin_Console affiliate transaction views SHALL reflect the new commission record sourced from Firestore.

**Correctness Properties:**

- **Server-side rate integrity**: FOR ALL affiliate commissions created through `POST /api/affiliate/commissions`, the stored commission amount SHALL equal `order_total × backend_commission_rate` — no commission SHALL reflect a client-supplied rate.

---

### Requirement 7: Route Affiliate Payout Requests Through FastAPI

**User Story:** As a marketplace operator, I want affiliate payout requests to be submitted through the authenticated FastAPI endpoint, so that payout requests are validated and auditable.

#### Acceptance Criteria

1. WHEN an affiliate submits a payout request, THE affiliateService SHALL call `POST /api/affiliate/payouts` via `backendFetch` instead of writing an `affiliatePayoutRequests` document directly to Firestore.
2. THE FastAPI `POST /api/affiliate/payouts` endpoint SHALL validate that the requesting affiliate has sufficient pending commission balance before creating the payout record.
3. IF `POST /api/affiliate/payouts` returns HTTP 400 (insufficient balance or invalid request), THEN THE affiliateService SHALL surface the error message to the user.
4. WHEN a payout request is created through FastAPI, THE resulting Firestore `affiliatePayoutRequests` document SHALL be written by the backend with a server-generated timestamp and validated fields.

**Correctness Properties:**

- **Balance invariant**: FOR ALL payout requests submitted through `POST /api/affiliate/payouts`, the requested payout amount SHALL be less than or equal to the affiliate's current `pendingCommission` balance — requests exceeding the balance SHALL be rejected with HTTP 400.

---

## MEDIUM (P3) — Correctness and Maintainability Issues

---

### Requirement 8: Fix Vendor Status Check ID Mismatch

**User Story:** As a security engineer, I want the vendor status check to use the correct Firebase UID when querying Firestore, so that a vendor with a disabled Firestore status cannot bypass the check due to a mismatched identifier.

#### Acceptance Criteria

1. WHEN `verify_vendor_active` calls `get_vendor_status_from_firestore()`, THE Status_Check_Service SHALL pass the user's `firebase_uid` string (from `User.firebase_uid`) rather than `str(current_user.id)` (the SQLite integer ID).
2. IF `current_user.firebase_uid` is `None` or empty, THEN THE Status_Check_Service SHALL skip the Firestore status check and rely solely on the SQLite `is_active` flag, logging a warning.
3. THE same Firebase UID resolution fix SHALL be applied to `verify_affiliate_active` for its call to `get_affiliate_status_from_firestore()`.
4. WHEN a vendor's Firestore status is `"suspended"`, `"disabled"`, or `"rejected"` and the correct `firebase_uid` is used in the lookup, THE Status_Check_Service SHALL raise a 403 `ACCOUNT_DISABLED` exception.
5. WHEN a vendor's Firestore status is `"active"`, THE Status_Check_Service SHALL allow the request to proceed.

**Correctness Properties:**

- **Consistent identity lookup**: FOR ALL vendors where `User.firebase_uid` is set, `get_vendor_status_from_firestore(user.firebase_uid)` SHALL return the correct Firestore status — a vendor disabled in Firestore SHALL never pass the status check when queried by the correct UID.
- **No false pass on mismatch**: FOR ALL cases where `str(current_user.id) != current_user.firebase_uid`, querying Firestore with `str(current_user.id)` SHALL NOT silently return `"active"` for a user who is actually disabled.

---

### Requirement 9: Remove Dead Code and Consolidate Duplicate Backends

**User Story:** As a developer, I want dead code and unmounted duplicate routes to be removed from the codebase, so that the backend has a single clear source of truth and accidental use of unmounted routes is impossible.

#### Acceptance Criteria

1. THE `admin_controls/vendor/routes.py` file SHALL be deleted or clearly marked as deprecated, as its endpoints are never mounted in `main.py` and its logic is duplicated in `admin/routes/vendors.py`.
2. THE `admin_controls/affiliate/routes.py` file SHALL be deleted or clearly marked as deprecated for the same reason.
3. THE `purchaseService.js` client-side write to the Firestore `purchases` collection SHALL be removed, as it duplicates the SQLite orders table and creates inconsistent parallel records.
4. THE `vendorStats` Firestore collection write in `ecosystemService.js` SHALL be removed, as it is never read by the vendor dashboard (which uses FastAPI `/api/vendors/{id}/stats`).
5. WHEN the above files and writes are removed, THE remaining code under `admin/routes/vendors.py` and `admin/routes/affiliates.py` SHALL continue to function as the sole endpoints for vendor and affiliate management.
6. THE `app/core/database.py` vestigial empty file SHALL be removed to prevent import confusion with the real `app/db/database.py`.

**Correctness Properties:**

- **No duplicate order records**: FOR ALL completed customer purchases, exactly one order record SHALL exist in SQLite — no corresponding `purchases` document SHALL be written to Firestore.
- **Single vendor stats source**: FOR ALL vendor dashboard data fetches, data SHALL originate solely from `GET /api/vendors/{id}/stats` (FastAPI/SQLite) — no `vendorStats` Firestore collection SHALL be consulted or populated.

---

### Requirement 10: Extend Audit Log Coverage to All State-Changing Admin Actions

**User Story:** As a compliance officer, I want every admin action that modifies system state to produce an audit log entry, so that I can reconstruct a complete history of administrative decisions.

#### Acceptance Criteria

1. WHEN an admin enables a vendor via `POST /admin/vendors/{id}/enable`, THE Vendors_Admin_Service SHALL write an AuditLog entry with `action = "vendor_enable"`, `target_type = "vendor"`, and `target_id = str(id)`.
2. WHEN an admin disables a vendor via `POST /admin/vendors/{id}/disable`, THE Vendors_Admin_Service SHALL write an AuditLog entry with `action = "vendor_disable"`.
3. WHEN an admin restricts a vendor via `POST /admin/vendors/{id}/restrict`, THE Vendors_Admin_Service SHALL write an AuditLog entry with `action = "vendor_restrict"`.
4. WHEN an admin enables an affiliate via `POST /admin/affiliates/{id}/enable`, THE Affiliates_Admin_Service SHALL write an AuditLog entry with `action = "affiliate_enable"`, `target_type = "affiliate"`, and `target_id = str(id)`.
5. WHEN an admin disables an affiliate via `POST /admin/affiliates/{id}/disable`, THE Affiliates_Admin_Service SHALL write an AuditLog entry with `action = "affiliate_disable"`.
6. WHEN an admin pauses the platform via `POST /admin/settings/pause`, THE Settings_Admin_Service SHALL write an AuditLog entry with `action = "platform_pause"`.
7. WHEN an admin resumes the platform via `POST /admin/settings/resume`, THE Settings_Admin_Service SHALL write an AuditLog entry with `action = "platform_resume"`.
8. WHEN an admin changes an order's status, THE Orders_Admin_Service SHALL write an AuditLog entry with `action = "order_status_change"` and `metadata_json` containing the old and new status values.
9. WHEN an admin creates a product via `POST /admin/products/`, updates a product via `PUT /admin/products/{id}`, or deletes a product via `DELETE /admin/products/{id}`, THE Products_Admin_Service SHALL write an AuditLog entry with an appropriate action type (`product_created`, `product_updated`, `product_deleted`).
10. WHEN an admin moderates a review, THE Reviews_Admin_Service SHALL write an AuditLog entry with `action = "review_moderated"`.
11. WHEN an admin resolves, rejects, or assigns a report, THE Reports_Admin_Service SHALL write AuditLog entries with `action = "report_resolved"`, `"report_rejected"`, or `"report_assigned"` respectively.
12. WHEN an admin creates or deletes a referral link, THE Referral_Links_Service SHALL write AuditLog entries with `action = "admin_referral_link_created"` or `"admin_referral_link_deleted"`.
13. THE AuditLogs.jsx page SHALL display all the action types defined in the `ACTION_COLORS` map without any "unknown action" fallback for the above action types.
14. IF any AuditLog write fails (database error), THEN THE admin endpoint SHALL still return its success response and log the AuditLog failure separately — the AuditLog write SHALL NOT cause the primary action to fail.

**Correctness Properties:**

- **Audit coverage completeness**: FOR EVERY HTTP endpoint under `/admin/` that modifies state (creates, updates, or deletes a resource), at least one AuditLog row SHALL be written per successful request — an audit query filtered by the expected `action` type SHALL return a non-zero count after performing that action.
- **Audit atomicity**: FOR ALL admin actions that produce an AuditLog entry, the AuditLog row SHALL be committed in the same SQLite session as the primary data change so that either both succeed or neither is written (within the same transaction).
- **Note on existing coverage**: `vendor_enable`, `vendor_disable`, `vendor_restrict`, `affiliate_enable`, and `affiliate_disable` already write `AuditLog` entries per the current `admin/routes/vendors.py` and `admin/routes/affiliates.py` implementations — requirements 1–5 above confirm that existing behaviour SHALL be preserved and NOT removed.

---

## LOW (P4) — Data Quality and Design Clarity Issues

---

### Requirement 11: Remove Fake View Multipliers from Vendor Analytics

**User Story:** As a vendor, I want my analytics page to display only real, measured data, so that I can make accurate business decisions without being misled by fabricated statistics.

#### Acceptance Criteria

1. THE Vendor_Analytics_Page SHALL NOT calculate page views by multiplying order count by any hardcoded constant.
2. WHERE real page view tracking data is unavailable, THE Vendor_Analytics_Page SHALL display a placeholder (e.g., `"—"` or `"Not available"`) rather than a fabricated number.
3. THE Vendor_Analytics_Page SHALL continue to display actual order counts, revenue totals, and product counts sourced from FastAPI endpoints without modification.
4. IF a real page view tracking mechanism is added in a future iteration, THEN THE Vendor_Analytics_Page SHALL display only the backend-provided view count.

---

### Requirement 12: Document Platform Pause Behaviour for Customer Checkout

**User Story:** As a product owner, I want the system's behaviour when the platform is paused to be explicitly documented and implemented as a deliberate policy decision, so that there is no ambiguity about whether customers can check out during a pause.

#### Acceptance Criteria

1. THE `POST /api/orders/` endpoint SHALL implement one of the following explicitly chosen policies:
   - **Option A (current)**: Customer checkout is blocked when the platform is paused — the endpoint reads `platformSettings/global.isPlatformPaused` and returns HTTP 403 `PLATFORM_PAUSED` for non-admin users.
   - **Option B (intentional bypass)**: Customer checkout is intentionally permitted during a platform pause — the platform pause flag affects only the admin-facing UI and vendor operations.
2. THE chosen policy SHALL be documented as an inline code comment in `backend/app/api/orders/routes.py` stating the explicit design decision.
3. WHEN Option A is active and the platform is paused, THE Orders_Service SHALL return HTTP 403 with `code = "PLATFORM_PAUSED"` and the configured `pauseMessage`.
4. WHEN Option A is active and the platform is not paused, THE Orders_Service SHALL process the order normally.

**Note:** The current implementation already reads the platform pause flag and blocks checkout (Option A). This requirement confirms that decision and mandates it be documented explicitly in code.

---

### Requirement 13: Wire Admin Referral Links to ecosystemService Conversion Tracking

**User Story:** As a marketing administrator, I want admin-created referral links to be tracked by the post-purchase ecosystem service, so that campaign conversions are counted and attributable to the correct admin campaign.

#### Acceptance Criteria

1. WHEN a customer completes a purchase with a referral code that matches a document in the Firestore `adminReferralLinks` collection, THE ecosystemService SHALL record the conversion against the admin campaign.
2. THE ecosystemService SHALL check the `adminReferralLinks` collection in addition to the `affiliateLinks` collection when resolving a referral code at checkout.
3. WHEN an admin referral link conversion is recorded, THE conversion SHALL be written to the Firestore `adminAffiliateOrders` collection (already read by `CampaignManager.jsx`).
4. IF no matching document is found in `adminReferralLinks` for a given referral code, THE ecosystemService SHALL fall through to the regular affiliate referral check with no error.
5. THE CampaignManager.jsx page SHALL display conversion counts sourced from `adminAffiliateOrders` without changes — the fix is entirely in `ecosystemService.js`.

---

## Cross-Cutting Requirements

### Requirement 14: Authentication Regression Protection

**User Story:** As a QA engineer, I want the admin authentication flow to have automated test coverage, so that the mock bypass can never be reintroduced by accident.

#### Acceptance Criteria

1. THE Admin_Auth_Service test suite SHALL include a test that verifies a request to any admin-protected endpoint WITHOUT an `Authorization` header returns HTTP 401.
2. THE Admin_Auth_Service test suite SHALL include a test that verifies a request with a valid customer or vendor JWT returns HTTP 403 on admin-only endpoints.
3. THE Admin_Auth_Service test suite SHALL include a test that verifies `POST /admin/auth/login` with a Firebase ID token belonging to an admin user returns a valid JWT and writes an `admin_login_success` AuditLog entry.
4. THE Admin_Auth_Service test suite SHALL include a test that verifies `POST /admin/auth/login` with a Firebase ID token belonging to a non-admin user returns HTTP 403 and writes an `admin_login_failure` AuditLog entry.

**Correctness Properties:**

- **Mock bypass detection**: FOR ALL email strings including known bypass emails (`admin@lumora.co`, `admin@gmail.com`), THE AuthContext login path SHALL NOT result in a non-null `userRole` state unless a real Firebase sign-in AND a successful `POST /admin/auth/login` response have occurred.

### Requirement 15: Order Sync Integrity Under Concurrent Load

**User Story:** As a platform operator, I want order creation and Firestore sync to behave correctly under concurrent submissions, so that duplicate orders are never created and every successful order is eventually reflected in Firestore.

#### Acceptance Criteria

1. THE Orders_Service idempotency check on `payment_id` SHALL prevent duplicate SQLite rows even when the same `payment_id` is submitted concurrently.
2. WHEN two simultaneous requests with the same `payment_id` arrive at `POST /api/orders/`, THE Orders_Service SHALL return the same order in both responses with HTTP 200 or 201 — exactly one SQLite order row SHALL exist.
3. WHEN a Firestore sync fails on order creation, THE backend SHALL expose a mechanism (admin endpoint or background job) to re-sync unsynced orders from SQLite to Firestore.

**Correctness Properties:**

- **Idempotency**: FOR ALL pairs of order creation requests sharing the same `payment_id` and `user_id`, exactly one SQLite `orders` row and exactly one Firestore `orders` document SHALL exist after both requests complete.
- **Eventual Firestore consistency**: FOR ALL orders in SQLite with `status = "completed"`, a corresponding Firestore `orders` document SHALL eventually exist — there SHALL be no permanently orphaned SQLite orders with no Firestore counterpart.
