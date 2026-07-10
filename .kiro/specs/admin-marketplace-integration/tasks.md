# Implementation Plan: Admin Marketplace Integration
**Phase:** Admin Dashboard Production Completion (Phase 3)
**Project:** Lumora Digital Marketplace
**Date:** July 10, 2026
**Based on:** requirements.md + design.md

---

## Overview

| Milestone | Name | Files Changed | Risk | Effort |
|-----------|------|--------------|------|--------|
| P3-M1 | Firestore Increment Fix | 1 backend file | Zero | 5 min |
| P3-M2 | Draft Product Visibility Fix | 1 frontend file | Low | 5 min |
| P3-M3 | Review Firestore Synchronization | 2 files | Low | 30 min |
| P3-M4 | Customer Report Submission | 3 files (1 new) | Medium | 90 min |
| P3-M5 | Support Schema Migration | 2 backend files | Low | 20 min |
| P3-M6 | Customer Support API | 2 files (1 new) | Low | 45 min |
| P3-M7 | Admin Support API | 2 files (1 new) | Low | 45 min |
| P3-M8 | SupportCenter Rewire | 2 files (1 new) | Medium | 60 min |
| P3-M9 | Admin Support Inbox UI | 3 files (1 new) | Low | 90 min |

---

## Notes

- Execute ONE milestone at a time
- Do NOT start the next milestone until the current passes all regression checks
- After each milestone: compile backend, build frontend, run regression gate
- Do NOT commit, push, or merge until explicitly requested by the user
- If any protected system is affected: STOP and produce an impact report
- `messages_router.py` and `MessagesCenter.jsx` are protected — MUST NOT be modified

