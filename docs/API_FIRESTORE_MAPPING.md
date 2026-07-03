# Lumora API & Firestore Mapping
> Complete mapping of every FastAPI endpoint and every Firestore collection.  
> **Analysis only — no code was modified.**  
> Date: July 2, 2026

---

## Table of Contents

1. [FastAPI Endpoint Inventory](#1-fastapi-endpoint-inventory)
2. [Firestore Collection Inventory](#2-firestore-collection-inventory)
3. [Cross-Reference: Who Reads What](#3-cross-reference-who-reads-what)
4. [SQLite Table Inventory](#4-sqlite-table-inventory)
5. [Frontend Service → Endpoint Map](#5-frontend-service--endpoint-map)

---

## 1. FastAPI Endpoint Inventory

### 1.1 Auth Endpoints — `/api/auth/`

| Method | Endpoint | Auth Required | SQLite Op | Firestore Op | Used By | Status |
|---|---|---|---|---|---|---|
| POST | `/api/auth/register` | None | INSERT users | None | Auth pages | ✅ Working |
| POST | `/api/auth/login` | None (credentials) | SELECT users | None | Auth pages | ✅ Working |
| POST | `/api/auth/firebase-sync` | Firebase ID Token | SELECT/INSERT users | None | authService.syncWithBackend | ✅ Working |
| GET | `/api/auth/me` | JWT | SELECT users | None | Customer Dashboard, Settings | ✅ Working |
| PUT | `/api/auth/me` | JWT | UPDATE users | None | userService | ✅ Working |
| POST | `/api/auth/forgot-password` | None | SELECT users | None | Auth pages | ⚠️ Stub only (no email sent) |
| POST | `/api/auth/verify-email` | None | None | None | Auth pages | ⚠️ Stub only |
| POST | `/api/auth/resend-verification` | None | None | None | Auth pages | ⚠️ Stub only |

### 1.2 Product Endpoints — `/api/products/`

| Method | Endpoint | Auth Required | SQLite Op | Firestore Op | Used By | Status |
|---|---|---|---|---|---|---|
| GET | `/api/products/` | None | SELECT products WHERE status='published' | None | AppContext, Marketplace | ✅ Working |
| GET | `/api/products/search` | None | SELECT products + filters | None | Search page | ✅ Working |
| GET | `/api/products/featured` | None | SELECT products WHERE featured=true | None | Marketplace | ✅ Working |
| GET | `/api/products/trending` | None | SELECT products WHERE trending=true | None | Marketplace | ✅ Working |
| GET | `/api/products/categories` | None | SELECT DISTINCT category | None | Marketplace filter | ✅ Working |
| GET | `/api/products/{id}` | None | SELECT products WHERE id=? | None | Product detail | ✅ Working |
| GET | `/api/products/{id}/related` | None | SELECT products WHERE category=? | None | Product detail | ✅ Working |
| GET | `/api/products/{id}/images` | None | SELECT products WHERE id=? | None | Product gallery | ✅ Working |
| GET | `/api/products/{id}/download` | JWT | SELECT orders+items | None | Downloads, Vendor | ✅ Working |
| POST | `/api/products/` | JWT (vendor/admin) | INSERT products | SET products/{id} | Vendor AddProduct, Admin | ✅ Working |
| PUT | `/api/products/{id}` | JWT (owner or admin) | UPDATE products | SET products/{id} merge | Vendor EditProduct, Admin | ✅ Working |
| DELETE | `/api/products/{id}` | JWT (owner or admin) | DELETE products | DELETE products/{id} | Vendor, Admin | ✅ Working |

### 1.3 Order Endpoints — `/api/orders/`

| Method | Endpoint | Auth Required | SQLite Op | Firestore Op | Used By | Status |
|---|---|---|---|---|---|---|
| POST | `/api/orders/` | JWT | INSERT orders + order_items; UPDATE products.downloads | None | AppContext.completePurchase | ✅ Working |
| GET | `/api/orders/me` | JWT | SELECT orders WHERE user_id=? | None | Customer Orders, AppContext sync | ✅ Working |
| GET | `/api/orders/{id}` | JWT | SELECT orders + items + products | None | Customer order detail | ✅ Working |

### 1.4 Vendor Endpoints — `/api/vendors/`

| Method | Endpoint | Auth Required | SQLite Op | Firestore Op | Used By | Status |
|---|---|---|---|---|---|---|
| GET | `/api/vendors/public/{id}/profile` | None | SELECT products | None | Marketplace CreatorProfile | ✅ Working |
| GET | `/api/vendors/{id}/dashboard` | JWT (vendor) | SELECT products+orders+reviews+withdrawals | None | Vendor Dashboard | ✅ Working |
| GET | `/api/vendors/{id}/profile` | JWT (vendor) | SELECT users | None | Vendor Profile | ✅ Working |
| PUT | `/api/vendors/{id}/profile` | JWT (vendor) | UPDATE users | None | Vendor Profile save | ✅ Working |
| PUT | `/api/vendors/{id}/store-settings` | JWT (vendor) | UPDATE users | None | Vendor StoreSettings | ✅ Working |
| GET | `/api/vendors/{id}/stats` | JWT (vendor) | SELECT products+orders | None | Vendor Earnings, Dashboard | ✅ Working |
| GET | `/api/vendors/{id}/withdrawals` | JWT (vendor) | SELECT withdrawals | None | Vendor Withdrawals | ✅ Working |
| POST | `/api/vendors/{id}/withdrawals` | JWT (vendor) | INSERT withdrawals | None | Vendor Withdrawals | ✅ Working |
| GET | `/api/vendors/{id}/orders` | JWT (vendor) | SELECT orders WHERE vendor products | None | Vendor Orders | ✅ Working |
| POST | `/api/vendors/{id}/orders/{id}/fulfill` | JWT (vendor) | UPDATE orders.status | None | Vendor Orders | ✅ Working |
| PATCH | `/api/vendors/{id}/orders/{id}/status` | JWT (vendor) | UPDATE orders.status | None | Vendor Orders | ✅ Working |
| GET | `/api/vendors/{id}/reviews` | JWT (vendor) | SELECT reviews WHERE vendor products | None | Vendor Reviews | ✅ Working |
| GET | `/api/vendors/{id}/products` | JWT (vendor) | SELECT products WHERE vendor_id=? | None | Vendor ManageProducts | ✅ Working |
| POST | `/api/vendors/{id}/reviews/{id}/reply` | JWT (vendor) | UPDATE reviews.reply | None | Vendor Reviews | ✅ Working |

### 1.5 Review Endpoints — `/api/reviews/`

| Method | Endpoint | Auth Required | SQLite Op | Firestore Op | Used By | Status |
|---|---|---|---|---|---|---|
| POST | `/api/reviews/` | JWT | INSERT reviews; UPDATE products.rating | None | Customer ReviewsManager | ✅ Working |
| GET | `/api/reviews/` | None | SELECT reviews WHERE product_id=? | None | Product detail | ✅ Working |
| GET | `/api/reviews/product/{id}` | None | SELECT reviews WHERE product_id=? | None | Product detail | ✅ Working |
| GET | `/api/reviews/me` | JWT | SELECT reviews WHERE user_id=? | None | Customer ReviewsManager | ✅ Working |
| PUT | `/api/reviews/{id}` | JWT | UPDATE reviews | None | Customer ReviewsManager | ✅ Working |
| DELETE | `/api/reviews/{id}` | JWT (owner or admin) | DELETE reviews; UPDATE products.rating | None | Customer, Admin | ✅ Working |

### 1.6 Admin Endpoints — `/api/admin/`

#### Analytics

| Method | Endpoint | Auth Required | SQLite Op | Firestore Op | Used By | Status |
|---|---|---|---|---|---|---|
| GET | `/api/admin/analytics/dashboard` | JWT (admin) | None | READ orders, products, vendors, reviews, reports | Admin Dashboard | ⚠️ Orders from Firestore only |
| GET | `/api/admin/analytics/dashboard-full` | JWT (admin) | None | READ all collections | Admin Dashboard, Analytics | ⚠️ Same issue |
| GET | `/api/admin/analytics/revenue` | JWT (admin) | None | READ orders | Analytics | ⚠️ Incomplete |
| GET | `/api/admin/analytics/products` | JWT (admin) | None | READ products, orders | Analytics | ⚠️ Partial |
| GET | `/api/admin/analytics/customers` | JWT (admin) | None | READ users, orders | Analytics | ⚠️ Partial |
| GET | `/api/admin/analytics/forecast` | JWT (admin) | None | READ orders | Analytics | ⚠️ Partial |

#### Products

| Method | Endpoint | Auth Required | SQLite Op | Firestore Op | Used By | Status |
|---|---|---|---|---|---|---|
| GET | `/api/admin/products/` | JWT (admin) | SELECT all products | None | Admin Products (not used by frontend) | ⚠️ Frontend uses Firestore instead |
| POST | `/api/admin/products/` | JWT (admin) | INSERT products | SET products/{id} | Admin Products create | ✅ Working |
| PUT | `/api/admin/products/{id}` | JWT (admin) | UPDATE products | SET products/{id} merge | Admin Products edit | ✅ Working |
| DELETE | `/api/admin/products/{id}` | JWT (admin) | DELETE products | DELETE products/{id} | Admin Products delete | ✅ Working |

#### Orders

| Method | Endpoint | Auth Required | SQLite Op | Firestore Op | Used By | Status |
|---|---|---|---|---|---|---|
| GET | `/api/admin/orders/` | JWT (admin) | None | READ orders | Admin OrdersManagement | ❌ Broken (Firestore orders empty) |
| GET | `/api/admin/orders/{id}` | JWT (admin) | None | READ orders/{id} | Admin OrdersManagement | ❌ Same |
| PUT | `/api/admin/orders/{id}/status` | JWT (admin) | None | UPDATE orders/{id} | Admin OrdersManagement | ❌ Updates Firestore only |
| POST | `/api/admin/orders/{id}/refund` | JWT (admin) | None | UPDATE orders/{id} | Admin OrdersManagement | ❌ Same |
| POST | `/api/admin/orders/{id}/dispute` | JWT (admin) | None | UPDATE orders/{id} | Admin OrdersManagement | ❌ Same |

#### Customers

| Method | Endpoint | Auth Required | SQLite Op | Firestore Op | Used By | Status |
|---|---|---|---|---|---|---|
| GET | `/api/admin/customers/` | JWT (admin) | None | READ users (role=customer) | Admin Customers API (not used by page) | ⚠️ Page uses Firestore directly |
| GET | `/api/admin/customers/{id}` | JWT (admin) | None | READ users/{id} | Admin customer detail | ⚠️ Not verified in use |
| PUT | `/api/admin/customers/{id}` | JWT (admin) | None | UPDATE users/{id} | Admin customer edit | ⚠️ Not verified in use |

#### Vendors & Affiliates

| Method | Endpoint | Auth Required | SQLite Op | Firestore Op | Used By | Status |
|---|---|---|---|---|---|---|
| GET | `/api/admin/vendors/` | JWT (admin) | None | READ users (role='vendor'/'Vendor') | Admin Vendors page | ✅ Working |
| PUT | `/api/admin/vendors/{uid}/status` | JWT (admin) | UPDATE users.is_active | UPDATE users/{uid} + vendors/{uid} | Admin Vendors page | ✅ Working |
| GET | `/api/admin/affiliates/` | JWT (admin) | None | READ users (role='affiliate'/'Affiliate') | Admin Vendors page (Affiliate tab) | ✅ Working |
| PUT | `/api/admin/affiliates/{uid}/status` | JWT (admin) | UPDATE users.is_active | UPDATE users/{uid} + affiliates/{uid} | Admin Vendors page | ✅ Working |

#### Reports

| Method | Endpoint | Auth Required | SQLite Op | Firestore Op | Used By | Status |
|---|---|---|---|---|---|---|
| GET | `/api/admin/reports/` | JWT (admin) | None | READ reports | Admin Reports | ✅ Working |
| GET | `/api/admin/reports/analytics` | JWT (admin) | None | READ reports | Admin Reports | ✅ Working |
| GET | `/api/admin/reports/dashboard` | JWT (admin) | None | READ reports + products | Admin Reports | ✅ Working |
| POST | `/api/admin/reports/resolve` | JWT (admin) | None | UPDATE reports/{id} | Admin Reports | ✅ Working |
| POST | `/api/admin/reports/reject` | JWT (admin) | None | UPDATE reports/{id} | Admin Reports | ✅ Working |
| POST | `/api/admin/reports/assign` | JWT (admin) | None | UPDATE reports/{id} | Admin Reports | ✅ Working |
| POST | `/api/admin/reports/delete` | JWT (admin) | None | DELETE reports/{id} | Admin Reports | ✅ Working |

#### Reviews

| Method | Endpoint | Auth Required | SQLite Op | Firestore Op | Used By | Status |
|---|---|---|---|---|---|---|
| GET | `/api/admin/reviews/dashboard` | JWT (admin) | None | READ reviews, products | Admin Reviews | ✅ Working |
| GET | `/api/admin/reviews/analytics` | JWT (admin) | None | READ reviews, products | Admin Reviews | ✅ Working |
| POST | `/api/admin/reviews/moderate` | JWT (admin) | None | UPDATE/DELETE reviews/{id} | Admin Reviews | ✅ Working |

#### Settings

| Method | Endpoint | Auth Required | SQLite Op | Firestore Op | Used By | Status |
|---|---|---|---|---|---|---|
| GET | `/api/admin/settings/` | JWT (admin) | None | READ platformSettings/global | Admin Settings | ✅ Working |
| PUT | `/api/admin/settings/` | JWT (admin) | None | SET platformSettings/global merge | Admin Settings | ✅ Working |
| POST | `/api/admin/settings/pause` | JWT (admin) | None | SET platformSettings/global isPlatformPaused=true | Admin Settings | ✅ Working |
| POST | `/api/admin/settings/resume` | JWT (admin) | None | SET platformSettings/global isPlatformPaused=false | Admin Settings | ✅ Working |

#### Payments

| Method | Endpoint | Auth Required | SQLite Op | Firestore Op | Used By | Status |
|---|---|---|---|---|---|---|
| GET | `/api/admin/payments/telemetry` | None | None | READ orders, users | Admin Payments | ⚠️ No auth check |
| GET | `/api/admin/payments/dashboard` | None | None | READ orders, users | Admin Payments | ⚠️ No auth check |
| GET | `/api/admin/payments/overview` | None | None | READ orders | Admin Payments | ⚠️ No auth check |
| GET | `/api/admin/payments/vendor-payouts` | None | None | READ orders, users | Admin Payments | ⚠️ No auth check |
| GET | `/api/admin/payments/refunds` | None | None | READ orders | Admin Payments | ⚠️ No auth check |
| GET | `/api/admin/payments/transactions` | None | None | READ orders | Admin Payments | ⚠️ No auth check |
| POST | `/api/admin/payments/payout` | None | None | Stub | paymentService.triggerVendorPayout | ⚠️ No auth + stub |

### 1.7 Affiliate Endpoints — `/api/affiliate/`

> This module uses SQLAlchemy/SQLite exclusively — no Firestore.

| Method | Endpoint | Auth Required | Used By | Status |
|---|---|---|---|---|
| GET | `/api/affiliate/profile` | JWT | Affiliate profile API | ✅ Working |
| PUT | `/api/affiliate/profile` | JWT | Affiliate profile update | ✅ Working |
| GET | `/api/affiliate/stats` | JWT | Affiliate stats | ✅ Working |
| GET | `/api/affiliate/dashboard` | JWT | Affiliate dashboard API | ✅ Working |
| GET | `/api/affiliate/commissions` | JWT | Affiliate commissions | ✅ Working |
| GET | `/api/affiliate/payouts` | JWT | Affiliate payout history | ✅ Working |
| POST | `/api/affiliate/payouts` | JWT | Payout request | ✅ Working |
| GET | `/api/affiliate/analytics` | JWT | Affiliate analytics | ✅ Working |
| GET | `/api/affiliate/reports` | JWT | Affiliate reports | ✅ Working |
| GET | `/api/affiliate/links` | JWT | Referral links list | ✅ Working |
| POST | `/api/affiliate/links` | JWT | Create referral link | ✅ Working |
| POST | `/api/affiliate/track-click` | None | Click tracking | ✅ Working |

> **Note:** The affiliate frontend (`AffiliateContext.jsx`, `affiliateService.js`) does **not** call these endpoints. It reads/writes Firestore directly. These endpoints exist but are not connected to the frontend.

---

## 2. Firestore Collection Inventory

| Collection | Written By | Read By | Listener Active? | FastAPI Involved? | Status |
|---|---|---|---|---|---|
| `users` | AuthContext (register/login), AffiliateContext (auto-create), admin_controls_vendor/affiliate services | AuthContext, AffiliateContext, Admin Customers, Admin Vendors/Affiliates, dashboardService, analyticsService, customerService | Yes (AuthContext, AffiliateContext, Admin pages) | ✅ (vendor/affiliate status write) | ✅ Healthy |
| `products` | FastAPI (sync on create/update/delete) | AppContext onSnapshot, Admin ProductsManagement onSnapshot, analyticsService, reviewsService | Yes (AppContext, Admin Products) | ✅ (write gate) | ⚠️ Must be seeded from SQLite |
| `vendors` | AuthContext (register as vendor), admin_controls_vendor service (status update) | admin_controls_vendor validators, analyticsService | No | ✅ (status update) | ✅ Healthy |
| `affiliates` | AuthContext (register as affiliate), AffiliateContext (auto-create) | AffiliateContext onSnapshot, admin_controls_affiliate validators, analyticsService | Yes (AffiliateContext) | ✅ (status update) | ⚠️ Auto-created client-side |
| `customers` | AuthContext (register as customer) | Admin Customers | No | None | ✅ Healthy |
| `orders` | None from current flow | Admin OrdersManagement (via FastAPI), analyticsService, dashboardService, paymentService | Yes (Admin pages, paymentService) | ✅ (admin reads) | ❌ Empty — orders go to SQLite only |
| `reviews` | None from current flow | analyticsService, reviewsService (via FastAPI) | No | ✅ (admin reads) | ⚠️ May be empty |
| `reports` | Unknown — possibly a customer-facing report form | reportsService, Admin Reports page | Yes (reportsService) | ✅ (report actions) | ✅ If populated externally |
| `platformSettings` | AuthContext indirectly, settingsService, Admin settings FastAPI | usePlatformSettings, AffiliateContext, status_checks.py | Yes (everywhere) | ✅ (write gate + read) | ✅ Healthy |
| `affiliateConversions` | ecosystemService.js (client-side on purchase) | AffiliateContext onSnapshot | Yes (AffiliateContext) | None | ⚠️ Client-side unvalidated writes |
| `affiliateClicks` | affiliateService.js (client-side) | affiliateService | No | None | ⚠️ Client-side |
| `affiliateLinks` | affiliateService.js, ecosystemService | affiliateService | No | None | ⚠️ Client-side |
| `affiliateActivity` | ecosystemService.js | AffiliateContext onSnapshot | Yes (AffiliateContext) | None | ⚠️ Client-side |
| `affiliatePayoutRequests` | affiliateService.js (client-side) | AffiliateContext onSnapshot | Yes (AffiliateContext) | None | ⚠️ Bypasses FastAPI payout endpoint |
| `notifications` | ecosystemService.js, potentially backend | AffiliateContext onSnapshot, FastAPI /api/notifications/ | Yes (AffiliateContext) | ✅ (notifications endpoint) | ⚠️ Two write sources |
| `vendorAnalytics` | ecosystemService.js (client-side on purchase) | Unknown | No | None | ⚠️ Client-side unvalidated |
| `purchases` | purchaseService.js (client-side on checkout) | purchaseService.getUserPurchases | No | None | ⚠️ Duplicate of SQLite orders |
| `payments` | paymentService.js (client-side) | None identified | No | None | ⚠️ Client-side only |
| `auth_logs` | AuthContext.logAuthEvent | None | No | None | ℹ️ Audit log |
| `cart` | Unknown (possibly cart_router.py) | AppContext sync | No | ✅ (cart CRUD) | ✅ Healthy |
| `wishlist` | Unknown (possibly wishlist_router.py) | AppContext sync | No | ✅ (wishlist CRUD) | ✅ Healthy |

---

## 3. Cross-Reference: Who Reads What

### Products Collection

```
Firestore.products
  ← Written by: FastAPI /api/products/ POST/PUT/DELETE (via sync_product_to_firestore)
  ← Written by: FastAPI /api/admin/products/ POST/PUT/DELETE
  → Read by: AppContext.jsx onSnapshot (marketplace, customer-facing)
  → Read by: Admin ProductsManagement.jsx onSnapshot
  → Read by: analyticsService (product metrics)
  → Read by: reportsService (product reference)
```

### Orders Collection

```
Firestore.orders
  ← Written by: admin_api/orders/services.py (status updates only)
  ← Written by: ecosystemService.js (client-side — vendorAnalytics updates)
  ← NOT written by: POST /api/orders/ (goes to SQLite only)
  → Read by: admin_api/orders/services.py (list, detail, status)
  → Read by: admin_api/analytics/services.py (revenue, conversions)
  → Read by: admin_api/payments/services.py (telemetry)
  → Read by: dashboardService.js onSnapshot
  → Read by: analyticsService.js onSnapshot
  → Read by: paymentService.js onSnapshot
  → Read by: Admin CustomersManagement.jsx onSnapshot
```

### Platform Settings

```
Firestore.platformSettings/global
  ← Written by: FastAPI /api/admin/settings/ PUT/POST
  ← Written by: settingsService.js (direct, bypasses FastAPI)
  → Read by: usePlatformSettings hook (React — all pages)
  → Read by: AffiliateContext.jsx onSnapshot
  → Read by: status_checks.py check_platform_paused() (sync, backend)
  → Read by: admin_firestore.py get_platform_settings() (backend)
```

---

## 4. SQLite Table Inventory

| Table | Written By | Read By | Synced to Firestore? |
|---|---|---|---|
| `users` | `/api/auth/register`, `/api/auth/firebase-sync`, admin_controls services | All JWT-protected endpoints | Partially (status flags only) |
| `products` | `/api/products/` POST/PUT/DELETE, `/api/admin/products/` | `/api/products/*`, `/api/vendors/{id}/products`, `/api/admin/products/` | ✅ Yes (sync_product_to_firestore) |
| `orders` | `/api/orders/` POST | `/api/orders/me`, `/api/orders/{id}`, `/api/vendors/{id}/orders`, `/api/admin/*` | ❌ No |
| `order_items` | `/api/orders/` POST | `/api/orders/{id}`, vendor orders, admin orders | ❌ No |
| `reviews` | `/api/reviews/` POST | `/api/reviews/*`, `/api/vendors/{id}/reviews` | ❌ No (admin reads from Firestore) |
| `withdrawals` | `/api/vendors/{id}/withdrawals` POST | `/api/vendors/{id}/withdrawals` GET | ❌ No |
| `affiliate_profiles` | `/api/affiliate/` (SQLAlchemy module) | `/api/affiliate/*` | ❌ No |
| `affiliate_commissions` | `/api/affiliate/` module | `/api/affiliate/commissions` | ❌ No |
| `affiliate_payouts` | `/api/affiliate/payouts` POST | `/api/affiliate/payouts` GET | ❌ No |
| `cart_items` | `/api/cart/` | `/api/cart/` | ❌ No |
| `wishlist` | `/api/wishlist/` | `/api/wishlist/me` | ❌ No |
| `notifications` | `/api/notifications/` | `/api/notifications/` | ❌ No |
| `messages` | `/api/messages/` | `/api/messages/` | ❌ No |
| `price_alerts` | `/api/price-alerts/` | `/api/price-alerts/` | ❌ No |

---

## 5. Frontend Service → Endpoint Map

| Service / Hook | Calls FastAPI | Calls Firestore Directly | Endpoints Called |
|---|---|---|---|
| `authService.js` | ✅ | ❌ | `POST /api/auth/firebase-sync` |
| `productApi.js` | ✅ | ❌ | `GET/POST/PUT/DELETE /api/products/` |
| `vendorApi.js` | ✅ | ❌ | All `/api/vendors/{id}/*` |
| `orderApi.js` | ✅ | ❌ | `GET/POST /api/orders/`, `GET /api/orders/{id}` |
| `useVendorData.js` | ✅ | ❌ | `/api/vendors/{id}/*`, `/api/products/*` |
| `orderService.js` | ✅ | ❌ | `/api/admin/orders/*` |
| `vendorService.js` | ✅ | ❌ | `/api/admin/vendors/*`, `/api/admin/affiliates/*` |
| `productService.js` | ✅ | ❌ | `/api/products/` |
| `reviewAnalyticsService.js` | ✅ | ❌ | `/api/admin/reviews/dashboard` |
| `reportsService.js` | ✅ | ✅ | FastAPI: `/api/admin/reports/*`; Firestore: `reports` onSnapshot |
| `dashboardService.js` | ✅ | ✅ | FastAPI: `/api/admin/analytics/dashboard-full`; Firestore: `orders`, `reviews`, `reports` onSnapshot |
| `analyticsService.js` | ✅ | ✅ | FastAPI: `/api/admin/analytics/*`; Firestore: `orders`, `reviews` onSnapshot |
| `settingsService.js` | ❌ | ✅ | Firestore only: `platformSettings/global` read/write |
| `paymentService.js` | ✅ | ✅ | FastAPI: `/api/admin/payments/payout`; Firestore: `orders`, `users` onSnapshot |
| `affiliateService.js` | ⚠️ Partial | ✅ | Firestore: all affiliate collections; FastAPI: `GET /api/products/{id}` only |
| `purchaseService.js` | ❌ | ✅ | Firestore only: `purchases` collection |
| `paymentService.js` | ❌ | ✅ | Firestore only: `payments` collection (recordPayment) |
| `userService.js` | ⚠️ Partial | ✅ | FastAPI: `PUT /api/auth/me` (name only); Firestore: `users/{uid}` read/write |
| `usePlatformSettings.js` | ❌ | ✅ | Firestore only: `platformSettings/global` subscribe |
| `AffiliateContext.jsx` | ❌ | ✅ | Firestore only: 7 collections |
| `AuthContext.jsx` | ❌ | ✅ | Firestore only: `users`, `vendors`, `affiliates`, `customers`, `auth_logs` |
| `AppContext.jsx` | ✅ | ✅ | FastAPI: `/api/products/`, cart, wishlist, orders; Firestore: `products` onSnapshot |
