# Requirements Document

**Phase:** Admin Dashboard Production Completion (Phase 3)
**Project:** Lumora Digital Marketplace
**Date:** July 10, 2026
**Prerequisite:** Admin Dashboard Phase 2 (M0–M6) complete
**Current Production Score:** 86/100
**Target Production Score:** 100/100

---

## Introduction

The Admin Dashboard implementation (M0–M6) is 86% production-ready. The remaining 14% consists of four genuine production gaps that prevent end-to-end marketplace administration:

1. **Firestore `firestore.Increment` NameError** — Critical runtime bug crashing all vendor stat syncs on order placement
2. **Review ↔ Firestore synchronization gap** — Customer reviews written to SQLite are never synced to Firestore; admin dashboard shows 0 reviews when Firebase is connected
3. **Customer Report submission missing** — No model, no backend endpoint, no customer-facing UI for reporting products/vendors
4. **Draft product Firestore visibility leak** — Firestore `onSnapshot` in `AppContext.jsx` has no `status == "published"` filter; draft products can surface in customer marketplace

These are NOT regressions from M0–M6. They are pre-existing gaps now surfaced by the production readiness audit. This specification defines what must be built to bring the Admin Dashboard to 100% production readiness.

### Business Context

The marketplace requires that admin actions (product publishing, moderation) reliably propagate to customers, vendor order stats are accurate, and customers can both submit reviews/reports and trust that those items are visible to administrators. Without these capabilities, the platform cannot be considered production-complete.

### Scope

This phase focuses exclusively on the four identified integration gaps. No new features beyond what is required to close the audit gaps will be introduced.

---

## Requirements

### Requirement 1: Firestore vendorStats Integrity Fix

**Priority:** Critical
**Category:** Data Integrity

**User Story:** As a vendor, when a customer purchases my product, I want my sales statistics and notifications to be updated correctly so that I can track my store performance accurately.

**1.1** When a customer completes a purchase, `sync_order_to_firestore()` MUST successfully update `vendorStats/{vendor_id}` in Firestore without throwing a `NameError`.

**1.2** The `firestore.Increment` function MUST be imported correctly from `firebase_admin.firestore` before use in `admin_firestore.py`.

**1.3** On order sync failure, the error MUST be logged but MUST NOT roll back the SQLite order transaction. The customer's purchase must always succeed.

**1.4** Vendor notifications MUST be written to Firestore `vendorNotifications/{id}` for each sale.

**1.5** Customer purchase records MUST be written to Firestore `purchases/{id}`.

**1.6** Customer download records MUST be written to Firestore `downloads/{user_id}_{product_id}`.

#### Acceptance Criteria

- Customer completes a purchase → `vendorStats/{vendor_id}.totalSales` increments by 1
- Customer completes a purchase → `vendorNotifications/{id}` document written
- Customer completes a purchase → `purchases/{id}` and `downloads/{id}` documents written
- No `NameError` in backend logs on order sync
- SQLite order creation still succeeds when Firebase is unavailable

---

### Requirement 2: Review Firestore Synchronization

**Priority:** High
**Category:** Admin Operations Accuracy

**User Story:** As an admin, when I open the Reviews page, I want to see real customer reviews submitted after purchases so that I can moderate them effectively.

**2.1** When a customer submits a review via `POST /api/reviews/`, the review MUST be synced to Firestore `reviews/{review_id}` after SQLite commit.

**2.2** The Firestore review document MUST include: `customer` (user.name), `comment`, `product` (product.title), `rating`, `sentiment`, `date`, `verified`, `flagged: false`, `productId` (as string), `userId` (as string).

**2.3** When admin moderates a review (flag/unflag/delete), the Firestore `reviews/{id}` document MUST be updated or deleted accordingly. This already exists — no change needed if the document exists after 2.1 is implemented.

**2.4** Admin Reviews dashboard (`GET /admin/reviews/dashboard`) MUST show aggregated real data from SQLite in both Firebase-connected and offline states.

**2.5** The `reviewAnalyticsService.js` `DEFAULT_REVIEW_ANALYTICS` fallback MUST be removed. API errors MUST propagate to the caller.

#### Acceptance Criteria

- After customer submits review → review appears in Firestore `reviews/{id}`
- Admin opens Reviews page with Firebase connected → sees real customer reviews (not empty)
- Admin moderates (deletes) a review → removed from both SQLite and Firestore
- `reviewAnalyticsService.js` no longer returns `DEFAULT_REVIEW_ANALYTICS` hardcoded data

---

### Requirement 3: Customer Report Submission System

