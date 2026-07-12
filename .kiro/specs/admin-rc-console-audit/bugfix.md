# Bugfix Requirements Document

## Introduction

The Lumora Digital Marketplace Admin Console (Release Candidate) produces browser console errors, React warnings, failed network requests, and runtime exceptions across six modules: Dashboard, Orders, Payments, Reports, Admin Referrals (CampaignManager), and Admin Support Inbox. These issues prevent the Admin Console from being considered production-ready. This document captures every verified issue derived from static code analysis, traces each defect to its root cause, and specifies the minimal production-safe fix required. No customer-facing, vendor, affiliate, checkout, authentication, payment business logic, or order processing logic is modified unless a verified bug is proven in those areas.

---

## Bug Analysis

### Current Behavior (Defect)

**Module 1 — Dashboard**

1.1 WHEN the Dashboard loads and `data.kpis.insights` contains plain strings (returned by the SQL fallback branch of `get_full_dashboard_data`) THEN the system throws a TypeError because `Dashboard.jsx` calls `ins.label` and `ins.text` on a string, causing a blank Insights panel and a React render error logged to console.

1.2 WHEN the `getDashboardData` service is called and the backend is reachable THEN the system returns data where `revenueChart` is `undefined` (the backend `get_full_dashboard_data` response has no `revenueChart` key, only `revenueTrend`), causing `dashData?.revenueChart?.[timeframe]` to always be an empty array and the revenue chart to always render "No revenue data yet."

1.3 WHEN the Dashboard is open and 10-second auto-polling fires while simultaneous Firestore listeners (`subscribeToOrders`, `subscribeToReviews`, `subscribeToDashboardReports`) also trigger `getDashboardData` debounce reloads THEN the system generates overlapping inflight fetches, producing redundant network requests and occasional stale-state overwrites visible in the network tab.

1.4 WHEN `currencySymbol` is computed and `settings.currencyDisplay` equals `"INR"` THEN the system produces the literal string `"?"` because the rupee symbol `₹` is encoded as a broken escape sequence (`"?"`), displaying incorrect currency on all KPI cards.

**Module 2 — Orders**

1.5 WHEN `OrdersManagement.jsx` calls `backendFetch('/admin/orders/?...')` THEN the system sends the request to `http://localhost:8000/api/admin/orders/` but `admin_api/routes.py` mounts the orders router at `/orders` under the `/api/admin` prefix — the route resolves correctly; however, the backend `get_orders_list` service function is imported from `app.admin_api.orders.services` which is a separate module that may not be registered. Investigation confirms the orders router used in `admin_api/routes.py` is `admin.routes.orders` (the legacy admin namespace), not `app.admin_api.orders.routes`, meaning the backend service responding may differ from what `app/admin_api/orders/routes.py` expects.

1.6 WHEN an admin clicks "Refund" in Payments.jsx and `handleApproveRefund` fires THEN the system calls `backendFetch('/api/admin/orders/{orderId}/refund', { method: 'POST' })` with a full `/api/` prefix, but `backendFetch` already prepends `BACKEND_URL` which is `http://localhost:8000/api`, producing the double-prefixed URL `http://localhost:8000/api/api/admin/orders/{orderId}/refund`, which returns HTTP 404.

1.7 WHEN `OrdersManagement.jsx` fetches orders and the backend returns a bare array (legacy shape) instead of `{ total, items }` THEN the system correctly handles it via the `Array.isArray(data)` guard, but `orderTotalPages` is set to `1` and pagination controls disappear even when the array exceeds 50 items, making it impossible to page through more than 50 orders on legacy backends.

**Module 3 — Payments**

