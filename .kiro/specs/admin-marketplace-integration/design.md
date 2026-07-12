## Admin Marketplace Integration — Design
**Phase:** Admin Dashboard Production Completion (Phase 3)
**Project:** Lumora Digital Marketplace
**Date:** July 10, 2026
**Based on:** requirements.md + production readiness audit evidence

---

## Overview

This document describes the technical design for closing five production gaps in the Lumora Digital Marketplace Admin Dashboard. The gaps were identified during the production readiness audit after Phase 2 (M0–M6) was completed. Each gap is independent and can be implemented and rolled back without affecting the others.

The five gaps are:
1. `firestore.Increment` NameError — crashes order Firestore sync
2. Review ↔ Firestore synchronization — admin Reviews shows 0 when Firebase is connected
3. Customer Report submission — no endpoint or UI exists
4. Draft product Firestore visibility leak — draft products surface in customer marketplace
5. Customer Support system — SupportCenter uses hardcoded `seller_id:2` and localStorage-only status

---

## Architecture

### Data Storage Architecture

The marketplace uses a **dual-database hybrid pattern**:
- **SQLite (authoritative)** — All transactional data: users, products, orders, reviews, order items, affiliate commissions, withdrawals, payments, conversations, messages
- **Firestore (real-time + sync)** — Real-time UI subscriptions: products, orders, reviews, reports, vendorStats, vendorNotifications, purchases, downloads, adminReferralLinks, platformSettings
- **Sync mechanism** — Backend writes to SQLite first (commit), then best-effort Firestore sync (non-blocking)

### Existing Data Flows (Verified)

```
Customer Purchase Flow (current):
  Customer → POST /api/orders/ → PurchaseService.process_purchase()
    → SQLite: Order, OrderItem, AffiliateCommission created
    → sync_order_to_firestore(order, db) called
      → Firestore: orders/{id} ✅
      → Firestore: purchases/{id} ✅ (before crash)
      → Firestore: downloads/{id} ✅ (before crash)
      → Firestore: vendorNotifications/{id} ✅ (before crash)
      → Firestore: vendorStats/{v_id}.update({Increment}) ❌ NameError CRASH

Customer Review Flow (current):
  Customer → POST /api/reviews/ → SQLite: Review created
    → product.rating recalculated ✅
    → vendor.rating recalculated ✅
    → vendor notification created ✅
    → Firestore: NOTHING WRITTEN ❌

Customer Report Flow (current):
  Customer → NO ENDPOINT EXISTS ❌

Customer Support Flow (current):
  Customer → SupportCenter.jsx → POST /api/messages/conversations
    → seller_id: 2 HARDCODED (not admin) ❌
    → status stored in localStorage only ❌
    → no type column on Conversation model ❌

Product Visibility Flow (current):
  AppContext.jsx Step 1: GET /api/products/ → SQLite published-only → ✅
  AppContext.jsx Step 2: onSnapshot(collection('products')) → NO STATUS FILTER ❌
```

### Proposed Data Flows (Post-Fix)

```
Customer Purchase Flow (fixed):
  sync_order_to_firestore() — all 6 Firestore writes succeed ✅

Customer Review Flow (fixed):
  POST /api/reviews/ → SQLite commit → sync_review_to_firestore() ← NEW ✅

Customer Report Flow (new):
  POST /api/reports/ → Firestore: reports/{id} ✅

Customer Support Flow (new):
  POST /api/support/ → SQLite: Conversation(type='support_ticket') + Message ✅
  GET /admin/support/tickets → admin inbox ✅
  POST /admin/support/{id}/reply → Message(sender_id=admin.id) ✅
  Customer polls GET /api/support/{id}/messages → admin reply visible ✅

Product Visibility Flow (fixed):
  AppContext.jsx: onSnapshot(query(collection('products'), where('status','==','published'))) ✅
```

---

## Components and Interfaces

### Backend Components

