# Lumora — Integration Audit
> Complete audit of every page: backend used, Firestore collections, API endpoints,
> context providers, listener status, working/partial/broken status, and required fixes.
> Date: July 2, 2026

---

## Admin Portal

| Page | Firestore | FastAPI | Hybrid | Status | Context/Hook | Real-time Listeners | Required Fixes |
|---|---|---|---|---|---|---|---|
| **Dashboard** | orders, reviews, reports | GET /admin/analytics/dashboard-full | ✅ Hybrid | ⚠️ Partial | dashboardService | 3 onSnapshot (orders, reviews, reports) | Fix order sync (P1-B). Admin auth (P1-A). |
| **ProductsManagement** | products (read) | POST/PUT/DELETE /admin/products/ | ✅ Hybrid | ⚠️ Partial | — | 1 onSnapshot (products) | Admin auth (P1-A). Products show correctly once auth fixed. |
| **Vendors** | users (list by role) | GET /admin/vendors/, PUT /{uid}/status | ✅ Hybrid | ⚠️ Partial (auth broken) | vendorService | — | Admin auth (P1-A). Logic itself is correct. |
| **Analytics** | orders, reviews (via service) | GET /admin/analytics/* | ✅ Hybrid | ⚠️ Partial | analyticsService | 2 onSnapshot | Fix order sync (P1-B). Admin auth (P1-A). |
| **OrdersManagement** | — (via FastAPI) | GET/PUT/POST /admin/orders/* | FastAPI→FS | ❌ Broken | orderService | — | Fix order sync (P1-B). Fix SQLite update on status change (P1-C). Admin auth (P1-A). |
| **CustomersManagement** | users, orders | — | Firestore only | ⚠️ Partial | — | 2 onSnapshot | Orders empty until P1-B fixed. |
| **Settings** | platformSettings/global | GET/PUT /admin/settings/, POST /pause, /resume | ✅ Hybrid | ✅ Working | platformService, settingsService | 1 onSnapshot | Remove settingsService direct-write bypass (P2-C). |
| **Reports** | reports | GET/POST /admin/reports/* | ✅ Hybrid | ✅ Working | reportsService | 1 onSnapshot | None. Best-implemented module. |
| **Reviews** | (via FastAPI proxy) | GET /admin/reviews/dashboard | FastAPI→FS | ✅ Working | reviewAnalyticsService | — | None. |
| **Payments** | orders, users (telemetry) | POST /admin/payments/payout | ⚠️ Hybrid | ❌ Broken | paymentService | 2 onSnapshot | Add auth to payments endpoints (P2-D). Orders empty until P1-B. |
| **CampaignManager** | adminReferralLinks, adminAnalytics/global, adminAffiliateOrders | — | Firestore only | ⚠️ Partial | — | 3 onSnapshot | Wire adminReferralLinks to ecosystemService. |
| **PromotionsManagement** | adminPromotions, promotionParticipants, promotionTransactions | — | Firestore only | ✅ Working (isolated) | — | 3 onSnapshot | None — admin-only tool, acceptable. |
| **AffiliateTransactions** | — | — | — | ❌ Deleted stub | — | — | Page was deleted. Replace or remove from sidebar nav. |

---

## Vendor Portal

| Page | Firestore | FastAPI | Hybrid | Status | Hook | Real-time | Required Fixes |
|---|---|---|---|---|---|---|---|
| **Dashboard** | — | GET /vendors/{id}/dashboard | FastAPI | ✅ Working | useDashboard | — | None. |
| **ManageProducts** | — | GET /vendors/{id}/products | FastAPI | ✅ Working | useVendorProducts | — | None. |
| **AddProduct** | — | POST /api/products/ | FastAPI | ✅ Working | useVendorProducts.createProduct | — | None. |
| **EditProduct** | — | PUT /api/products/{id} | FastAPI | ✅ Working | useVendorProducts.updateProduct | — | None. |
| **Analytics** | — | GET /vendors/{id}/orders + /products | FastAPI | ⚠️ Partial | useOrders, useVendorProducts | — | Remove hardcoded view multipliers (P4-A). |
| **Orders** | — | GET/PATCH /vendors/{id}/orders/* | FastAPI | ✅ Working | useOrders | — | None. |
| **Earnings** | — | GET /vendors/{id}/stats | FastAPI | ✅ Working | useEarnings | — | None. |
| **Reviews** | — | GET/POST /vendors/{id}/reviews/* | FastAPI | ✅ Working | useReviews | — | None. |
| **Withdrawals** | — | GET/POST /vendors/{id}/withdrawals | FastAPI | ✅ Working | useWithdrawals | — | None. |
| **Profile** | — | GET/PUT /vendors/{id}/profile | FastAPI | ✅ Working | useVendorProfile | — | None. |
| **StoreSettings** | — | PUT /vendors/{id}/store-settings | FastAPI | ✅ Working | useStoreSettings | — | None. |
| **Affiliate** | affiliates, conversions, payouts | — | Firestore | ✅ Working | AffiliateContext | 7 onSnapshot | None — reads existing AffiliateContext. |
| **Verification** | — | — | — | ⚠️ Unknown | — | — | Not analyzed — likely Firestore. |

---

## Affiliate Portal

| Page | Firestore | FastAPI | Hybrid | Status | Provider | Real-time | Required Fixes |
|---|---|---|---|---|---|---|---|
| **AffiliateDashboard (shell)** | — | GET /affiliate/profile, /stats, /commissions, /payouts | FastAPI | ✅ Working | — | — | None — shell correctly uses FastAPI. |
| **Dashboard (inner)** | Props from shell | — | Props | ✅ Working | AffiliateContext | Indirect | None. |
| **Products** | products (AppContext) | — | Firestore | ✅ Working | AppContext | onSnapshot via AppCtx | None. |
| **Earnings** | Props + payout POST | POST /api/affiliate/payouts | Hybrid | ✅ Working | AffiliateContext | Via props | Remove Firestore payout bypass (P2-B). |
| **Profile** | Props from shell | — | Props | ✅ Working | AffiliateContext | Via props | None. |

---

## Customer Portal

| Page | Firestore | FastAPI | Hybrid | Status | Provider | Real-time | Required Fixes |
|---|---|---|---|---|---|---|---|
| **Dashboard** | — | GET /auth/me, /orders/me, /wishlist/me, /notifications/, /activity/ | FastAPI | ✅ Working | — | — | None. |
| **Orders** | — | GET /orders/me, /orders/{id} | FastAPI | ✅ Working | — | — | None. |
| **Downloads** | — | GET /products/{id}/download | FastAPI | ✅ Working | — | — | None. |
| **Purchases** | purchases collection | — | Firestore | ⚠️ Duplicate | purchaseService | — | Remove — duplicate of SQLite orders (P3-A). |
| **Wishlist** | — | GET/POST/DELETE /wishlist/* | FastAPI | ✅ Working | — | — | None. |
| **ReviewsManager** | — | GET/POST/DELETE /reviews/* | FastAPI | ✅ Working | — | — | None. |
| **Settings** | users/{uid} | PUT /auth/me (name only) | Hybrid | ✅ Working | — | — | None. |
| **Notifications** | — | GET/POST /notifications/* | FastAPI | ✅ Working | — | — | None. |
| **MessagesCenter** | — | GET /messages/* | FastAPI | ✅ Working | — | — | None. |
| **PriceAlerts** | — | GET/POST /price-alerts/* | FastAPI | ✅ Working | — | — | None. |
| **Marketplace** | products (AppContext) | GET /products/* | Hybrid | ✅ Working | AppContext | onSnapshot products | None. |
| **Checkout** | — | POST /orders/ | FastAPI | ✅ Working | AppContext | — | Add Firestore sync in POST /orders/ (P1-B). |

---

## Broken Integration Report

### Category 1 — Frontend expects backend response but backend never updates Firestore

| Location | Expected | Actual | Fix |
|---|---|---|---|
| Admin OrdersManagement | Admin calls FastAPI, Firestore has order data | POST /api/orders/ never syncs to Firestore → orders collection empty | Add sync_order_to_firestore() in orders/routes.py |
| Admin Dashboard revenue | Revenue derived from Firestore orders | Firestore orders = client-written only, incomplete | Same fix — order sync |
| Admin Analytics | Complete order metrics | Only sees ecosystemService-written orders | Same fix |
| Admin Payments telemetry | Full transaction list | Same empty orders problem | Same fix |

### Category 2 — Firestore updates but frontend never listens

| Location | Firestore Write | Missing Listener | Fix |
|---|---|---|---|
| ecosystemService writes `vendorNotifications` | vendorNotifications/{doc}.add | No vendor page reads this collection | Wire to Vendor notification bell |
| admin_controls writes users/{uid}.accountStatus | users/{uid}.set status | Vendor pages don't have their own onSnapshot for users/{uid} — only AffiliateContext does | Wire vendor status listener in VendorLayout |

### Category 3 — FastAPI endpoint exists but is never called

| Endpoint | Exists? | Called by frontend? | Fix |
|---|---|---|---|
| GET /api/admin/customers/ | ✅ | ❌ (CustomersManagement.jsx reads Firestore directly) | Wire CustomersManagement to use FastAPI endpoint OR keep Firestore direct (acceptable) |
| /api/affiliate/referral-links | ✅ | ❌ (affiliateService.js reads Firestore affiliateLinks) | Wire affiliate links to FastAPI on write operations |
| /api/affiliate/track-click/{code} | ✅ | ❌ (affiliateService.js increments Firestore directly) | Wire click tracking to FastAPI |
| /api/affiliate/commissions POST | ✅ | ❌ (ecosystemService writes Firestore directly) | Wire post-purchase commission creation to FastAPI |
| admin_controls_vendor/routes.py PUT /{uid}/status | ✅ | ❌ (never mounted in main.py) | Delete file — logic is in admin/routes/vendors.py |
| admin_controls_affiliate/routes.py PUT /{uid}/status | ✅ | ❌ (never mounted in main.py) | Delete file — logic is in admin/routes/affiliates.py |

### Category 4 — Frontend calls endpoint that doesn't exist or is wrong

| Frontend Call | Expected Endpoint | Actual | Fix |
|---|---|---|---|
| Admin auth mock login | POST /api/auth/login or /firebase-sync | Hardcoded localStorage mock — no API call | Create real admin user in SQLite + use firebase-sync |
| paymentService.triggerVendorPayout | POST /admin/payments/payout with auth | Endpoint exists but has no auth check | Add require_admin_role to payment endpoints |

### Category 5 — Dead code / duplicate backend

| Item | Location | Issue |
|---|---|---|
| `admin_controls_vendor/routes.py` | backend/admin_controls_vendor/ | Defines endpoints never mounted. Logic duplicated in admin/routes/vendors.py |
| `admin_controls_affiliate/routes.py` | backend/admin_controls_affiliate/ | Same — never mounted |
| `purchaseService.js` writes `purchases` collection | frontend/services/purchaseService.js | Duplicate of SQLite orders — two records per purchase |
| `vendorStats` Firestore collection | ecosystemService.js | Written client-side. Never read by vendor dashboard (which uses FastAPI /vendors/{id}/stats) |
| `app/core/database.py` | backend/app/core/ | Empty/vestigial file. App uses app/db/database.py |

---

## Dependency Map

### Admin Page Dependencies

```
Admin Dashboard.jsx
  ├── dashboardService.js
  │   ├── FastAPI: GET /api/admin/analytics/dashboard-full
  │   └── Firestore onSnapshot: orders, reviews, reports
  └── AdminLayout, AdminComponents

Admin ProductsManagement.jsx
  ├── Firestore onSnapshot: products collection
  ├── FastAPI: POST/PUT/DELETE /api/admin/products/ (via direct backendFetch)
  └── storageService.js → FastAPI POST /api/uploads/

Admin Vendors.jsx
  ├── FastAPI: GET /api/admin/vendors/ → Firestore users
  ├── FastAPI: GET /api/admin/affiliates/ → Firestore users
  ├── vendorService.js → FastAPI PUT /admin/vendors/{uid}/status
  └── vendorService.js → FastAPI PUT /admin/affiliates/{uid}/status

Admin Analytics.jsx
  ├── analyticsService.js
  │   ├── FastAPI: GET /api/admin/analytics/*
  │   └── Firestore onSnapshot: orders, reviews

Admin OrdersManagement.jsx
  ├── orderService.js → FastAPI GET/PUT/POST /api/admin/orders/*
  └── downloadService.js (mock only)

Admin CustomersManagement.jsx
  ├── Firestore onSnapshot: users (role=customer)
  └── Firestore onSnapshot: orders

Admin Settings.jsx
  ├── platformService.js → FastAPI POST /admin/settings/pause, /resume
  ├── settingsService.js → Firestore direct write ⚠️ bypass
  └── Firestore onSnapshot: platformSettings/global

Admin Reports.jsx
  ├── reportsService.js
  │   ├── FastAPI: GET/POST /api/admin/reports/*
  │   └── Firestore onSnapshot: reports

Admin Reviews.jsx
  └── reviewAnalyticsService.js → FastAPI GET /api/admin/reviews/dashboard

Admin Payments.jsx
  └── paymentService.js
      ├── Firestore onSnapshot: orders
      ├── Firestore onSnapshot: users
      └── FastAPI POST /admin/payments/payout (no auth ⚠️)

Admin CampaignManager.jsx
  ├── Firestore: getDocs(products)
  └── Firestore onSnapshot: adminReferralLinks, adminAnalytics/global, adminAffiliateOrders

Admin PromotionsManagement.jsx
  └── Firestore onSnapshot: adminPromotions, promotionParticipants, promotionTransactions
```

### Vendor Page Dependencies

```
Vendor Dashboard.jsx
  └── useVendorData.useDashboard() → FastAPI GET /api/vendors/{id}/dashboard → SQLite

Vendor ManageProducts.jsx
  └── useVendorData.useVendorProducts() → FastAPI GET /api/vendors/{id}/products → SQLite

Vendor Analytics.jsx
  ├── useVendorData.useOrders() → FastAPI /vendors/{id}/orders → SQLite
  └── useVendorData.useVendorProducts() → FastAPI /vendors/{id}/products → SQLite

Vendor Orders.jsx
  └── useVendorData.useOrders() + backendFetch PATCH /vendors/{id}/orders/{id}/status

Vendor Earnings.jsx
  ├── useVendorData.useDashboard() → FastAPI
  ├── useVendorData.useOrders() → FastAPI
  └── useVendorData.useWithdrawals() → FastAPI

All vendor writes go through:
  productApi.js → FastAPI /api/products/*
  vendorApi.js → FastAPI /api/vendors/{id}/*
```

### Affiliate Page Dependencies

```
AffiliateDashboard.jsx (shell)
  └── backendFetch parallel: /affiliate/profile, /stats, /commissions, /payouts

AffiliateContext.jsx (global — mounted above affiliate routes)
  ├── onSnapshot: platformSettings/global
  ├── onSnapshot: users/{uid}
  ├── onSnapshot: affiliates where userId==uid
  ├── onSnapshot: affiliateConversions where affiliateId==affId
  ├── onSnapshot: affiliatePayoutRequests where affiliateId==affId
  ├── onSnapshot: affiliateActivity where affiliateId==affId
  └── onSnapshot: notifications where userId==uid
```

### Context Providers and Their Scope

| Context | Scope | Data Source | Used By |
|---|---|---|---|
| `AuthContext` | Global (wraps entire app) | Firebase Auth + Firestore users + FastAPI JWT | Every page |
| `AppContext` | Global | FastAPI products + Firestore onSnapshot + localStorage | Marketplace, Customer, AppContext-dependent pages |
| `AffiliateContext` | Affiliate routes + Vendor Affiliate tab | Firestore only (7 listeners) | All affiliate pages, Vendor Affiliate tab |
| `ThemeContext` | Global | localStorage | Any themed component |
| `CartContext` | (if separate) | AppContext.cart | Cart UI |