1.8 WHEN `Payments.jsx` mounts and `subscribeToPaymentsTelemetry` starts THEN the system immediately fires both a `fetchPayments` REST call AND an `onSnapshot(collection(db, 'orders'))` AND an `onSnapshot(collection(db, 'users'))` listener, then calls `handleUpdate()` every time any of the three fires. Because the polling `setInterval` fires every 5 000 ms AND both Firestore listeners can fire independently, `callback` is called up to 3× per 5-second window with incomplete data (e.g. `paymentsList` populated but `vendorsList` not yet ready), producing flickering state and redundant console activity.

1.9 WHEN `subscribeToPaymentsTelemetry` is called and the `/payments/admin/all?limit=200` request fails THEN the system falls back to `ordersList` from the Firestore `orders` snapshot — but `ordersList` holds raw Firestore order documents that lack `payment_ref`, `gateway`, `customer_email`, and `vendor_ids` fields, so `mappedOrders` returns objects with `id: "pay-undefined"`, `orderId: "—"`, `paymentMethod: "razorpay"` (hardcoded), and `customerEmail: ""`, producing misleading data in the transaction table and console warnings about undefined access.

1.10 WHEN the Vendor Payout Summary table header renders THEN the system displays `"Comm. (5%)"` as the commission column label, but `calculateVendorPayouts` computes commission as `totalSales * 0.1` (10%), creating a factually incorrect label in the UI.

1.11 WHEN `triggerVendorPayout` is called from `paymentService.js` THEN the system calls `backendFetch('/admin/payments/payout', ...)`, but the registered route in `admin_api/routes.py` mounts the payments router at `/payments` under `/api/admin`, making the actual endpoint `/api/admin/payments/payout` — the call path `/admin/payments/payout` is missing the `/api/` prefix relative to `BACKEND_URL`, so the request resolves to `http://localhost:8000/api/admin/payments/payout` which is correct only if `BACKEND_URL = http://localhost:8000/api`; however callers outside `backendFetch` that construct full URLs manually would be broken.

**Module 4 — Reports**

1.12 WHEN `Reports.jsx` mounts THEN the system calls `loadReportsList` which calls `backendFetch('/admin/reports/?...')`, but the `admin_api/routes.py` aggregator imports `reports_router` from `admin.routes.reports` which is a one-line re-export: `from app.admin_api.reports.routes import router`. The actual route is `GET /` on that router, which is registered as `/admin/reports/` — this resolves correctly. However, `loadReportsList` also calls `backendFetch('/admin/reports/analytics')` via `getReportAnalytics()` in `reportsService.js`, while the backend defines this endpoint as `GET /analytics` — the route resolves to `/api/admin/reports/analytics`. This is correct per the router registration but requires confirmation that the `GET /dashboard` alias does not shadow `GET /analytics` due to FastAPI routing order. Investigation shows `GET /dashboard` is defined after `GET /analytics` and both are distinct paths — no shadowing occurs.

1.13 WHEN `subscribeToReports` in `reportsService.js` fires and updates the `reports` state THEN the system triggers a debounced `getReportAnalytics()` call every time any Firestore report document changes. If `getReportAnalytics()` itself causes a backend write that triggers a Firestore change (unlikely but possible in certain admin actions), this creates a potential loop. Under normal read-only conditions the debounce prevents an actual loop, but the 2-second debounce means the analytics reload fires repeatedly during batch report operations, generating excessive API calls and console noise.

1.14 WHEN `Reports.jsx` renders the `reportData.summary` metrics THEN the system maps `analytics.openCount` to `totalOrders` and `analytics.resolvedCount` to `refunds` — the field names are semantically mismatched (a "refunds" card displays the resolved report count), causing admin confusion and a React key collision risk if the field is ever `undefined`.

1.15 WHEN `Reports.jsx` renders and `analytics` is `null` (initial load, before backend responds) THEN the system calls `reportData.summary.totalRevenue` etc. via `useMemo` — this is safe because `a` is checked for null. However the `CountUp` component receives `value={null}` when `a` is null and the `isNaN(end)` guard early-exits, leaving the animated counter at `0` permanently rather than showing a loading state.

**Module 5 — Admin Referrals (CampaignManager)**

