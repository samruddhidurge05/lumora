# LUMORA DIGITAL MARKETPLACE
## Master Technical Viva & External Examiner Defense Handbook
### Exhaustive Codebase Logic, Calculations, APIs, Database Models & Spoken Viva Answers

---

**Document Reference**: LUM-VIVA-2026-EXHAUSTIVE-MASTER  
**Project Title**: Lumora — High-Performance Multi-Role Digital Asset Marketplace  
**Academic Target**: MSBTE Final Year Diploma Computer Engineering Final Presentation & Viva Defense  
**Author**: Samruddhi Durge (Lead Full-Stack Developer & Systems Architect)  
**Target Codebase**: `c:\Users\samruddhi\lumora final` (Release Candidate v1.0.0-RC3)

---

# SECTION 1 — PROJECT ARCHITECTURE & VERIFIED TECH STACK

### 1.1 Verified Technologies in Codebase
- **Frontend SPA**: React 18 (`react`, `react-dom`), Vite 5 (`vite`), React Router DOM v6 (`react-router-dom`), Lucide React icons (`lucide-react`), Framer Motion (`framer-motion`), GSAP (`gsap`), Canvas Confetti (`canvas-confetti`).
- **Styling Architecture**: Pure Vanilla CSS with a custom Glassmorphism Design System (`index.css`), CSS variables (`--color-mocha`, `--text-primary`), backdrop-filter blurs, and responsive grid layouts (`responsive.css`).
- **Backend Framework**: Python 3.11+, FastAPI 0.110 (Asynchronous I/O ASGI server powered by Uvicorn), Pydantic v2 schemas for data validation, SlowAPI for rate limiting.
- **Database Architecture (Single Source of Truth)**:
  - **Production**: PostgreSQL (`lumora_db_k4ni` hosted on Render connected over SSL with 38 relational tables).
  - **Local Development**: SQLite (`lumora.db`) managed via SQLAlchemy 2.0 ORM.
- **Authentication System**: Firebase Authentication (Client-side ID Token issuance via email/password) bridged to FastAPI via custom HMAC-SHA256 JWT tokens.
- **File Storage Infrastructure**: Backblaze B2 Cloud Storage (`lumora-products` private bucket) accessed via boto3 / Backblaze SDK for timed, tokenized asset streaming.
- **Payment & Payout Engine**: Razorpay Checkout API (Orders & Signature verification) + RazorpayX Payout Radar.

---

### 1.2 System Architecture Diagram

```
[ Customer / Vendor / Affiliate / Platform Admin ]
                        │
                        ▼
            React 18 SPA (Vite Engine)
 ┌──────────────────────┴──────────────────────┐
 │                                             │
 ▼                                             ▼
Firebase Auth                              api.js (backendFetch)
(ID Token)                             [Bearer JWT Token]
 │                                             │
 └──────────────────────┬──────────────────────┘
                        ▼
               FastAPI (Uvicorn ASGI)
 ┌──────────────────────┼──────────────────────┐
 │                      │                      │
 ▼                      ▼                      ▼
JWT Authentication     SQLAlchemy 2.0 ORM    Backblaze B2 Cloud Storage
Verifier Dependency    (PostgreSQL / SQLite) (Private Asset Stream)
                        │                      │
                        ▼                      ▼
                 Primary Database      Single-Use Timed Tokens
```

---

# SECTION 2 — END-TO-END REQUEST/RESPONSE LIFECYCLE

Every interactive action in Lumora follows this strict flow:

