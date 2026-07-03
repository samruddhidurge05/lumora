# Lumora — Backend Implementation Report

This report documents the status, design, endpoints, and architecture of the FastAPI, SQLite, and Firestore hybrid backend configuration.

---

## 1. Directory & Routing Architecture

### Mounted Routers (Main Entrypoint: `app/main.py`)
- `/api/auth` -> `app.api.auth_router.router`
- `/api/products` -> `app.api.products_router.router`
- `/api/orders` -> `app.api.orders.router`
- `/api/reviews` -> `app.api.reviews.router`
- `/api/vendors` -> `app.api.vendors.router`
- `/api/wishlist` -> `app.api.wishlist_router.router`
- `/api/cart` -> `app.api.cart_router.router`
- `/api/messages` -> `app.api.messages_router.router`
- `/api/notifications` -> `app.api.notifications_router.router`
- `/api/price-alerts` -> `app.api.price_alerts_router.router`
- `/api/search` -> `app.api.search_router.router`
- `/api/activity` -> `app.api.activity_router.router`
- `/api/history` -> `app.api.history_router.router`
- `/api/versions` -> `app.api.versions_router.router`
- `/api/uploads` -> `app.api.upload_router.router`
- `/api/affiliate` -> `app.api.affiliate.routes.router`
- `/api/admin` -> `app.admin_api.routes.router`

### Dead & Missing Routers
- **admin_controls_vendor** and **admin_controls_affiliate** are isolated python packages inside `backend/`. They are not mounted directly at the root but are wrapped inside `/api/admin`. This preserves modularity.
- **orders synchronization router**: Currently, `app/api/orders/routes.py` manages order creations inside SQLite but does not sync them to Firestore. A sync hook is required.

---

## 2. SQLite Database Models (`app/models/`)

### User Model (`user.py`)
- Table: `users`
- Fields: `id`, `name`, `email`, `password_hash`, `role`, `avatar_url`, `is_active`, `is_verified`, `created_at`, `updated_at`.
- Status synchronization uses the `is_active` flag.

### Product Model (`product.py`)
- Table: `products`
- Fields: `id`, `title`, `description`, `category`, `price`, `rating`, `reviews`, `downloads`, `thumbnail`, `preview`, `file_url`, `seller`, `vendor_id`, `featured`, `trending`, `status`, `tags`, `highlights`, `version`, `file_size`.

### Order & OrderItem Model (`order.py`)
- Table: `orders` & `order_items`
- Fields:
  - `orders`: `id`, `user_id`, `status` (pending|paid|refunded|cancelled), `total_amount`, `currency`, `promo_code`, `discount_amount`, `payment_method`, `payment_id`, `notes`, `created_at`, `updated_at`.
  - `order_items`: `id`, `order_id`, `product_id`, `price_paid`, `download_url`, `downloaded`, `created_at`.

---

## 3. Existing Admin Controls, Middleware & Validators

### Admin Controls
- **Vendor Status change**: `PUT /api/admin/vendors/{uid}/status` updates Firestore `users` & `vendors` documents and syncs SQLite `is_active`.
- **Affiliate Status change**: `PUT /api/admin/affiliates/{uid}/status` updates Firestore `users` & `affiliates` documents and syncs SQLite `is_active`.
- **Platform Pause**: `POST /api/admin/settings/pause` updates `platformSettings/global`'s `isPlatformPaused` to `true`.
- **Platform Resume**: `POST /api/admin/settings/resume` updates `platformSettings/global`'s `isPlatformPaused` to `false`.

### Validators & Dependencies
- `require_admin_role`: Verifies standard JWT credentials and checks that role == `"admin"`.
- `check_platform_paused()`: Blocks requests if `isPlatformPaused` is set to `true`.
- `verify_vendor_active()`: Blocks vendor write commands if vendor is disabled or suspended or platform is paused.
- `verify_affiliate_active()`: Blocks affiliate write commands if affiliate is disabled or suspended or platform is paused.

---

## 4. Firestore Sync Status
- **Products**: SQLite changes (Create/Update/Delete) propagate to the `products` collection via `sync_product_to_firestore` and `delete_product_from_firestore`.
- **Orders**: SQLite creations inside the customer storefront `/api/orders/` checkout endpoint do not currently sync to the Firestore `orders` collection. This must be synced in Phase 3.