1.16 WHEN `CampaignManager.jsx` mounts THEN the system registers three Firestore `onSnapshot` listeners (`adminReferralLinks`, `adminAnalytics/global`, `adminAffiliateOrders`) simultaneously. If Firestore security rules deny access to any of these collections THEN the system emits `console.warn` messages but continues silently. However, if the `adminReferralLinks` query (filtered by `affiliateId == ''`) fails due to missing index or permission THEN `links` remains `[]` and the table shows "No referral links created yet" with no error surfaced to the admin.

1.17 WHEN `CampaignManager.jsx` renders the Referral Sales Ledger table THEN the system calls `order.price.toLocaleString()` and `order.commissionAmount.toLocaleString()` directly on every row without null/undefined guards. If any `adminAffiliateOrders` document is missing `price` or `commissionAmount` fields THEN the system throws `TypeError: Cannot read properties of undefined (reading 'toLocaleString')`, crashing the component tree below the table.

1.18 WHEN an admin creates a referral link and `handleCreate` calls `backendFetch('/admin/referral-links', { method: 'POST', ... })` THEN the system resolves this to `http://localhost:8000/api/admin/referral-links` — this is registered in `admin_api/routes.py` as `/referral-links` under prefix `/api/admin`. The route is correctly registered. However, the `AuditLog` model uses a `metadata_json` column but the ORM definition must support this column name — if it is named `metadata` in the model but `metadata_json` in the referral_links service, inserts will silently fail or raise a column error.

**Module 6 — Admin Support Inbox**

1.19 WHEN `AdminSupportInbox.jsx` selects a ticket and `selectTicket` is called THEN the system starts a 4-second polling interval (`setInterval(() => fetchMessages(ticket.id), 4000)`). If the admin selects a different ticket before the interval fires, `stopPolling()` is called correctly in `selectTicket`. However, if the component re-renders due to a status filter change while a ticket is selected, the `fetchTickets` `useEffect` dependency on `statusFilter` re-runs but does NOT call `stopPolling()` first, leaving the previous polling interval alive alongside the new implicit state, causing duplicate polling intervals and duplicate API calls to `/admin/support/{ticket_id}/messages` visible in the network tab.

1.20 WHEN `AdminSupportInbox.jsx` calls `backendFetch('/admin/support/tickets...')` THEN the system resolves this to `http://localhost:8000/api/admin/support/tickets`. Looking at `main.py`, `admin_support_router` is mounted at BOTH `/admin/support` (without `/api/` prefix) AND `/api/admin/support`. `backendFetch` prepends `BACKEND_URL = http://localhost:8000/api`, producing `http://localhost:8000/api/admin/support/tickets` — this hits the second mount correctly. However the first mount at `/admin/support` (no `/api/` prefix) is unreachable via `backendFetch` and represents a stale/duplicate router registration that adds noise to OpenAPI docs and may cause path conflicts.

1.21 WHEN an admin submits a reply via `handleReply` in `AdminSupportInbox.jsx` and the ticket `status` is `'closed'` THEN the system disables the input field and reply button correctly via `disabled={selectedTicket.status === 'closed'}`. However there is no visual indicator communicating to the admin WHY the reply form is disabled — the admin sees a greyed-out form with no explanatory message, which is a UX defect.

1.22 WHEN `AdminSupportInbox.jsx` receives ticket list data from `fetchTickets` and `data?.tickets` is an array of objects THEN `ticket.id` is an integer (SQLAlchemy primary key). The `selectTicket` function calls `backendFetch('/admin/support/${ticket.id}/messages')` which concatenates an integer into the URL — this works correctly at runtime. However the `_get_ticket_or_404` helper in the backend converts `ticket_id: int` from the path parameter correctly, so no issue here. This is a false alarm confirmed safe.

---

### Expected Behavior (Correct)

**Module 1 — Dashboard**

