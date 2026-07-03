# Lumora — Firestore Synchronization Audit

This document presents the collection ownership, reads, writes, and real-time listeners for Firestore database synchronization.

---

## Firestore Collection Catalog & Data Flow

| Collection | Written By | Read By | Listeners (onSnapshot) | Master Database |
| :--- | :--- | :--- | :--- | :--- |
| **users** | Auth Service, Admin Controllers | Dashboards, Auth Module | Admin, Vendor, Affiliate Dashboards | SQLite (Users table) |
| **products** | Products API, Admin API | Customer Storefront, Vendor | Customer, Vendor, Admin Dashboards | SQLite (Products table) |
| **orders** | Storefront Checkout API | Customer, Admin Dashboards | Payments Telemetry, Admin | SQLite (Orders table) |
| **platformSettings** | Settings Admin API | Status Checks Validator | Platform Telemetry Subscription | Firestore (Single source) |
| **vendorNotifications**| Order Checkout, System | Vendor Dashboard | Vendor Alerts Module | Firestore (Realtime messaging) |
| **affiliateLinks** | Affiliate Link Service | referral handler | Affiliate Referral Listener | SQLite (Profiles/Links) |
| **affiliateConversions**| Order Checkout, System | Affiliate Dashboard | Affiliate earnings tracker | SQLite (Commissions) |
| **affiliateActivity** | Affiliate clicks tracker | Dashboard Analytics | Affiliate Activity Panel | SQLite (Clicks) |
| **affiliatePayoutRequests**| Affiliate request API | Admin payout manager | Admin Payout Monitor | SQLite (Payout requests) |
| **reports** | Customer Dispute API | Admin Dashboard | Admin Reports Moderator | Firestore (Single source) |
| **reviews** | Customer Reviews API | Product listings | Reviews Moderation Monitor | SQLite (Reviews table) |

---

## Detailed Collection Audit

### 1. `users`
- **Writes**: Firebase Auth creation, backend `firebase-sync` endpoint, and `update_vendor_status` / `update_affiliate_status` Admin endpoints.
- **Listeners**: Frontend `AuthContext.jsx` and `Vendors.jsx`.

### 2. `products`
- **Writes**: SQLite CRUD endpoints (`products_router.py` and `admin/routes/products.py`) propagate updates immediately to mirror changes in Firestore.
- **Listeners**: Customer catalog pages, Vendor dashboard inventory, and Admin `ProductsManagement.jsx`.

### 3. `orders`
- **Writes**: Front-end checkout simulator (`ecosystemService.js`) and back-end orders checkout router (`orders/routes.py`) write SQLite records and sync to Firestore orders.
- **Listeners**: Admin Dashboard Payments Telemetry and Reports.

### 4. `platformSettings`
- **Writes**: Admin controls Settings API (`/api/admin/settings/pause` and `/resume`).
- **Listeners**: Platform monitor script in frontend (`platformService.js`).
