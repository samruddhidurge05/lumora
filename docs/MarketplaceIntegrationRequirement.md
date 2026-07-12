# MarketplaceIntegrationRequirement.md
# Phase 4 — Marketplace Integration & Intelligence
**Project:** Lumora Digital Marketplace  
**Phase:** 4 — Production Completion  
**Date:** July 2026  
**Status:** Specification — NOT YET IMPLEMENTED  
**Current Production Readiness:** 73.8%  
**Target Production Readiness:** 94%

---

## 1. Purpose

Phase 3 delivered the Admin Support Inbox, Customer Support API, Report Submission, Review Sync, and Draft Product Visibility. The platform is now functionally operational but lacks several production-critical marketplace workflows.

This document specifies the remaining work required to close the gap between the current 73.8% production readiness and a true production-ready administration platform.

**DO NOT IMPLEMENT** until explicitly approved per milestone.

---

## 2. Current State Analysis

### 2.1 What Already Exists (Verified Against Codebase)

**Authentication & Security**
- ✅ Firebase JWT authentication (customer, vendor, affiliate, admin)
- ✅ `require_admin_role` dependency protects all admin API routes
- ✅ Role hardening — cannot elevate to admin via API (auth_router.py)
- ✅ Session clearing on login (AuthContext.jsx)
- ✅ Firestore security rules enforcing role-based access

**Admin Dashboard Modules**
- ✅ Dashboard with KPIs (Firestore + SQLite fallback)
- ✅ Products Management (Firestore real-time)
- ✅ Orders Management (paginated, refund, dispute, CSV export)
- ✅ Payments view
- ✅ Customers Management (Firestore real-time)
- ✅ Vendor Management (enable/disable/restrict + audit)
- ✅ Affiliate Management (enable/disable)
- ✅ Reviews (paginated, sentiment filter, moderation)
- ✅ Reports (Firestore-based, resolve/reject/assign/delete)
- ✅ Referral Links (CRUD + audit)
- ✅ Analytics (dual-source KPIs)
- ✅ Audit Logs (paginated, 13 action types)
- ✅ Platform Settings (maintenance mode)
- ✅ Support Inbox (P3-M9 — admin ↔ customer ticket system)

**Customer-Facing**
- ✅ Support Center rewired to real API (P3-M8)
- ✅ Report submission with rate limiting (P3-M4)
- ✅ Review submission with verified-purchase gate
- ✅ MessagesCenter (vendor ↔ customer chat via SQLite Conversation model)
- ✅ Contact.jsx — UI-only form, no backend persistence (client-side `setSent(true)` only)

**Messaging Architecture**
- ✅ `Conversation` model: id, buyer_id, seller_id, type, status, category, title, assigned_to, resolved_at
- ✅ `Message` model: id, conversation_id, sender_id, content, attachment_url, is_read, created_at
- ✅ `messages_router.py`: GET/POST conversations, GET/POST messages, PUT read
- ✅ MessagesCenter.jsx: 4-second polling, backend+Firestore fallback, file attachment UI

**Analytics**
- ✅ Firestore + SQLite dual-source analytics
- ✅ Date range filtering (7d, 30d, 90d, all)
- ✅ KPIs: revenue, AOV, refund rate, product performance, customer insights
- ⚠️ Growth metrics hardcoded (revenueChange: 12, growthVelocity: 18)
- ⚠️ Geo analytics non-functional (region field never set)

---

### 2.2 What Is Missing (Gaps Requiring Phase 4)

**CRITICAL**
1. Admin User Management — no RBAC, single seeded admin, cannot onboard team
2. JWT_SECRET_KEY hard-fail on weak value
3. Firebase service account JSON committed to repo (security risk)
4. CORS `allow_origins=["*"]` — must restrict before production

**HIGH PRIORITY**
5. Customer report lifecycle — customer cannot see resolution status
6. Admin notifications — no alerts for new orders, tickets, reports
7. Audit log completeness — reviews, orders, support not logged
8. Analytics accuracy — hardcoded growth figures
9. Vendor product approval workflow — no gate before products go live
10. Admin session idle timeout