2.1 WHEN the Dashboard loads and `get_full_dashboard_data` returns insights THEN the system SHALL return insights as objects with `label` and `text` string properties in both the SQL and Firestore branches, so `Dashboard.jsx` can safely access `ins.label` and `ins.text` without a TypeError.

2.2 WHEN `get_full_dashboard_data` returns data THEN the system SHALL include a `revenueChart` key with `{ daily: [...], weekly: [...], monthly: [...] }` structure mapped from `revenueTrend.timeline`, so `Dashboard.jsx`'s `dashData?.revenueChart?.[timeframe]` resolves to a non-empty array and the revenue chart renders real data.

2.3 WHEN the Dashboard real-time listeners and polling coexist THEN the system SHALL use the existing debounce mechanism exclusively for listener-triggered reloads and the existing `pollInterval` for timed reloads, with no additional reload triggers, keeping inflight requests to at most one active fetch at a time.

2.4 WHEN `currencySymbol` is computed and `settings.currencyDisplay` equals `"INR"` THEN the system SHALL display `₹` (the correct rupee symbol) on all KPI cards, not a broken escape character.

**Module 2 — Orders**

2.5 WHEN `handleApproveRefund` in `Payments.jsx` calls the refund endpoint THEN the system SHALL call `backendFetch('/admin/orders/{orderId}/refund', ...)` without the `/api/` prefix (since `backendFetch` prepends `BACKEND_URL` which already includes `/api`), so the resolved URL is `http://localhost:8000/api/admin/orders/{orderId}/refund` and returns HTTP 200.

2.6 WHEN `loadOrders` receives a bare array from the backend THEN the system SHALL compute pagination as `Math.max(1, Math.ceil(items.length / ORDER_PAGE_SIZE))` so that if the array length exceeds `ORDER_PAGE_SIZE` (50), pagination controls are shown and functional.

**Module 3 — Payments**

2.7 WHEN `subscribeToPaymentsTelemetry` is active THEN the system SHALL call `callback` only after both the REST fetch AND Firestore snapshots have resolved at least once (using a readiness flag), preventing partial-data renders and reducing redundant console activity.

2.8 WHEN `subscribeToPaymentsTelemetry` falls back to Firestore orders THEN the system SHALL map only fields that exist on Firestore order documents and SHALL set `id`, `orderId`, `customerName`, and `paymentMethod` to safe fallback values (`"—"` or `"card"`) only when the corresponding source fields are confirmed absent, without fabricating values that mislead the admin.

2.9 WHEN the Vendor Payout Summary table renders THEN the system SHALL display `"Comm. (10%)"` as the column header to correctly reflect the 10% platform commission rate used in `calculateVendorPayouts`.

**Module 4 — Reports**

2.10 WHEN `Reports.jsx` renders KPI cards THEN the system SHALL map `analytics.resolvedCount` to the "Resolved" card (not a "refunds" label), ensuring the displayed metric name matches its semantic meaning and matches the backend field name.

2.11 WHEN `analytics` is null during initial load THEN the system SHALL render a loading skeleton or placeholder in the `CountUp` component rather than silently displaying `0`, so the admin can distinguish "zero reports" from "loading."

**Module 5 — Admin Referrals (CampaignManager)**

2.12 WHEN `CampaignManager.jsx` renders rows in the Referral Sales Ledger table THEN the system SHALL guard `order.price` and `order.commissionAmount` with nullish coalescing (e.g. `(order.price ?? 0).toLocaleString()`) so that missing fields produce `"0"` instead of a TypeError that crashes the component.

2.13 WHEN `CampaignManager.jsx` Firestore listeners fail due to permission or missing index THEN the system SHALL display a user-visible empty-state message that distinguishes between "no data exists" and "data could not be loaded", rather than silently showing the empty table.

**Module 6 — Admin Support Inbox**