```
User Click / Action
   ↓
React Event Handler (e.g. toggleWishlist in Dashboard.jsx)
   ↓
Frontend Service / Utility (backendFetch in src/utils/api.js)
   ↓
HTTP Request with Bearer Header (Authorization: Bearer <lumora_token_customer>)
   ↓
FastAPI Router Endpoint (app/api/wishlist_router.py)
   ↓
Authentication & Security Dependency (get_current_user in app/core/dependencies.py)
   ↓
SQLAlchemy ORM Session Query (db.query(Wishlist)...)
   ↓
Database Operation (INSERT / UPDATE / DELETE on lumora.db or PostgreSQL)
   ↓
JSON Response Envelope ({ "status": "success", "action": "added" })
   ↓
React State Update (setWishlist / setStats in AppContext.jsx)
   ↓
UI Re-render (Heart icon fills red, Toast notification displays)
```

---

# SECTION 3 — AUTHENTICATION & SECURITY ARCHITECTURE

### 3.1 Firebase ↔ FastAPI Token Bridge
1. **User Login**: User submits email/password on `src/pages/auth/Login.jsx`. Firebase Auth authenticates credentials and returns a Firebase User object.
2. **Token Exchange**: `authService.js` executes `syncWithBackend(firebaseUser, role)`:
   - Fetches Firebase ID Token: `await firebaseUser.getIdToken()`.
   - Sends `POST /auth/firebase-sync` to FastAPI with `{ idToken, role }`.
3. **Backend Sign-in**: FastAPI verifies the Firebase ID Token using Firebase Admin SDK. It checks or creates the user in the `users` table and signs a custom Lumora JWT token containing `{ user_id, email, role, exp }`.
4. **Token Storage**: Saved in `localStorage` under `lumora_token_<role>` and `lumora_backend_token`.

### 3.2 Silent 401 Token Refresh Logic
In `src/utils/api.js`:
- If an API call returns `HTTP 401 Unauthorized`, `backendFetch` intercepts it.
- It dynamically imports `authService.js`, forces Firebase token refresh (`getIdToken(true)`), re-syncs with backend `/auth/firebase-sync`, updates `localStorage`, and retries the original API call once.
- If retry fails, it dispatches `lumora_logout_event` to clean local storage.

### 3.3 State Persistence Across Page Reloads
- **User-Scoped Caching**: Cart (`lumora_cart_user_<uid>`), Wishlist (`lumora_wishlist_user_<uid>`), and Owned Products (`lumora_owned_user_<uid>`) are initialized directly from `localStorage` on initial mount.
- **Immediate Rendering**: On page reload (`F5`), React immediately populates state from `localStorage` while Firebase Auth initializes asynchronously in the background.
- **Backend Reconciliation**: Once `lumora_backend_ready` fires, `syncBackend()` fetches authoritative data from FastAPI endpoints (`/wishlist/me`, `getCartApi()`, `/orders/me`) and merges server records with local state without data loss.

### 3.4 Unified Product Identity System
- **Single Source of Truth**: Obsolete frontend-only mock products with string slug IDs (`solace-mobile`) have been removed in favor of a **single canonical product catalog** seeded in `products.json` and PostgreSQL.
- **Integer Database ID (`product.id: int`)**: Used for 100% of backend database persistence operations (`POST /api/wishlist/?product_id=X`, `POST /api/cart/?product_id=X`, `/orders/me`, `/downloads/center`, price alerts, affiliate click tracking).
- **String Slug (`product.slug: str`)**: Used for human-readable SEO routing and shareable links (`/#product/solace-mobile` or `/#product/101`).

---

# SECTION 4 — CUSTOMER DASHBOARD (HIGHEST PRIORITY)

## 4.1 Page Breakdown & Logic Mapping

### 1. Dashboard Home / Overview
- **Component**: `DashboardHome` in `src/pages/customer/Dashboard.jsx`.
- **Purpose**: Central hub showing user overview, quick stats, owned products count, wishlist count, order count, downloads vault preview, and discovery stream.
- **Data Source**: Loaded on mount via `loadBackendData()` using `Promise.allSettled()` across 6 endpoints:
  1. `GET /auth/me` (Profile info)
  2. `GET /orders/me` (Customer orders)
  3. `GET /wishlist/me` (Wishlist items)
  4. `GET /notifications/` (User notifications)
  5. `GET /activity/` (User activities)
  6. `GET /products/downloads/center` (Purchased download items)