**Priority:** High
**Category:** Trust & Safety

**User Story:** As a customer, I want to be able to report a product that violates platform rules so that the admin team can investigate and take action, keeping the marketplace safe.

**3.1** A customer MUST be able to submit a report from the product detail page (`ProductPage.jsx`).

**3.2** A report form MUST include: `category` (dropdown: Licensing Violation, Defective Product, Spam/Fraud, Inappropriate Content, Copyright Infringement, Other), `description` (text, minimum 10 characters, maximum 2000 characters). The `product_id` is captured automatically from the current page context.

**3.3** A backend endpoint `POST /api/reports/` MUST accept authenticated report submissions and write them to Firestore `reports` collection.

**3.4** The Firestore `reports` document MUST include: `title` (auto-generated from category + product name), `reporter` (customer name), `reporterEmail`, `reporterId`, `productId`, `productTitle`, `category`, `description`, `severity` (auto-mapped from category), `status: "Pending"`, `createdAt`, `assignee: "Unassigned"`.

**3.5** A customer MUST be rate-limited to 3 reports per product per 24 hours.

**3.6** Admin Reports page (`Reports.jsx`) MUST show reports submitted by customers via 3.3. No change to the admin page is needed — it already reads from Firestore `reports` collection.

**3.7** Admin MUST be able to resolve, reject, assign, and delete reports. These actions already exist in the backend and frontend.

**3.8** Report submission MUST require a valid customer JWT. Unauthenticated requests MUST return HTTP 401.

**3.9** Report submission MUST return HTTP 503 when Firebase/Firestore is unavailable.

#### Acceptance Criteria

- "Report this product" button visible on product detail page
- Customer fills form (category + description) → submits → 201 response
- Report appears in Firestore `reports` collection within 2 seconds
- Admin opens Reports page → sees the submitted report
- Admin can resolve/reject the report
- Customer cannot submit more than 3 reports per product per 24 hours
- Purchase flow, cart, and checkout are completely unaffected

---

### Requirement 4: Draft Product Marketplace Visibility Fix

**Priority:** High
**Category:** Product Lifecycle Integrity

**User Story:** As an admin, when I create a draft product, I want it to be invisible to customers until I explicitly publish it, so that incomplete products are never shown in the marketplace.

**4.1** The Firestore `products` subscription in `AppContext.jsx` MUST only include products with `status == "published"`.

**4.2** The Firestore query MUST use `where("status", "==", "published")` as a server-side filter applied before the `onSnapshot` subscription.

**4.3** The backend REST products endpoint (`GET /api/products/`) already filters by `status == "published"` — no change required to the backend.

**4.4** Admin-created draft products MUST NOT appear in the customer marketplace until the admin explicitly publishes them.

**4.5** Admin Products Management page (`ProductsManagement.jsx`) uses a separate Firestore listener that shows ALL products (including drafts) — this MUST remain unchanged.

#### Acceptance Criteria

- Admin creates a product with status=Draft → does NOT appear in customer marketplace
- Admin publishes the product → within 5 seconds appears in customer marketplace via Firestore real-time
- Existing published products continue to appear normally
- Backend REST API continues to filter by `status == "published"` (unchanged)
- Admin product management panel still shows all products including drafts (unchanged)

---

### Requirement 5: Customer Support Communication System

**Priority:** High
**Category:** Customer Operations & Trust

**User Story:** As a customer, I want to be able to submit a support ticket and receive a reply from an admin within the same thread, so that I can get help with issues and track resolution status. As an admin, I want to see all incoming support tickets in a dedicated inbox so that I can respond to customers efficiently.

**5.1** A customer MUST be able to create a support ticket from the SupportCenter (`Customer Dashboard → Support Center → Tickets tab`) by providing a `title`, `category` (dropdown), and `description`.

**5.2** Support ticket categories MUST be: `Download Assistance`, `Billing Issue`, `Customization Request`, `General Query`, `Technical Issue`, `Other`.

**5.3** On submission, a `Conversation` record MUST be created in SQLite with `type = "support_ticket"`, `status = "open"`, and `seller_id` set to the real admin user ID (not hardcoded `2`). A first `Message` record containing the customer's description is created immediately in the same transaction.

**5.4** The `Conversation` model MUST be extended with the following new nullable columns (additive, non-breaking): `type` (VARCHAR, default `'vendor_chat'`), `status` (VARCHAR, default `'open'`), `category` (VARCHAR), `title` (VARCHAR), `assigned_to` (INTEGER FK → users.id, nullable), `resolved_at` (DATETIME, nullable). All existing vendor chat rows receive the default values — zero data loss.