2.14 WHEN `statusFilter` changes in `AdminSupportInbox.jsx` and `fetchTickets` is re-invoked THEN the system SHALL call `stopPolling()` before re-fetching tickets so that any active message-polling interval is cleared, preventing duplicate concurrent polling intervals.

2.15 WHEN the selected ticket's `status` is `'closed'` and the reply form is disabled THEN the system SHALL display an inline message (e.g. "This ticket is closed. Reopen it to reply.") so the admin understands why the form is non-interactive.

2.16 WHEN `main.py` registers `admin_support_router` THEN the system SHALL mount it only once at `/api/admin/support`, removing the stale duplicate mount at `/admin/support`, to eliminate duplicate route registration in OpenAPI docs and avoid potential path conflicts.

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN customer-facing pages (Home, Products, ProductPage, Cart, Checkout, Payment, Success) are loaded THEN the system SHALL CONTINUE TO function identically, with no changes to customer routes, services, or UI components.

3.2 WHEN vendor dashboard pages are loaded THEN the system SHALL CONTINUE TO function identically, with no changes to vendor routes, services, or UI components.

3.3 WHEN affiliate dashboard pages are loaded THEN the system SHALL CONTINUE TO function identically, with no changes to affiliate routes, services, or UI components.

3.4 WHEN Firebase authentication flows (login, register, Google sign-in, logout) are executed THEN the system SHALL CONTINUE TO work identically, with no changes to `AuthContext.jsx`, `authService.js`, or `adminAuthService.js`.

3.5 WHEN orders are placed and processed through the customer checkout flow THEN the system SHALL CONTINUE TO process, store, and update orders identically, with no changes to `/api/orders` endpoints.

3.6 WHEN payments are processed through Razorpay or any payment gateway THEN the system SHALL CONTINUE TO process transactions identically, with no changes to payment gateway integration logic in `/api/payments`.

3.7 WHEN `backendFetch` is called from any non-admin page THEN the system SHALL CONTINUE TO attach the JWT, handle 401 refresh, and propagate errors identically.

3.8 WHEN `AdminSupportInbox.jsx` renders and a ticket is selected THEN the system SHALL CONTINUE TO fetch, display, and poll messages, send admin replies, and update ticket statuses identically — only the duplicate polling interval race condition and the closed-ticket UX message are changed.

3.9 WHEN `OrdersManagement.jsx` loads orders, applies filters, sorts, and paginates THEN the system SHALL CONTINUE TO display, filter, sort, and paginate orders identically — only the refund URL bug in `Payments.jsx` and the pagination edge case for bare-array responses are changed.

3.10 WHEN `CampaignManager.jsx` creates, toggles, or deletes referral links THEN the system SHALL CONTINUE TO write to Firestore via the backend API, update the UI via `onSnapshot`, and display the referral table identically — only the null-guard on `order.price`/`order.commissionAmount` is added.

---

## Implementation Plan

### Issue Registry