**MEDIUM PRIORITY**
11. Geo analytics — region field missing from order sync
12. Contact.jsx — no backend persistence (messages disappear)
13. Rate limiting on admin routes
14. Review moderation audit trail

---

## 3. Workflow Analysis

### 3.1 Product Lifecycle — Current vs Required

| Stage | Current State | Gap |
|---|---|---|
| Admin creates/publishes product | ✅ ProductsManagement.jsx + Firestore sync | — |
| Marketplace shows published only | ✅ AppContext where('status','published') | — |
| Customer views product | ✅ ProductPage.jsx | — |
| Customer purchases | ✅ Checkout + orders/routes.py + Firestore sync | — |
| Order created (SQLite) | ✅ Order model | — |
| Downloads available | ✅ downloads collection in Firestore | — |
| Analytics updated | ✅ Firestore order → analytics | Growth metrics hardcoded |
| Audit log | ⚠️ Order creation NOT audit-logged | **MISSING** |
| Reports updated | ✅ Reports read Firestore | — |
| Revenue in KPIs | ✅ Dashboard calculates from orders | — |
| Vendor product approval | ❌ Products go live immediately | **MISSING** |

### 3.2 Customer Review Lifecycle — Current vs Required

| Stage | Current State | Gap |
|---|---|---|
| Customer purchases product | ✅ | — |
| Customer submits review | ✅ POST /api/reviews/ with verified-purchase gate | — |
| Review stored (SQLite) | ✅ Review model | — |
| Firestore sync | ✅ sync_review_to_firestore() after create | — |
| Customer review visible | ✅ ProductPage.jsx loads reviews | — |
| Admin Reviews Dashboard | ✅ GET /admin/reviews/ paginated | — |
| Grouped by Product | ⚠️ Sort/filter by product not implemented | **MISSING** |
| Sentiment analysis | ⚠️ No NLP, only star-count-based labeling | **MISSING** |
| Moderation | ✅ POST /admin/reviews/moderate | — |
| Analytics update | ⚠️ Analytics not triggered on new review | **MISSING** |
| Audit logging on moderation | ❌ Not logged | **MISSING** |

### 3.3 Customer Report Lifecycle — Current vs Required

| Stage | Current State | Gap |
|---|---|---|
| Customer submits report | ✅ POST /api/reports/ → Firestore with rate limiting | — |
| Admin sees report | ✅ GET /admin/reports/ paginated | — |
| Admin resolves/rejects | ✅ POST /admin/reports/resolve, /reject | — |
| Customer sees updated status | ❌ GET /api/reports/me returns raw Firestore but no UI shows it | **MISSING** |
| Admin → Customer notification | ❌ No notification sent | **MISSING** |
| Audit log on resolution | ❌ Not logged | **MISSING** |
| Internal admin notes on report | ❌ Not implemented | **MISSING** |

### 3.4 Customer ↔ Admin Messaging (MessagesCenter Analysis)

**What exists:**
- `Conversation` model: buyer_id, seller_id — originally designed for vendor ↔ customer chat
- `Message` model: conversation_id, sender_id, content, attachment_url, is_read
- `messages_router.py`: full CRUD — protected by JWT, participant verification
- MessagesCenter.jsx: real-time 4s polling, backend+Firestore fallback
- The Conversation model was EXTENDED in P3-M5 with: `type`, `status`, `category`, `title`, `assigned_to`, `resolved_at`
- Support tickets (P3-M6/M7) reuse this exact model with `type='support_ticket'`

**Can it be reused for Admin Support?**
YES — and it already IS (P3-M6/M7/M8/M9 implemented this). The `type` field distinguishes:
- `vendor_chat` — original vendor ↔ customer conversations
- `support_ticket` — P3 customer ↔ admin support

**Can Reports reuse Conversations?**
NO — and here's why:
- Reports are moderation events, not conversations. A report has: category, severity, status, product_id, reporter
- A report may never have a reply — it just gets resolved or rejected
- Mixing report state into the Conversation model would pollute the messaging system
- Reports already have their own independent Firestore collection (`reports`) with full lifecycle
- The correct approach is: when admin resolves a report, write `resolution_note` field to the Firestore report document and expose it via `GET /api/reports/me`