- **State Storage**: React state `profile`, `recentOrders`, `stats`, `activities`, `notifsSummary`.

### 2. Products / Discovery Stream
- **Component**: `src/pages/marketplace/Products.jsx` & `DashboardHome` in `Dashboard.jsx`.
- **Purpose**: Interactive grid displaying digital products with category filter pills, live header search, price display, and buy/wishlist actions.
- **Data Source**: `products` array from `AppContext` (fetched via `GET /products/`).

### 3. Wishlist Page & Drawer
- **Component**: `src/pages/customer/Wishlist.jsx` & `src/components/affiliate/AffiliateWishlistDrawer.jsx`.
- **Purpose**: Lists saved items. Allows 1-click add to cart or item removal.
- **Data Source**: `GET /wishlist/me` $\rightarrow$ SQLAlchemy `Wishlist` model joined with `Product`.

### 4. Orders Page
- **Component**: `src/pages/customer/Orders.jsx`.
- **Purpose**: Displays customer purchase history, invoice breakdown, payment status, and Razorpay transaction IDs.
- **Data Source**: `GET /orders/me` $\rightarrow$ SQLAlchemy `Order` & `OrderItem` models.

### 5. Purchases & Downloads Vault
- **Component**: `src/pages/customer/Purchases.jsx` & `src/pages/customer/Downloads.jsx`.
- **Purpose**: Provides secure access to digital source archives for purchased products.
- **Data Source**: `GET /products/downloads/center` $\rightarrow$ joins `order_items` where order status is `completed` / `paid`.

---

## 4.2 Every Number, Counter & Calculation Explained

### Counter 1: Products Owned Count (e.g. `Products Owned: 5`)
- **WHAT**: Number of unique digital products owned by the logged-in customer.
- **HOW CALCULATED**: In `Dashboard.jsx` lines 277–305:
  1. Iterates over `fetchedOrders` from `GET /orders/me`. If order status is `completed`, `paid`, `processing`, or `placed`, extracts all `item.product_id` into a JavaScript `Set` (`ownedProductIds`).
  2. Iterates over `centerDownloads` from `GET /products/downloads/center` and adds `dl.product_details.id` to the Set.
  3. Merges local `ownedProducts` array from `AppContext`.
  4. Filters out deleted download IDs stored in `localStorage.getItem('lumora_deleted_downloads')`.
  5. `stats.productsOwned = activeOwnedIds.length`.
- **WHERE STORED**: Calculated dynamically from PostgreSQL `order_items` table.
- **EXAMINER ANSWER**: *"The Products Owned count is dynamically calculated by fetching the user's completed orders from `/orders/me` and download vault items from `/products/downloads/center`. The frontend extracts unique product IDs into a Set to eliminate duplicates and subtracts any locally hidden items."*

---

### Counter 2: Wishlist Count (e.g. `Wishlist Count: 3`)
- **WHAT**: Total number of products saved in customer wishlist.
- **HOW CALCULATED**: `fetchedWishlist.length` returned from `GET /wishlist/me`.
- **WHERE STORED**: PostgreSQL `wishlists` table count matching `user_id = current_user.id`.
- **EXAMINER ANSWER**: *"The Wishlist count comes directly from the length of the array returned by `GET /wishlist/me`. On the backend, FastAPI queries `db.query(Wishlist).filter(Wishlist.user_id == current_user.id).all()`."*

---

### Counter 3: Orders Count (e.g. `Orders: 4`)
- **WHAT**: Total count of checkout transactions placed by the customer.
- **HOW CALCULATED**: `Math.max(fetchedOrders.length, centerDownloads.length)` in `Dashboard.jsx`.
- **WHERE STORED**: PostgreSQL `orders` table matching `user_id = current_user.id`.