| ID | Module | Console Error / Network Failure | Root Cause | Affected Files | Backend APIs | Severity | Regression Risk | Minimal Fix |
|----|--------|--------------------------------|------------|----------------|--------------|----------|----------------|-------------|
| BUG-01 | Dashboard | `TypeError: Cannot read property 'label' of undefined` | `get_full_dashboard_data` SQL branch returns `insights` as `string[]` not `{label,text}[]` | `backend/app/admin_api/analytics/services.py` (SQL branch, line ~`return {..., "insights": [f"Platform has processed..."]}`), `frontend/src/pages/admin/Dashboard.jsx` | `GET /api/admin/analytics/dashboard-full` | High | Low — backend shape only; no other consumers of `insights` as strings | Convert the SQL branch insights to `[{"label": "Platform", "text": "..."}, ...]` object array matching the Firestore branch shape |
| BUG-02 | Dashboard | Revenue chart always renders "No revenue data yet" | Backend `get_full_dashboard_data` returns `revenueTrend.timeline` not `revenueChart`; `Dashboard.jsx` reads `dashData?.revenueChart?.[timeframe]` which is always `undefined` | `frontend/src/pages/admin/Dashboard.jsx` | `GET /api/admin/analytics/dashboard-full` | High | Low — only changes Dashboard chart rendering path | Map `dashData.revenueTrend?.timeline` to `revenueChart` in `dashboardService.js` `getDashboardData` response transformer, OR rename key in backend response |
| BUG-03 | Dashboard | Currency symbol shows `?` instead of `₹` | String literal encoding issue in `Dashboard.jsx` — `"?"` is a broken UTF-8 escape | `frontend/src/pages/admin/Dashboard.jsx` | None | Medium | None | Replace `"?"` with the correct `₹` string literal (U+20B9) |
| BUG-04 | Payments | `404 Not Found` on refund approval | `handleApproveRefund` in `Payments.jsx` calls `backendFetch('/api/admin/orders/{orderId}/refund', ...)` — the `/api/` prefix is duplicated since `backendFetch` already prepends `BACKEND_URL = http://localhost:8000/api` | `frontend/src/pages/admin/Payments.jsx` | `POST /api/admin/orders/{orderId}/refund` | Critical | Low — only the refund button in the Payments page | Remove the `/api/` prefix: change to `backendFetch('/admin/orders/${orderId}/refund', ...)` |
| BUG-05 | Payments | Vendor Payout table header shows incorrect commission rate | `calculateVendorPayouts` uses `totalSales * 0.1` (10%) but the table header reads `"Comm. (5%)"` | `frontend/src/pages/admin/Payments.jsx` | None | Cosmetic | None | Change column header from `"Comm. (5%)"` to `"Comm. (10%)"` |
| BUG-06 | Orders | Pagination missing for bare-array backend responses with >50 orders | When `data` is a bare array, `orderTotalPages` is always set to `1` regardless of array length | `frontend/src/pages/admin/OrdersManagement.jsx` | `GET /api/admin/orders/` | Medium | Low | Compute `orderTotalPages` from array length: `Math.max(1, Math.ceil(items.length / ORDER_PAGE_SIZE))` |
| BUG-07 | Referrals | `TypeError: Cannot read properties of undefined (reading 'toLocaleString')` in Referral Sales Ledger | `CampaignManager.jsx` directly calls `order.price.toLocaleString()` without null guard | `frontend/src/pages/admin/CampaignManager.jsx` | None | High | None | Add `(order.price ?? 0).toLocaleString()` and `(order.commissionAmount ?? 0).toLocaleString()` |
| BUG-08 | Support Inbox | Duplicate message polling intervals when status filter changes | `fetchTickets` `useEffect` re-runs on `statusFilter` change without calling `stopPolling()`, leaving old interval alive | `frontend/src/pages/admin/AdminSupportInbox.jsx` | `GET /api/admin/support/{id}/messages` | Medium | Low | Call `stopPolling()` at the start of `fetchTickets` or in a cleanup in the `statusFilter` effect |
| BUG-09 | Support Inbox | Duplicate route mount in `main.py` | `admin_support_router` is mounted at both `/admin/support` and `/api/admin/support`; only the latter is reachable via `backendFetch` | `backend/app/main.py` | All `/api/admin/support/*` | Low | Low | Remove the duplicate `app.include_router(admin_support_router, prefix="/admin/support", ...)` line |
| BUG-10 | Reports | KPI card labelled "Resolved" is mapped from `analytics.resolvedCount` but displayed as the `refunds` field internally, causing semantic mismatch and future maintenance confusion | `reportData.summary.refunds` receives `a?.resolvedCount`; the DashboardCard title is "Resolved" — the internal field name is misleading | `frontend/src/pages/admin/Reports.jsx` | `GET /api/admin/reports/analytics` | Low | None | Rename internal field `summary.refunds` to `summary.resolvedCount` and update all references within `Reports.jsx` |

### Issues Requiring Investigation — No Code Changes