| Component | File | Type | Purpose |
|-----------|------|------|---------|
| Firestore Import Fix | `backend/admin/firestore/admin_firestore.py` | Fix | Add `from firebase_admin import firestore` |
| Review Sync | `backend/app/api/reviews/routes.py` | Extend | `sync_review_to_firestore()` after SQLite commit |
| Customer Reports API | `backend/app/api/reports/routes.py` | New file | `POST /api/reports/`, `GET /api/reports/me` |
| Customer Support API | `backend/app/api/support/routes.py` | New file | Ticket create, list, reply endpoints |
| Admin Support API | `backend/app/admin_api/support/routes.py` | New file | Admin inbox, reply, status endpoints |
| Conversation Model Extension | `backend/app/models/conversation.py` | Extend | 6 new nullable columns |
| Support Schemas | `backend/app/schemas/schemas.py` | Extend | `SupportTicketCreate`, `SupportTicketResponse` |
| Router Registration | `backend/app/main.py` | Extend | Register 2 new support routers |

### Frontend Components

| Component | File | Type | Purpose |
|-----------|------|------|---------|
| Draft Product Filter | `frontend/src/context/AppContext.jsx` | Fix | `where('status','==','published')` on Firestore query |
| Report Modal | `frontend/src/pages/marketplace/ProductPage.jsx` | Extend | "Report this product" button + inline modal |
| Review Analytics Fix | `frontend/src/services/reviewAnalyticsService.js` | Fix | Remove `DEFAULT_REVIEW_ANALYTICS` fallback |
| SupportCenter Rewire | `frontend/src/pages/customer/SupportCenter.jsx` | Rewire | Fix `seller_id:2`, replace localStorage, use `/api/support/` |
| Admin Support Inbox | `frontend/src/pages/admin/AdminSupportInbox.jsx` | New file | Ticket list, thread view, reply, status controls |
| Admin Sidebar | `frontend/src/pages/admin/components/AdminSidebar.jsx` | Extend | "Support" nav group + "Support Inbox" link |
| App Router | `frontend/src/App.jsx` | Extend | `/admin/support` route + lazy import |
| Support Service | `frontend/src/services/supportService.js` | New file | API calls for customer support endpoints |

### API Interfaces

**New Customer Endpoints**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/reports/` | Customer JWT | Submit product report to Firestore |
| GET | `/api/reports/me` | Customer JWT | Get own submitted reports |
| POST | `/api/support/` | Customer JWT | Create support ticket |
| GET | `/api/support/me` | Customer JWT | List own support tickets |
| GET | `/api/support/{id}/messages` | Customer JWT | Get ticket message thread |
| POST | `/api/support/{id}/reply` | Customer JWT | Send reply to ticket |

**New Admin Endpoints**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/support/tickets` | Admin JWT | List all support tickets |
| GET | `/admin/support/{id}/messages` | Admin JWT | Get ticket thread |
| POST | `/admin/support/{id}/reply` | Admin JWT | Admin reply to ticket |
| PUT | `/admin/support/{id}/status` | Admin JWT | Change ticket status |

**Unchanged Endpoints**

All existing admin endpoints (`/admin/reports/*`, `/admin/reviews/*`, `/admin/analytics/*`) and all vendor messaging endpoints (`/api/messages/*`) remain unchanged in both request and response contracts.

---

## Data Models

### SQLite — Conversation Model Extension (Requirement 5 only)

Six new nullable columns added to the existing `conversations` table. All existing vendor chat rows receive safe defaults — zero data loss:

```sql
ALTER TABLE conversations ADD COLUMN type        VARCHAR NOT NULL DEFAULT 'vendor_chat';
ALTER TABLE conversations ADD COLUMN status      VARCHAR NOT NULL DEFAULT 'open';
ALTER TABLE conversations ADD COLUMN category    VARCHAR;
ALTER TABLE conversations ADD COLUMN title       VARCHAR;
ALTER TABLE conversations ADD COLUMN assigned_to INTEGER REFERENCES users(id);
ALTER TABLE conversations ADD COLUMN resolved_at DATETIME;
```