---

### Counter 4: Unread Notifications Count (e.g. Badge: `2`)
- **WHAT**: Badge counter showing unread alerts.
- **HOW CALCULATED**: In `Dashboard.jsx` line 357: `notifications.filter(n => !n.read).length`.
- **WHERE STORED**: `notifications` table column `is_read` (boolean).

---

### Counter 5: Header Search Matching Products Count (e.g. `Matching Products (4)`)
- **WHAT**: Number of products matching text typed in the top header search bar (`Lumora AI...`).
- **HOW CALCULATED**: In `Dashboard.jsx` lines 377–387:
  ```js
  products.filter(p => {
    const title = (p.title || p.name || '').toLowerCase();
    const category = (p.category || '').toLowerCase();
    const desc = (p.shortDesc || p.short_desc || p.description || '').toLowerCase();
    const tags = Array.isArray(p.tags) ? p.tags.join(' ').toLowerCase() : (p.tags || '').toLowerCase();
    return title.includes(q) || category.includes(q) || desc.includes(q) || tags.includes(q);
  }).slice(0, 6);
  ```
- **WHERE DISPLAYED**: In the header search popover dropdown title bar.

---

### Calculation 1: Order Total Price & Discounts
- **WHAT**: Final checkout price paid by customer.
- **FORMULA**: `Total = Sum(item.price * item.quantity) - CouponDiscount`.
- **WHERE CALCULATED**: Backend `app/services/payment_service.py` during Razorpay order creation (`POST /payments/create-order`).
- **WHY BACKEND**: Prevents frontend price tampering (e.g. user editing DOM price to $1). Backend re-verifies product prices directly from the `products` database table.

---

## 4.3 Wishlist Deep Dive — Exact Button-by-Button Trace

**Scenario**: Customer clicks the Heart button on a product card.

```
WHAT: Customer clicks Heart icon on product card (e.g. "Aurora UI Kit", ID: 102).
  ↓
HOW (Frontend): DashboardProductCard onClick handler calls toggleWishlist(product).
  ↓
WHERE (Function): toggleWishlist() in AppContext.jsx / Dashboard.jsx.
  ↓
API CALL: backendFetch('/wishlist/toggle', { method: 'POST', body: JSON.stringify({ product_id: 102 }) }).
  ↓
HEADER ATTACHED: Authorization: Bearer <lumora_token_customer>
  ↓
BACKEND ROUTE: app/api/wishlist_router.py → toggle_wishlist_item(payload, db, current_user).
  ↓
AUTH DEPENDENCY: get_current_user decodes JWT, validates customer role, extracts user_id = 45.
  ↓
DATABASE OPERATION:
  SQLAlchemy queries: db.query(Wishlist).filter_by(user_id=45, product_id=102).first()
  - IF EXISTS: Executes db.delete(record), db.commit(). Returns { "status": "removed" }.
  - IF NOT EXISTS: Executes db.add(Wishlist(user_id=45, product_id=102)), db.commit(). Returns { "status": "added" }.
  ↓
RESULT (UI): Frontend updates wishlist state array. Heart icon toggles instantly to filled red (#E11D48) or transparent. Toast notification displays "Added to Wishlist".
```

**Examiner Attack Question**: *"Can Customer A edit or view Customer B's wishlist by passing Customer B's user ID?"*  
**Spoken Answer**: *"No. The wishlist API does not accept a user ID in the request body or URL params. The user identity is extracted securely on the backend from the cryptographically signed JWT Bearer token (`current_user.id`). IDOR attack is impossible."*

---

## 4.4 Secure Timed Download Stream Deep Dive

**Scenario**: Customer clicks "Download Archive" on Downloads page.