**5.5** A customer MUST be able to view all their own support tickets and open any ticket to see the full message thread.

**5.6** A customer MUST be able to send follow-up replies within an open or pending ticket via `POST /api/support/{ticket_id}/reply`.

**5.7** An admin MUST have a dedicated Support Inbox page (`/admin/support`) showing all support tickets from all customers, ordered by `updated_at` descending.

**5.8** Admin MUST be able to open a ticket, read the full thread, and send a reply. Admin reply is stored as a `Message` with `sender_id = admin.id`. The customer's SupportCenter thread updates automatically on next poll (4-second interval, same as MessagesCenter).

**5.9** Admin MUST be able to change ticket status: `open` → `pending` → `resolved` → `closed`. Status change MUST be persisted to the `conversations.status` column in SQLite.

**5.10** When admin resolves a ticket, `conversations.resolved_at` MUST be set to the current UTC timestamp.

**5.11** The customer's SupportCenter ticket list MUST display real status from the backend (`open`, `pending`, `resolved`, `closed`) — NOT from `localStorage`. The `localStorage` fallback for status MUST be removed.

**5.12** The hardcoded `seller_id: 2` in `SupportCenter.jsx` MUST be replaced with a dynamic lookup of the admin user ID from the backend.

**5.13** The `Contact.jsx` page MUST remain unchanged. It is a static informational form and is NOT wired to the support ticket system (it serves a separate UX purpose).

**5.14** Rate limiting: a customer MUST NOT be able to submit more than 5 support tickets within any 24-hour window.

**5.15** All new support endpoints MUST require a valid JWT. Unauthenticated requests return HTTP 401.

**5.16** The existing vendor messaging system (`messages_router.py`, `MessagesCenter.jsx`, `messageService.js`) MUST remain completely untouched. Support tickets and vendor chats are separate entry points writing to the same underlying model with different `type` values.

#### Acceptance Criteria

- Customer opens SupportCenter → clicks "New Ticket" → fills form → submits → 201 response
- Ticket appears in customer's ticket list with status "open"
- Admin opens `/admin/support` → sees the ticket in inbox
- Admin opens ticket → sees customer's message thread
- Admin types reply → sends → reply stored with `sender_id = admin.id`
- Customer polls next tick (≤4s) → admin reply appears in thread
- Admin changes status to "resolved" → `conversations.status = 'resolved'`, `resolved_at` set
- Customer's ticket list shows "Resolved" (from API, not localStorage)
- Vendor chat (`MessagesCenter.jsx`) continues to work completely unchanged
- `seller_id: 2` no longer hardcoded anywhere in SupportCenter
- Backend compiles without errors after schema extension
- Frontend builds without errors

---

## Non-Functional Requirements

**NFR-1** Firestore sync failures MUST be non-blocking — SQLite commit must always succeed first. No customer-visible errors should result from Firebase being unavailable.

**NFR-2** Report submission must respond in under 2 seconds at the 95th percentile.

**NFR-3** All new backend endpoints must be JWT-protected. Unauthenticated requests must return HTTP 401.

**NFR-4** No customer, vendor, or affiliate workflow may be broken by any change in this phase. Zero regression tolerance.

**NFR-5** All Firestore writes must be guarded by `if firebase_connected and db is not None` to preserve offline capability.

---