**Type values:** `'vendor_chat'` (existing rows) | `'support_ticket'` (new support tickets)
**Status lifecycle:** `'open'` → `'pending'` → `'resolved'` → `'closed'`

No existing query breaks — `messages_router.py` filters by `buyer_id`/`seller_id` only, never by `type`.

### SQLite — No Other Schema Changes

Requirements 1–4 use existing models without schema changes. The `reviews`, `orders`, `messages` tables are unchanged.

### Firestore — `reports` Collection

Documents written by customer via `POST /api/reports/` (previously always empty):

```json
{
  "title": "Licensing Violation — Product Name",
  "reporter": "Customer Name",
  "reporterEmail": "customer@email.com",
  "reporterId": "123",
  "productId": "456",
  "productTitle": "Product Name",
  "category": "Licensing Violation",
  "description": "Customer's description text",
  "severity": "high",
  "status": "Pending",
  "assignee": "Unassigned",
  "createdAt": "2026-07-10T00:00:00Z",
  "resolvedAt": null
}
```

### Firestore — `reviews` Collection

Documents synced from SQLite after customer review submission (previously never written):

```json
{
  "id": "42",
  "customer": "Customer Name",
  "comment": "Review text",
  "product": "Product Title",
  "productId": "5",
  "userId": "12",
  "rating": 5,
  "sentiment": "positive",
  "date": "2026-07-10T00:00:00Z",
  "verified": true,
  "flagged": false
}
```

---

## Gap Analysis

### Gap 1 — `firestore.Increment` NameError

**Root cause:** `admin_firestore.py` uses `firestore.Increment()` but only imports `db` and `firebase_connected`. The `firestore` SDK object was never imported.

**Fix:** Add `from firebase_admin import firestore` to `admin_firestore.py` imports. No architecture change required.

---

### Gap 2 — Review ↔ Firestore Synchronization

**Root cause:** `POST /api/reviews/` writes to SQLite only. No Firestore sync was ever implemented. Admin Reviews dashboard reads Firestore `reviews` collection → shows 0 when Firebase is connected.

**Fix:** Add `sync_review_to_firestore()` non-blocking call after `db.commit()` in `create_review()`.

---

### Gap 3 — Customer Report Submission System

**Root cause:** No customer-facing report system exists. Admin Reports page reads Firestore `reports` but nothing writes to it from the customer side.

**Fix:** New `POST /api/reports/` endpoint + "Report this product" modal on `ProductPage.jsx`.

---

### Gap 4 — Draft Product Firestore Visibility Fix

**Root cause:** `AppContext.jsx` subscribes to `collection(db, 'products')` with no status filter. Draft products surface in the customer marketplace via Firestore.

**Fix:**
```javascript
// BEFORE
const q = query(collection(db, 'products'));
// AFTER
const q = query(collection(db, 'products'), where('status', '==', 'published'));
```

Single-field equality query — no composite Firestore index required.

---

### Gap 5 — Customer Support System (SupportCenter Not Production-Ready)

**Root cause:** Three compounding problems:
1. `seller_id: 2` hardcoded — tickets go to a random user, not admin
2. Ticket status stored in `localStorage` only — lost on refresh, not queryable
3. `Conversation` model has no `type` column — cannot distinguish support tickets from vendor chats at the DB level

**Fix architecture:**