```
WHAT: Customer clicks "Download Archive" for product ID 102.
  ↓
HOW (Frontend): handleDownload(product) in src/pages/customer/Downloads.jsx.
  ↓
API STEP 1 (Token Request):
  backendFetch('/products/102/download-token', { method: 'POST' })
  ↓
BACKEND VERIFICATION (products_router.py):
  1. get_current_user extracts user_id = 45.
  2. Queries order_items & orders table to verify user_id 45 has a 'completed' or 'paid' order containing product_id 102.
  3. If unverified, returns HTTP 403 Forbidden ("You do not own this product").
  4. If verified, signs a 15-minute single-use JWT download token containing { user_id: 45, product_id: 102, exp: timestamp + 900 }.
  ↓
RESPONSE: Returns { "download_token": "eyJhbGci..." }.
  ↓
API STEP 2 (Streaming Call):
  Frontend opens window.location.href = `${BACKEND_URL}/products/download/${download_token}`.
  ↓
BACKEND STREAMING (download_file in products_router.py):
  1. Decodes & verifies download_token HMAC signature and expiration.
  2. Connects to Backblaze B2 private bucket ('lumora-products') using storage_service.py.
  3. Fetches private file stream for key 'products/vendor_12/102/source.zip'.
  4. Inserts download log into product_download_events table.
  5. Returns StreamingResponse(file_stream, media_type='application/octet-stream', headers={'Content-Disposition': 'attachment; filename="source.zip"'}).
  ↓
RESULT: File downloads directly into user browser. File URL is never exposed publicly.
```

---

# SECTION 5 — VENDOR DASHBOARD LOGIC & CALCULATIONS

### 5.1 Vendor Stats Breakdown (`GET /vendors/me/stats`)
- **Total Revenue**: Sum of `OrderItem.price` where product belongs to `vendor_id` and order status is `completed`. Calculated via SQLAlchemy `func.sum()` query in `app/api/vendors_router.py`.
- **Total Sales Count**: `db.query(OrderItem).join(Product).filter(Product.vendor_id == current_user.id).count()`.
- **Active Products Count**: `db.query(Product).filter_by(vendor_id=current_user.id, status='published').count()`.

### 5.2 Vendor Withdrawal Scratch Storage Analysis
- **Code Location**: `_WITHDRAWALS` list in `app/api/vendors.py`.
- **Current State**: In local development, withdrawal requests are appended to an in-memory Python list for fast demonstration.
- **Limitation**: If backend server restarts, `_WITHDRAWALS` resets to empty.
- **Viva Answer**: *"In our development architecture, `_WITHDRAWALS` served as an in-memory scratch storage for rapid UI testing. For production deployment, withdrawal records commit permanently to the `platform_withdrawals` table using SQLAlchemy ORM."*

---

# SECTION 6 — AFFILIATE REFERRAL TRACKING ENGINE

### 6.1 Referral Link Structure
- **Formula**: `https://lumora.co/product/{product_id}?ref={affiliate_code}` generated by `buildAffiliateReferralLink()` in `src/utils/referralUtils.js`.

### 6.2 Referral Conversion Trace
1. **Link Click**: Buyer clicks affiliate link `https://lumora.co/product/102?ref=SAM2026`.
2. **Click Tracking**: `ReferralRouteHandler.jsx` detects `ref=SAM2026` in URL params.
   - Calls `POST /affiliate/track-click` with `{ referral_code: "SAM2026", product_id: 102 }`.
   - Backend increments `clicks` counter in `affiliates` table for code `SAM2026`.
   - Frontend saves `SAM2026` in `localStorage` under `lumora_affiliate_ref`.
3. **Checkout Conversion**: When buyer completes checkout, `POST /payments/verify` extracts `lumora_affiliate_ref` from headers or payload.
4. **Commission Calculation**: Backend calculates commission (e.g. `20%` of `$49` = `$9.80`), inserts record into `affiliate_commissions` table, and updates `earnings` column in `affiliates` table.

---

# SECTION 7 — DATABASE MODELS & TABLES REFERENCE