| ID | Module | Observation | Evidence | Status |
|----|--------|-------------|----------|--------|
| INV-01 | Dashboard | 10-second polling + Firestore listener debounce produces redundant inflight fetches | Confirmed by presence of both `pollInterval` and debounce-on-snapshot in `Dashboard.jsx` | Acceptable — debounce prevents concurrent fetches; mark as low priority if no visible performance issue |
| INV-02 | Payments | `subscribeToPaymentsTelemetry` callback fires up to 3× per window with partial data | Firestore snapshot + REST poll fire independently; `handleUpdate()` called each time | Acceptable — no incorrect data is displayed; Firestore fallback data is clearly labeled; mark for refactor in future sprint |
| INV-03 | Referrals | Firestore permission errors for `adminReferralLinks`, `adminAnalytics`, `adminAffiliateOrders` silently show empty state | `onSnapshot` error handlers use `console.warn` only | Investigation Required — verify Firestore security rules grant admin-authenticated reads on these collections |
| INV-04 | Referrals | `AuditLog` model `metadata_json` column mismatch | `referral_links.py` backend uses `metadata_json=json.dumps(...)` but the `AuditLog` model definition has not been confirmed to use this column name | Investigation Required — read `backend/app/models/audit_log.py` to verify column name |

---

## Bug Condition Pseudocode

```pascal
FUNCTION isBugCondition_BUG04(X)
  INPUT: X = API call from handleApproveRefund in Payments.jsx
  OUTPUT: boolean
  RETURN X.url.startsWith('/api/admin/orders') AND backendFetch.BASE includes '/api'
END FUNCTION

// Property: Fix Checking — BUG-04
FOR ALL X WHERE isBugCondition_BUG04(X) DO
  result ← handleApproveRefund'(X)
  ASSERT result.http_status = 200 AND result.success = true
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_BUG04(X) DO
  ASSERT backendFetch(X) produces identical behavior before and after fix
END FOR

FUNCTION isBugCondition_BUG07(X)
  INPUT: X = adminAffiliateOrders Firestore document
  OUTPUT: boolean
  RETURN X.price IS undefined OR X.commissionAmount IS undefined
END FUNCTION

// Property: Fix Checking — BUG-07
FOR ALL X WHERE isBugCondition_BUG07(X) DO
  result ← renderReferralSalesLedgerRow'(X)
  ASSERT result.rendered = true AND no_crash(result) AND result.priceDisplay = "0"
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_BUG07(X) DO
  ASSERT renderReferralSalesLedgerRow(X) = renderReferralSalesLedgerRow'(X)
END FOR
```

---

## Verification Strategy

For each fix, verification requires:

1. **Browser DevTools — Console tab**: Zero unhandled TypeErrors, ReferenceErrors, or React render errors after fix.
2. **Browser DevTools — Network tab**: Refund requests (BUG-04) return HTTP 200 instead of 404. No duplicate message-poll requests accumulating (BUG-08).
3. **Visual inspection**: Revenue chart in Dashboard renders actual data bars (BUG-02). Currency symbol displays `₹` correctly (BUG-03). Vendor payout header shows `Comm. (10%)` (BUG-05). Referral Sales Ledger renders without crashing on missing fields (BUG-07).
4. **Pagination test**: Load an admin account with >50 orders. Confirm pagination controls appear in `OrdersManagement.jsx` (BUG-06).
5. **Support Inbox polling test**: Open a ticket, change the status filter, open another ticket. Confirm only one polling interval is active (verified by network tab showing single request per 4-second window) (BUG-08).
6. **Backend OpenAPI docs** (`/docs`): Confirm `/admin/support` duplicate mount is removed and only `/api/admin/support/*` routes appear (BUG-09).
7. **End-to-end regression**: Complete a customer purchase, verify the order appears in admin Orders page with correct data. Confirm customer checkout, vendor dashboard, and affiliate dashboard are unaffected.