### 3.5 Contact.jsx Analysis

**Current state:** Contact.jsx renders a name/email/subject/message form. On submit it sets `setSent(true)` — a pure frontend state change. There is no `fetch()`, no `backendFetch()`, no API call. Messages are lost immediately.

**Where should contact requests go?**
Contact requests should be routed to the **Reports system** — specifically as a new report `category: 'contact'`. Reasoning:
- Contact requests are inbound from unauthenticated or authenticated users
- They require admin attention and resolution
- They should be tracked, assigned, and closed
- Reusing the existing Reports Firestore collection with `category: 'contact_request'` keeps everything in one admin module
- This avoids creating a new module for a simple form

**Required:** Add `POST /api/contact` endpoint that writes to Firestore `reports` collection with `category: 'contact_request'`, `status: 'pending'` — so admin sees them in the Reports panel.

### 3.6 Analytics Event Pipeline

| Event | Currently Triggers Analytics Update | Gap |
|---|---|---|
| Product published | ❌ No event fired | MISSING |
| Purchase completed | ⚠️ Firestore order written, analytics reads on-demand | Not automatic |
| Refund issued | ⚠️ Firestore order status updated | Not automatic |
| Review submitted | ❌ No analytics update triggered | MISSING |
| Report submitted | ❌ No analytics update triggered | MISSING |
| Vendor approved | ❌ No event | MISSING |
| Affiliate commission | ⚠️ Written to affiliateConversions | Analytics doesn't aggregate it |
| Downloads increase | ⚠️ Written to downloads collection | Analytics doesn't aggregate it |

**Root cause:** The analytics system is pull-based (reads on demand from Firestore/SQLite). There is no event-driven push. For the scope of Phase 4, the solution is to ensure analytics routes always recalculate from current data, and to fix the hardcoded growth metrics.

### 3.7 Marketplace Synchronization Gaps

| Data Flow | Status | Gap |
|---|---|---|
| Product → Firestore | ✅ sync_product_to_firestore() on create/update | — |
| Order → Firestore | ✅ sync_order_to_firestore() | Region field not set |
| Review → Firestore | ✅ sync_review_to_firestore() | — |
| Report → Firestore | ✅ POST /api/reports/ writes directly | — |
| Support ticket → SQLite | ✅ P3-M6 | — |
| Vendor stats → Firestore | ✅ Increment on order | — |
| Affiliate commissions → Firestore | ✅ affiliateConversions on order | — |
| Admin action → AuditLog | ⚠️ Only 13 action types covered | Orders, reviews, support missing |
| Report resolution → Customer | ❌ Customer has no visibility | MISSING |
| Admin reply → Customer notification | ❌ No notification system | MISSING |

### 3.8 Notifications — Current State

There is NO admin notification system. No in-app alerts when:
- New support ticket created
- New product report submitted
- New review received
- Order placed
- Refund requested

For Phase 4, a lightweight in-app notification badge system is required — not push notifications, but an API endpoint that returns unread counts for admin to display in the sidebar.

### 3.9 Admin User Management — Architecture Design

**Current state:** Single seeded admin (`avikapawar4@gmail.com`). `User.role == "admin"` is binary. No RBAC.

**Required for production company:**

| Role | Capabilities |
|---|---|
| super_admin | All access + manage admin team |
| admin | All access except manage admin team |
| moderator | Reviews, Reports, Support only |
| support | Support Inbox only |
| finance | Orders, Payments, Analytics only |
| marketing | Products, Analytics, Referral Links only |
| analyst | Read-only Analytics, Reports, Audit Logs |

**Architecture decision:**
- New SQLite table: `admin_roles` (id, user_id FK, role_level, permissions_json, created_by, created_at, is_active)
- New `admin_permissions` helper: checks `admin_roles` table instead of just `user.role == "admin"`
- Backward compatible: existing `require_admin_role` continues to work for super_admin and admin levels
- New `require_permission(permission_name)` dependency for granular checks
- New frontend page: `AdminUserManagement.jsx`
- Invitation workflow: admin generates invite token → email sent → new admin registers → role assigned