The primary database manages 38 relational tables. Key models in `app/models/`:

1. **`User` (`users`)**: Stores core identity (`id`, `firebase_uid`, `email`, `role`, `created_at`).
2. **`Product` (`products`)**: Stores asset metadata (`id`, `vendor_id`, `title`, `price`, `file_key`, `status`, `category`).
3. **`Order` (`orders`)**: Stores transactions (`id`, `user_id`, `total_amount`, `status`, `razorpay_order_id`).
4. **`OrderItem` (`order_items`)**: Line items connecting orders to products (`id`, `order_id`, `product_id`, `price`).
5. **`Wishlist` (`wishlists`)**: User saved items (`id`, `user_id`, `product_id`, `created_at`). Composite unique index on `(user_id, product_id)`.
6. **`Affiliate` (`affiliates`)**: Referral records (`id`, `user_id`, `referral_code`, `commission_rate`, `earnings`, `clicks`, `conversions`).
7. **`Notification` (`notifications`)**: User alerts (`id`, `user_id`, `title`, `message`, `is_read`).

---

# SECTION 8 — FILE STORAGE ARCHITECTURE

- **Cloud Bucket**: Backblaze B2 bucket `lumora-products`.
- **Public vs Private Isolation**:
  - **Public**: Product preview images and thumbnails (`ProductImage.jsx`) served over HTTPS CDN URLs.
  - **Private**: Digital asset source archives (`.zip`, `.pdf`, `.tar.gz`) stored in private paths. Direct bucket URL access returns `403 Access Denied`. Access permitted only via FastAPI streaming proxy `/api/products/download/{token}`.

---

# SECTION 9 — MASTER LIST OF UI BUTTON ACTIONS

| UI Action / Button | Component File | Function Called | API Endpoint | DB Action | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Login** | `Login.jsx` | `handleSubmit` | `POST /auth/firebase-sync` | SELECT/INSERT `users` | Token in `localStorage`, redirect |
| **Wishlist Heart** | `Dashboard.jsx` | `toggleWishlist` | `POST /wishlist/toggle` | INSERT/DELETE `wishlists` | Heart toggles red, toast alert |
| **Add to Cart** | `Dashboard.jsx` | `addToCart` | Local `AppContext` state | None (Session cart) | Cart drawer opens with badge +1 |
| **Buy Now** | `Dashboard.jsx` | `buyNow` | `POST /payments/create-order` | INSERT `orders` | Razorpay checkout modal opens |
| **Header Search** | `Dashboard.jsx` | `handleAISearch` | Local filter + scroll | SELECT `products` | Dropdown results + stream filter |
| **Download File** | `Downloads.jsx` | `handleDownload` | `POST /products/{id}/download-token` | INSERT `product_download_events` | File stream starts in browser |
| **Mark Read Notif** | `Notifications.jsx` | `markAsRead` | `PUT /notifications/{id}/read` | UPDATE `notifications` | Unread badge count decreases |
| **Create Product** | `AddProduct.jsx` | `handleSubmit` | `POST /vendors/products/` | INSERT `products` | Product pending approval state |
| **Copy Ref Link** | `Affiliate.jsx` | `handleCopyLink` | `buildAffiliateReferralLink` | None (Clipboard) | Toast "Referral link copied" |
| **Logout** | `Navbar.jsx` | `handleLogout` | Local storage clear | None | Redirect to landing page |

---

# SECTION 10 — 50+ MOST LIKELY EXTERNAL EXAMINER QUESTIONS & ANSWERS

### Q1: "Where is the primary database for your project located?"
*"In production, Lumora uses PostgreSQL hosted on Render (`lumora_db_k4ni`) connected over SSL. In local development, it uses SQLite (`lumora.db`). Both are managed through SQLAlchemy 2.0 ORM."*