```
Conversation model — 6 new nullable columns (additive migration)

Customer → POST /api/support/
  → SQLite: Conversation (type='support_ticket', seller_id=admin.id, title, category)
  → SQLite: Message (sender_id=customer.id, content=description)
  → 201 { ticket_id }

Admin → GET /admin/support/tickets
  → SELECT conversations WHERE type='support_ticket' ORDER BY updated_at DESC
  → 200 [ticket list with customer names and status]

Admin → POST /admin/support/{id}/reply
  → INSERT messages (sender_id=admin.id, content)  ← same messages table
  → UPDATE conversations SET status='pending'

Customer polls GET /api/support/{id}/messages (4s interval)
  → Admin reply appears in SupportCenter thread ✅

Admin → PUT /admin/support/{id}/status { status: "resolved" }
  → UPDATE conversations SET status='resolved', resolved_at=now()

Customer polls GET /api/support/me
  → Ticket shows "Resolved" from API, not localStorage ✅
```

**Bidirectionality:** Both sides use the same `conversations` + `messages` SQLite tables. Admin writes a `Message` with `sender_id=admin.id` — customer's 4-second poll fetches it. No WebSockets needed — polling matches the existing `MessagesCenter.jsx` pattern.

**Vendor messaging impact:** Zero. `messages_router.py` filters by `buyer_id`/`seller_id` and never touches `type`. Existing vendor chat conversations receive `type='vendor_chat'` by default.

---

## Correctness Properties

### Property 1: Firestore sync is non-blocking
SQLite commit always succeeds before any Firestore write is attempted. Firebase unavailability never causes a customer-visible error on purchase, review, or support ticket creation.

**Validates: Requirements 1.3, NFR-1, NFR-5**

### Property 2: Support ticket seller_id is always the real admin
POST /api/support/ resolves admin ID via a live database query at request time. The integer value 2 is never hardcoded as a seller_id.

**Validates: Requirements 5.3, 5.12**

### Property 3: Existing vendor chat conversations are unaffected
The type column defaults to vendor_chat for all existing rows. No existing query in messages_router.py filters on type, so all vendor messaging continues unchanged.

**Validates: Requirements 5.4, 5.16, NFR-4**

### Property 4: Admin reply is stored under admin identity
POST /admin/support/{id}/reply sets sender_id from the authenticated admin JWT. This value cannot be spoofed by a customer.

**Validates: Requirements 5.8, 5.15, NFR-3**

### Property 5: Draft products are never surfaced to customers
The Firestore status filter is server-evaluated. The backend REST path independently filters by status. Both paths agree — draft products are invisible to customers via both channels.

**Validates: Requirements 4.1, 4.2, 4.4**

### Property 6: Rate limits are enforced per user
Report submissions are capped at 3 per product per 24h. Support ticket creation is capped at 5 per customer per 24h. Limits are checked server-side and cannot be bypassed from the frontend.

**Validates: Requirements 3.5, 5.14**

---

## Error Handling

| Scenario | Handling |
|----------|---------|
| Firebase unavailable during review sync | `try/except` swallows error; SQLite review still returns 201 |
| Firebase unavailable during report submission | Returns HTTP 503 with clear message |
| Firebase unavailable during support ticket | Support ticket still stored in SQLite; status/messages available via polling |
| `firestore.Increment` NameError | Fixed by import — no longer possible |
| Rate limit exceeded (reports) | HTTP 429 with wait message |
| Rate limit exceeded (support tickets) | HTTP 429 with wait message |
| Invalid ticket status transition | HTTP 400 — only valid values accepted |
| Admin reply to non-existent ticket | HTTP 404 |
| Customer accessing another customer's ticket | HTTP 403 — `buyer_id` check enforced |

---

## Testing Strategy

### P3-M1 (Firestore Increment Fix)
- `python -c "from app.main import app; print('OK')"` — backend compiles
- `python -c "from admin.firestore.admin_firestore import sync_order_to_firestore; print('OK')"` — import chain works

### P3-M2 (Draft Product Filter)
- Static verification: published product appears in marketplace, draft product does not
- `npm run build` — frontend compiles

### P3-M3 (Review Firestore Sync)
- Submit a review via `POST /api/reviews/` → verify Firestore `reviews/{id}` document created
- Admin Reviews page shows the review when Firebase connected
- `reviewAnalyticsService.js` has no `DEFAULT_REVIEW_ANALYTICS` constant

