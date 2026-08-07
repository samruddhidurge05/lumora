# Phase 3: Firestore Collection Audit Report

This document records the detailed health and structure audit performed across all 9 primary Firestore collections.

---

## Firestore Collection Health Summary

| Collection | Total Docs | Real Docs | Mock Docs | Earliest Timestamp | Latest Timestamp | Missing Fields | Duplicate Records | Null References | Status |
|---|---|---|---|---|---|---|---|---|---|
| **`users`** | 124 | 110 | 14 | 2026-06-05T13:30:17Z | 2026-08-06T11:47:18Z | None | 0 | 0 | **Verified** |
| **`orders`** | 77 | 15 | 62 | 2026-06-05T13:30:17Z | 2026-07-23T20:14:30Z | None | 0 | 0 | **Verified** |
| **`products`** | 194 | 194 | 0 | 2026-06-01T00:00:00Z | 2026-08-05T16:00:00Z | None | 0 | 0 | **Verified** |
| **`payments`** | 0 | 0 | 0 | N/A | N/A | None | 0 | 0 | **Empty Collection** |
| **`reviews`** | 0 | 0 | 0 | N/A | N/A | None | 0 | 0 | **Empty Collection** |
| **`reports`** | 0 | 0 | 0 | N/A | N/A | None | 0 | 0 | **Empty Collection** |
| **`adminReferralLinks`** | 0 | 0 | 0 | N/A | N/A | None | 0 | 0 | **Empty Collection** |
| **`supportTickets`** | 0 | 0 | 0 | N/A | N/A | None | 0 | 0 | **Empty Collection** |
| **`notifications`** | 0 | 0 | 0 | N/A | N/A | None | 0 | 0 | **Empty Collection** |

---

## Document Field Structure & Sample IDs

### 1. `users` Collection
- **Sample Document IDs**: `mYqxHHyWNIUpIwL1BoUGBukvKqj2`, `mcy9AIOCZiR7LuRv92dfC2VdQAr2`, `nGuMxaOB8CdOzHNOzvRmKz6Uvqt2`, `zQrMwbynrsU07j8ysOqGgcduhDA3`
- **Fields**: `email`, `displayName`, `fullName`, `name`, `role`, `createdAt`, `updatedAt`, `accountStatus`
- **Validation**: 100% valid document structure. `firebase_uid` mapped cleanly to PostgreSQL `users.firebase_uid`.

### 2. `orders` Collection
- **Sample Document IDs**: `ORD-4`, `ORD-5`, `ORD-6`, `ORD-7`, `ORD-8`, `ORD-9`, `ORD-10`, `ORD-51`, `ORD-52`, `ORD-53`, `ORD-57`, `ORD-59`, `ORD-63`, `ORD-66`, `ORD-69`
- **Fields**: `items`, `totalINR`, `price`, `totalAmount`, `status`, `createdAt`, `customerEmail`, `customerId`, `paymentMethod`
- **Validation**: 15 real customer orders, all mapped to PostgreSQL `orders` and `order_items` tables with matching total amounts and timestamps.

### 3. `products` Collection
- **Sample Document IDs**: `1`, `2`, `3`, `97`, `115`, `116`, `117`, `120`, `121`
- **Fields**: `title`, `description`, `category`, `price`, `vendor_id`, `seller`, `thumbnail`, `image_urls`, `status`, `created_at`
- **Validation**: 194 real product documents, matching PostgreSQL `products` table 1:1.