### Q2: "What happens if a customer changes the Product ID in the browser URL bar?"
*"The frontend will attempt to load the product details for that ID. If the user tries to download it without purchasing, the backend API (`POST /products/{id}/download-token`) checks the `order_items` database table for `current_user.id`. Since no completed order exists, the backend returns HTTP 403 Forbidden, blocking the download."*

### Q3: "How does search work in the top navigation header?"
*"When a user types in the `Lumora AI...` input, `headerSearchMatchingProducts` filters the `products` array in real time by title, category, description, and tags. It renders a floating glassmorphism dropdown popover displaying top matching products. Pressing Enter filters the main page discovery stream and scrolls down smoothly."*

### Q4: "Why did you bridge Firebase Auth with custom JWT tokens?"
*"Firebase Auth provides secure frontend client identity (Google/Email authentication). However, to secure our FastAPI microservices and enforce database role permissions, FastAPI issues a custom HMAC-SHA256 signed JWT token upon verification of the Firebase ID Token."*

### Q5: "How are duplicate wishlist additions prevented?"
*"At the database level, the `wishlists` table has a composite unique constraint on `(user_id, product_id)`. At the API level, `wishlist_router.py` queries existing records first—if the item exists, it removes it; if not, it inserts it."*

---

# SECTION 11 — 30 CUSTOMER DASHBOARD ATTACK QUESTIONS

1. **How does the dashboard know who is logged in?**  
   *Answer*: Via `GET /auth/me`. The Bearer token header contains the customer's signed JWT token, which the backend decodes to extract `user_id`.
2. **Which API loads customer orders?**  
   *Answer*: `GET /orders/me` in `app/api/orders/routes.py`.
3. **How is the Wishlist count updated dynamically?**  
   *Answer*: `GET /wishlist/me` returns the user's wishlist array. React sets `stats.wishlistCount = fetchedWishlist.length`.
4. **Is search client-side or server-side?**  
   *Answer*: Product stream search filters client-side from the loaded `products` state for instant sub-millisecond response, while dedicated API search endpoints (`GET /search/`) query database full-text columns.
5. **What happens if a user's token expires while using the dashboard?**  
   *Answer*: `backendFetch` receives HTTP 401, automatically triggers silent refresh via Firebase `getIdToken(true)`, fetches a new JWT token from `/auth/firebase-sync`, and retries the request transparently.

---

# SECTION 12 — FINAL REVISION CHEAT SHEET

### 20 Must-Know Technical Facts
1. **Frontend**: React 18 + Vite 5 + Custom Glassmorphism CSS.
2. **Backend**: FastAPI 0.110 + Uvicorn ASGI Server + Pydantic v2.
3. **Database**: PostgreSQL (Production SOT) / SQLite (Dev) + SQLAlchemy 2.0 ORM.
4. **Auth Flow**: Firebase Auth ID Token $\rightarrow$ `POST /auth/firebase-sync` $\rightarrow$ Lumora Bearer JWT.
5. **Asset Security**: Backblaze B2 Private Bucket + 15-minute single-use HMAC download tokens.
6. **Wishlist Endpoint**: `POST /wishlist/toggle`.
7. **Orders Endpoint**: `GET /orders/me`.
8. **Download Vault Endpoint**: `GET /products/downloads/center`.
9. **Role Isolation**: 4 roles (`customer`, `vendor`, `affiliate`, `admin`) enforced via FastAPI RBAC dependencies.
10. **Payment Gateway**: Razorpay Checkout API + RazorpayX Payout Radar.

---

### 30-Second Project Pitch for Examiner
*"Lumora is a high-performance digital asset marketplace built using React 18 on the frontend and FastAPI with PostgreSQL on the backend. Creators list digital assets like UI kits or software templates, and customers purchase them securely. Identity is managed via Firebase Auth bridged to custom JWT tokens, while digital product archives are protected inside Backblaze B2 private cloud storage and delivered using single-use 15-minute download tokens."*