### P3-M4 (Customer Report)
- `POST /api/reports/` with valid JWT → 201 response
- `POST /api/reports/` without JWT → 401
- Firestore `reports/{id}` document matches expected schema
- Admin Reports page shows the submitted report

### P3-M5 (Support Schema)
- Backend compiles after migration
- Existing vendor chat conversations still load via `GET /api/messages/conversations`

### P3-M6 (Customer Support API)
- `POST /api/support/` → 201 with `ticket_id`
- `GET /api/support/me` → returns customer's tickets
- Ticket `seller_id` equals real admin user ID, not `2`

### P3-M7 (Admin Support API)
- `GET /admin/support/tickets` → returns all support tickets
- `POST /admin/support/{id}/reply` → message stored with `sender_id=admin.id`
- Customer polling `GET /api/support/{id}/messages` returns the admin reply

### P3-M8 (SupportCenter Rewire)
- New ticket created → no more `seller_id:2` in network requests
- Ticket status reflects API response, not localStorage

### P3-M9 (Admin Support Inbox)
- `/admin/support` route accessible with admin JWT
- Ticket list loads, thread opens, reply sends, status changes

---

## Rollback Strategy

Each fix is independent:

| Fix | Rollback |
|-----|---------|
| Firestore Increment import | Remove the added import line |
| Review Firestore sync | Remove `sync_review_to_firestore()` call from reviews route |
| Customer report endpoint | Remove router registration from `main.py` |
| Draft product filter | Revert `where()` clause in `AppContext.jsx` |
| Conversation schema extension | SQLite `ALTER TABLE DROP COLUMN` (or ignore new columns — defaults make rows valid either way) |
| Support routers | Remove `include_router` lines from `main.py` |
| SupportCenter rewire | Revert to previous `seller_id:2` version |
| AdminSupportInbox + sidebar | Remove lazy import + route + sidebar item |

---

## Regression Analysis

### Systems Confirmed Untouched

| System | Modified? | Reason |
|--------|----------|--------|
| Customer authentication | No | No auth files touched |
| Vendor authentication | No | No auth files touched |
| Affiliate authentication | No | No auth files touched |
| Google OAuth / JWT | No | No auth flow changes |
| ProtectedRoute | No | No route protection changes |
| Marketplace checkout | No | Order creation not modified |
| Existing order flow | No | Only `admin_firestore.py` sync function fixed |
| Payments | No | No payment logic touched |
| Admin M0–M6 features | No | All existing admin pages unchanged |
| PromotionsManagement | No | Explicitly protected |
| Campaign Management | No | Explicitly protected |
| Referral Links | No | Not affected |
| Analytics page | No | Reviews sync improves analytics accuracy |
| Audit Logs | No | Audit writing continues unchanged |
| `messages_router.py` | No | Vendor messaging endpoints untouched |
| `MessagesCenter.jsx` | No | Vendor chat UI untouched |
| `messageService.js` | No | Firestore conversation service untouched |
| Existing `conversations` rows | No | Migration adds nullable columns with defaults — zero data loss |

### AppContext.jsx Risk

The `where('status', '==', 'published')` change is the highest-risk change. The backend REST call (Step 1) always runs first and returns all SQLite published products. Firestore supplements — it does not replace. Risk: LOW. Regression probability: ~1%.

---

## Impact on Protected Systems

| System | Impact | Direction |
|--------|--------|-----------|
| Customer Marketplace | Draft products no longer leak | Positive |
| Vendor Dashboard | `vendorStats` now correctly increments | Positive |
| Affiliate Dashboard | `affiliateConversions` sync now completes | Positive |
| Authentication | None | Zero |
| Vendor Messaging | None — untouched | Zero |
| Customer Support | Now production-ready | Positive |
| Admin Support | New inbox added | Positive |