---

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["P3-M1", "P3-M2"],
      "reason": "Independent — M1 is backend only, M2 is frontend only, no shared dependencies"
    },
    {
      "wave": 2,
      "tasks": ["P3-M3", "P3-M4"],
      "reason": "M3 depends on M1 (Firebase import fixed). M4 is independent of M1/M2/M3."
    },
    {
      "wave": 3,
      "tasks": ["P3-M5"],
      "reason": "Schema migration must exist before support API routes use new columns"
    },
    {
      "wave": 4,
      "tasks": ["P3-M6", "P3-M7"],
      "reason": "Both depend on P3-M5 schema. M6 customer API and M7 admin API use same model."
    },
    {
      "wave": 5,
      "tasks": ["P3-M8"],
      "reason": "SupportCenter rewire depends on P3-M6 customer API being live"
    },
    {
      "wave": 6,
      "tasks": ["P3-M9"],
      "reason": "Admin Inbox UI depends on P3-M7 admin API being live"
    }
  ]
}
```

---

## Tasks

### MILESTONE P3-M1 — Firestore Increment Fix ✅

**Branch:** `fix/firestore-increment-nameerror`
**Effort:** 5 minutes | **Risk:** Zero

**Files to Modify:** `backend/admin/firestore/admin_firestore.py`

- [x] 1. Add `from firebase_admin import firestore` after existing firebase imports in `admin_firestore.py`
- [x] 2. Run `python -c "from app.main import app; print('OK')"` — must PASS
- [x] 3. Run `python -c "from admin.firestore.admin_firestore import sync_order_to_firestore; print('OK')"` — must PASS
- [x] 4. Confirm no existing function signatures changed and no frontend files modified

**Acceptance Criteria:** Backend compiles, no NameError on `firestore.Increment`, `sync_order_to_firestore` structure unchanged.

---

### MILESTONE P3-M2 — Draft Product Visibility Fix ✅

**Branch:** `fix/draft-product-marketplace-visibility`
**Effort:** 5 minutes | **Risk:** Low

**Files to Modify:** `frontend/src/context/AppContext.jsx`

- [x] 1. Locate `query(collection(db, 'products'))` in `AppContext.jsx` — confirm exact line
- [x] 2. Verify `where` is imported from `firebase/firestore` — add to existing import if missing
- [x] 3. Change query to `query(collection(db, 'products'), where('status', '==', 'published'))`
- [x] 4. Run `npm run build` — must PASS
- [x] 5. Confirm `ProductsManagement.jsx` is unchanged (uses separate Firestore listener)

**Acceptance Criteria:** AppContext query includes `where` filter, frontend builds, admin products panel unchanged.

---

### MILESTONE P3-M3 — Review Firestore Synchronization ✅

**Branch:** `fix/review-firestore-sync`
**Effort:** 30 minutes | **Risk:** Low

**Files to Modify:** `backend/app/api/reviews/routes.py`, `frontend/src/services/reviewAnalyticsService.js`

- [x] 1. Add `sync_review_to_firestore()` helper function in `reviews/routes.py` — wrapped in `try/except`, non-blocking
- [x] 2. Call `sync_review_to_firestore()` in `create_review()` after `db.refresh(review)`, before `return`
- [x] 3. Remove entire `DEFAULT_REVIEW_ANALYTICS` constant block from `reviewAnalyticsService.js`
- [x] 4. Simplify `getReviewAnalytics` to `return await backendFetch('/admin/reviews/dashboard')`
- [x] 5. Run `python -c "from app.main import app; print('OK')"` — must PASS
- [x] 6. Run `npm run build` — must PASS
- [x] 7. Verify `POST /api/reviews/` still requires auth and verified purchase (logic unchanged)

**Acceptance Criteria:** Firestore `reviews/{id}` created after review submission, no `DEFAULT_REVIEW_ANALYTICS` in codebase, admin Reviews unchanged.

---

### MILESTONE P3-M4 — Customer Report Submission System ✅

**Branch:** `feat/customer-report-submission`
**Effort:** 90 minutes | **Risk:** Medium

**Files to Modify:** `backend/app/api/reports/routes.py` (NEW), `backend/app/main.py`, `frontend/src/pages/marketplace/ProductPage.jsx`

- [x] 1. Create `backend/app/api/reports/routes.py` with `POST /` and `GET /me` — validate category, description, rate-limit (3/product/24h), write to Firestore `reports` collection, return HTTP 503 if Firebase unavailable
- [x] 2. Register router in `main.py`: `app.include_router(reports_router, prefix="/api/reports", tags=["Reports"])`
- [x] 3. Run `python -c "from app.main import app; print('OK')"` — must PASS
- [x] 4. Add "Report this product" button + isolated `ReportModal` to `ProductPage.jsx` — modal state fully isolated, button NOT inside purchase/cart flow
- [x] 5. Run `npm run build` — must PASS
- [x] 6. Verify endpoint is registered: `python -c "from app.main import app; print([r.path for r in app.routes])"`

**Acceptance Criteria:** `POST /api/reports/` → 201; 401 without JWT; 400 bad category; 429 after 3 same-product reports; Firestore document created; admin Reports page shows report; purchase flow unchanged.

---

### MILESTONE P3-M5 — Support Schema Migration ✅

**Branch:** `feat/support-schema-migration`
**Effort:** 20 minutes | **Risk:** Low

**Files to Modify:** `backend/app/models/conversation.py`, `backend/app/schemas/schemas.py`

- [x] 1. Add 6 new columns to `Conversation` model: `type` (default `'vendor_chat'`), `status` (default `'open'`), `category`, `title`, `assigned_to` (FK nullable), `resolved_at` (nullable)
- [x] 2. Add `SupportTicketCreate`, `SupportTicketResponse`, `SupportMessageResponse` Pydantic schemas to `schemas.py`
- [x] 3. Run `python -c "from app.main import app; print('OK')"` — SQLAlchemy auto-applies columns on startup via `create_all`
- [x] 4. Verify existing `GET /api/messages/conversations` still returns vendor chat rows correctly
- [x] 5. Confirm `messages_router.py` is unchanged

**Acceptance Criteria:** Backend starts, new columns exist on `conversations` table, existing vendor conversations load correctly, `messages_router.py` untouched.

---

### MILESTONE P3-M6 — Customer Support API ✅

**Branch:** `feat/customer-support-api`
**Effort:** 45 minutes | **Risk:** Low

**Files to Modify:** `backend/app/api/support/routes.py` (NEW), `backend/app/main.py`

- [x] 1. Create `backend/app/api/support/` folder with `__init__.py` and `routes.py`
- [x] 2. Implement `POST /` — look up admin via `db.query(User).filter(User.role=="admin").first()`, create `Conversation(type='support_ticket', seller_id=admin.id)` + first `Message`, rate-limit 5/customer/24h
- [x] 3. Implement `GET /me` — return customer's own tickets filtered by `type='support_ticket'`
- [x] 4. Implement `GET /{ticket_id}/messages` — verify `buyer_id == current_user.id`, return thread
- [x] 5. Implement `POST /{ticket_id}/reply` — verify ownership and `status != 'closed'`, insert `Message`
- [x] 6. Register router in `main.py`: `app.include_router(support_router, prefix="/api/support", tags=["Support"])`
- [x] 7. Run `python -c "from app.main import app; print('OK')"` — must PASS

**Acceptance Criteria:** `POST /api/support/` → 201 with `ticket_id`; `seller_id` is real admin ID not `2`; `GET /me` returns customer's tickets; cross-customer thread access → 403; 6th ticket in 24h → 429.

---

### MILESTONE P3-M7 — Admin Support API ✅

**Branch:** `feat/admin-support-api`
**Effort:** 45 minutes | **Risk:** Low

**Files to Modify:** `backend/app/admin_api/support/routes.py` (NEW), `backend/app/main.py`

- [x] 1. Create `backend/app/admin_api/support/` folder with `__init__.py` and `routes.py`
- [x] 2. Apply `require_admin_role` dependency to ALL endpoints in this router
- [x] 3. Implement `GET /tickets` — list all `type='support_ticket'` conversations with buyer names, optional status filter, paginated (default 20)
- [x] 4. Implement `GET /{ticket_id}/messages` — return full thread, mark customer messages `is_read=True`
- [x] 5. Implement `POST /{ticket_id}/reply` — insert `Message(sender_id=admin.id)`, set `status='pending'`
- [x] 6. Implement `PUT /{ticket_id}/status` — validate status value, set `resolved_at=now()` on resolve
- [x] 7. Register router in `main.py` under `/admin/support` prefix with admin tag
- [x] 8. Run `python -c "from app.main import app; print('OK')"` — must PASS

**Acceptance Criteria:** `GET /admin/support/tickets` without admin JWT → 403; admin reply stored with `sender_id=admin.id`; status change persists; `resolved_at` set on resolve; existing admin report/review endpoints unchanged.

---

### MILESTONE P3-M8 — SupportCenter Rewire ✅

**Branch:** `feat/support-center-rewire`
**Effort:** 60 minutes | **Risk:** Medium

**Files to Modify:** `frontend/src/services/supportService.js` (NEW), `frontend/src/pages/customer/SupportCenter.jsx`

- [x] 1. Create `frontend/src/services/supportService.js` with: `createTicket`, `getMyTickets`, `getTicketMessages`, `sendReply` functions using `backendFetch`
- [x] 2. Replace `fetchTicketHistory()` in `SupportCenter.jsx` to call `getMyTickets()` — remove localStorage as primary source, display real API status
- [x] 3. Replace `handleSubmit()` to call `createTicket(title, category, desc)` — remove `POST /api/messages/conversations` with `seller_id:2`, remove `localStorage.setItem` writes
- [x] 4. Replace `loadTicketMessages()` to call `getTicketMessages(ticket.id)` — remove hardcoded fallback "Lumora Concierge Support" messages
- [x] 5. Replace `handleSendReply()` to call `sendReply(selectedTicket.id, replyText)` — refresh messages on success
- [x] 6. Add 4-second polling in ticket detail view using `setInterval` — clear on unmount/deselect
- [x] 7. Run `npm run build` — must PASS

**Acceptance Criteria:** New ticket POSTs to `/api/support/` not `/api/messages/conversations`; no `seller_id:2` in any network request; status from API not localStorage; admin reply appears within 4s; `MessagesCenter.jsx` and `messageService.js` unchanged.

---

### MILESTONE P3-M9 — Admin Support Inbox UI ✅

**Branch:** `feat/admin-support-inbox`
**Effort:** 90 minutes | **Risk:** Low

**Files to Modify:** `frontend/src/pages/admin/AdminSupportInbox.jsx` (NEW), `frontend/src/pages/admin/components/AdminSidebar.jsx`, `frontend/src/App.jsx`

- [x] 1. Create `AdminSupportInbox.jsx` using `AdminLayout` wrapper with `activePage="support"` — left panel ticket list, right panel message thread, reply input, status dropdown
- [x] 2. Ticket list: fetch from `GET /admin/support/tickets`, show title/category/status/customer name/date, status filter dropdown
- [x] 3. Thread view: fetch from `GET /admin/support/{id}/messages`, distinguish Customer vs Admin messages by `sender_id`, 4-second polling
- [x] 4. Reply: `POST /admin/support/{id}/reply` — clear input on success, refresh thread
- [x] 5. Status change: `PUT /admin/support/{id}/status` — update ticket status badge in list on success
- [x] 6. Add "Support" nav group to `AdminSidebar.jsx` after "Users" group: `{ id: 'support', label: 'Support Inbox', icon: MessageSquare, path: '/admin/support' }`
- [x] 7. Add lazy import and route to `App.jsx`: `path="/admin/support"` with `requiredRole="admin"` ProtectedRoute
- [x] 8. Run `npm run build` — must PASS
- [x] 9. Navigate to `/admin/support` — verify ticket list loads, thread opens, reply sends, status updates

**Acceptance Criteria:** Route accessible with admin JWT; redirects to login without; ticket list shows all customer tickets; admin reply sends and appears in customer SupportCenter within 4s; all existing admin sidebar items and routes unchanged.

---

## Final File Change Summary

| # | File | Milestone | Type | Est. LOC |
|---|------|-----------|------|----------|
| 1 | `backend/admin/firestore/admin_firestore.py` | P3-M1 | Fix | +1 |
| 2 | `frontend/src/context/AppContext.jsx` | P3-M2 | Fix | ±1 |
| 3 | `backend/app/api/reviews/routes.py` | P3-M3 | Extend | +30 |
| 4 | `frontend/src/services/reviewAnalyticsService.js` | P3-M3 | Fix | -38, +3 |
| 5 | `backend/app/api/reports/routes.py` | P3-M4 | New | +80 |
| 6 | `backend/app/main.py` | M4, M6, M7 | Extend | +6 |
| 7 | `frontend/src/pages/marketplace/ProductPage.jsx` | P3-M4 | Extend | +120 |
| 8 | `backend/app/models/conversation.py` | P3-M5 | Extend | +10 |
| 9 | `backend/app/schemas/schemas.py` | P3-M5 | Extend | +30 |
| 10 | `backend/app/api/support/routes.py` | P3-M6 | New | +90 |
| 11 | `backend/app/admin_api/support/routes.py` | P3-M7 | New | +70 |
| 12 | `frontend/src/pages/customer/SupportCenter.jsx` | P3-M8 | Rewire | ±120 |
| 13 | `frontend/src/services/supportService.js` | P3-M8 | New | +60 |
| 14 | `frontend/src/pages/admin/AdminSupportInbox.jsx` | P3-M9 | New | +200 |
| 15 | `frontend/src/pages/admin/components/AdminSidebar.jsx` | P3-M9 | Extend | +8 |
| 16 | `frontend/src/App.jsx` | P3-M9 | Extend | +4 |

**Files Guaranteed Untouched**
- `frontend/src/pages/customer/MessagesCenter.jsx`
- `backend/app/api/messages_router.py`
- `frontend/src/services/messageService.js`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/routes/ProtectedRoute.jsx`
- `frontend/src/pages/marketplace/Cart.jsx`
- `frontend/src/pages/marketplace/Checkout.jsx`
- `backend/app/api/orders/routes.py`
- `backend/app/api/payments/routes.py`
- `backend/app/admin_api/reports/routes.py`
- `backend/app/admin_api/reviews/routes.py`
- `backend/admin/routes/*`
- `database/firestore-rules/firestore.rules`