**Does it require new auth logic?**
Partially. The Firebase/JWT pipeline itself does not change. What changes:
- A new `admin_roles` SQLite table is the source of truth for admin permissions
- The existing `require_admin_role` becomes the coarsest check (is the user an admin at all)
- New `require_permission(perm)` is for fine-grained module access

**Protected systems NOT affected:** Customer auth, vendor auth, affiliate auth, Google OAuth, ProtectedRoute, JWT, checkout, orders, payments.

---

## 4. Production Requirements

### REQ-P4-01 — Security Hardening (Critical)
- JWT_SECRET_KEY must hard-fail (not warn) on weak/default value
- CORS must restrict to production domains
- Firebase service account JSON must be removed from version control and rotated
- Rate limiting must apply to admin API routes

### REQ-P4-02 — Admin User Management
- Super admin can invite, activate, deactivate other admins
- Role assignment: super_admin, admin, moderator, support, finance, marketing, analyst
- Permission-based route protection for fine-grained access
- Admin profile management
- Session revocation on deactivation
- Audit log entry on every admin user management action

### REQ-P4-03 — Report Lifecycle Completion
- Customer can view resolution status of submitted reports via `GET /api/reports/me`
- Customer Dashboard (Reports tab) shows status: pending → investigating → resolved/rejected
- Admin resolution writes `resolution_note` and `resolved_at` to Firestore report document
- Audit log entry on report resolve/reject

### REQ-P4-04 — Analytics Accuracy
- Remove all hardcoded growth/forecast metrics
- Compute period-over-period revenue growth from actual order data
- Fix geo analytics — populate `region` field in `sync_order_to_firestore()`
- Analytics dashboard reflects real growth

### REQ-P4-05 — Audit Log Completeness
- Order status change → audit log entry
- Review moderation → audit log entry
- Support ticket admin actions → audit log entry
- Report resolution → audit log entry

### REQ-P4-06 — Contact Form Backend
- Contact.jsx form must persist to backend
- Contact requests route to Firestore `reports` collection with `category: 'contact_request'`
- Admin sees contact requests in Reports panel

### REQ-P4-07 — Admin Notifications (Unread Counts)
- `GET /api/admin/notifications/counts` — returns unread counts for:
  - new_support_tickets (status='open', type='support_ticket', last 24h)
  - new_reports (status='pending', last 24h)
  - pending_orders (status='Pending' or 'Processing')
- Admin sidebar badge shows total unread count
- Updates every 60 seconds (polling — no WebSocket required)

### REQ-P4-08 — Vendor Product Approval Workflow
- Vendor-submitted products default to `status: 'pending_review'`
- Admin reviews pending products in ProductsManagement.jsx
- Admin approve → status becomes `published`
- Admin reject → status becomes `rejected` + reason stored
- Audit log entry on approve/reject

---

## 5. Protected Systems — Must Not Be Modified

The following systems must remain untouched unless an Impact Report is produced and approved:

- `frontend/src/pages/customer/*` (except Dashboard.jsx for Reports tab — see REQ-P4-03)
- `frontend/src/pages/vendor/*`
- `frontend/src/pages/affiliate/*`
- `frontend/src/pages/auth/*`
- `frontend/src/routes/ProtectedRoute.jsx`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/pages/marketplace/Cart.jsx`
- `frontend/src/pages/marketplace/Checkout.jsx`
- `backend/app/api/messages_router.py`
- `backend/app/api/orders/routes.py`
- `backend/app/api/payments/routes.py`
- `backend/app/api/products_router.py`
- `backend/app/api/vendors/`
- `backend/app/api/affiliate/`

---

## 6. Acceptance Criteria Summary

Each Phase 4 milestone is complete when:
1. Source code exists and is verified
2. Backend API exists and is tested
3. Frontend displays real data
4. Database integration confirmed
5. Audit log entry created for the action
6. No regression in protected systems
7. Frontend build passes (`npm run build` exit 0)
8. Backend import check passes (`python -c "from app.main import app; print('OK')"`)