## API Requirements

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/reports/` | Customer JWT | Submit a product/vendor report |
| GET | `/api/reports/me` | Customer JWT | Get customer's own submitted reports |
| POST | `/api/support/` | Customer JWT | Create a new support ticket |
| GET | `/api/support/me` | Customer JWT | Get customer's own support tickets |
| GET | `/api/support/{id}/messages` | Customer JWT | Get messages in a support ticket thread |
| POST | `/api/support/{id}/reply` | Customer JWT | Send a reply in a support ticket thread |
| GET | `/admin/support/tickets` | Admin JWT | List all support tickets (all customers) |
| GET | `/admin/support/{id}/messages` | Admin JWT | Get messages in a specific ticket thread |
| POST | `/admin/support/{id}/reply` | Admin JWT | Admin sends a reply to a customer ticket |
| PUT | `/admin/support/{id}/status` | Admin JWT | Update ticket status (open/pending/resolved/closed) |

### Modified Endpoints (additive, non-breaking)

| Method | Path | Change | Breaking? |
|--------|------|--------|---------|
| POST | `/api/reviews/` | Add Firestore sync after SQLite commit | No |
| GET | `/admin/reviews/dashboard` | Backend now returns real data (DEFAULT removed from frontend service) | No |

### Unchanged Endpoints

All existing admin endpoints (`/admin/reports/*`, `/admin/reviews/*`, `/admin/analytics/*`) remain unchanged in both request and response contracts.

---

## Database Requirements

### SQLite — Migrations Required for Requirement 5 Only

The `reviews` table already exists with the correct schema. No new SQLite tables are needed for Requirements 1–4. Reports are stored in Firestore only.

**Requirement 5 adds 6 new nullable columns to the existing `conversations` table** (additive migration — no existing data is affected):

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `type` | VARCHAR | `'vendor_chat'` | Distinguishes vendor chat from support ticket |
| `status` | VARCHAR | `'open'` | Ticket lifecycle: open / pending / resolved / closed |
| `category` | VARCHAR | NULL | Support ticket category |
| `title` | VARCHAR | NULL | Support ticket subject |
| `assigned_to` | INTEGER (FK) | NULL | Admin user ID if assigned |
| `resolved_at` | DATETIME | NULL | Timestamp when admin resolves |

All existing `conversations` rows (vendor chats) receive `type='vendor_chat'` by default and are otherwise unaffected. All existing vendor messaging API endpoints continue to work without modification because they do not filter on `type`.

### Firestore Collections

| Collection | Status | Change |
|-----------|--------|--------|
| `reviews/{id}` | Exists (sparse) | Now always written on customer review submit |
| `reports/{id}` | Exists (always empty) | Now written by customer via `POST /api/reports/` |
| `vendorStats/{vendor_id}` | Exists | Fix Increment import — totalSales and totalRevenue now increment |
| `vendorNotifications/{id}` | Exists | Fix — currently crashes before write completes |
| `purchases/{id}` | Exists | Fix — currently crashes if vendorStats exists |
| `downloads/{id}` | Exists | Fix — currently crashes if vendorStats exists |

---

## Constraints

1. MUST NOT modify any customer authentication, vendor authentication, or affiliate authentication flow.
2. MUST NOT change any existing API response shape — all changes are additive.
3. MUST NOT modify existing order creation, payment, or checkout flow.
4. MUST NOT touch `PromotionsManagement.jsx` or `adminPromotions` Firestore collection.
5. MUST NOT modify `messages_router.py` or `MessagesCenter.jsx` — vendor messaging is a protected system.
6. MUST NOT introduce new SQLite tables — only additive columns on the existing `conversations` table.
7. All Firestore writes MUST be guarded by `if firebase_connected and db is not None`.
8. Support ticket `status` and `type` columns MUST default safely so existing vendor chat rows are unaffected.
6. All Firestore writes MUST be guarded by `if firebase_connected and db is not None`.

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Production Readiness Score | 86/100 | 100/100 |
| Customer reviews visible in admin (Firebase connected) | 0 | Real data |
| Customer reports system | Non-existent | Fully functional |
| vendorStats accuracy on purchase | 0% (bug) | 100% |
| Draft product marketplace leak | Possible | Impossible |
| Customer support ticket submission | Non-functional (localStorage only) | Fully functional (SQLite persisted) |
| Admin support inbox | Non-existent | Functional — all tickets visible |
| Bidirectional support communication | Non-existent | Admin replies visible in customer thread |

---

## Glossary

**Firestore sync** — The process of writing a copy of SQLite-authoritative data to Firebase Firestore for real-time frontend subscriptions.

**firestore.Increment** — A Firebase Admin SDK sentinel value used for atomic numeric increments in Firestore documents. Must be imported from `firebase_admin.firestore`.

**Draft product** — A product with `status = "draft"` in both SQLite and Firestore. Should not be visible to customers until published.

**Verified purchase review** — A review submitted by a customer who has a completed order containing the reviewed product. Required for review submission.

**Rate limit** — A constraint preventing excessive identical actions from the same user within a time window. Applied to report submissions (max 3 per product per 24h) and support ticket creation (max 5 per 24h).

**Support ticket** — A `Conversation` record with `type = "support_ticket"`. Represents a customer help request directed at the admin team. Distinct from vendor chat conversations which have `type = "vendor_chat"`.

**Ticket status lifecycle** — The four states a support ticket can move through: `open` (submitted, awaiting admin) → `pending` (admin has replied, awaiting customer) → `resolved` (admin has closed) → `closed` (fully archived). Status is stored in `conversations.status` in SQLite.

**Bidirectional thread** — The shared `messages` table entries for a given `conversation_id`. Both customer (`sender_id = customer.id`) and admin (`sender_id = admin.id`) write to the same table. The customer's SupportCenter thread and the admin's Support Inbox thread read from the same rows.
