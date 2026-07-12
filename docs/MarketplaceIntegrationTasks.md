# MarketplaceIntegrationTasks.md
# Phase 4 — Marketplace Integration & Intelligence
**Project:** Lumora Digital Marketplace  
**Phase:** 4 — Production Completion  
**Date:** July 2026  
**Status:** PENDING APPROVAL — DO NOT IMPLEMENT

---

## Execution Rules

- Execute ONE milestone at a time
- Present implementation plan → Wait for explicit approval → Implement → Verify → Report → Stop
- Never continue to next milestone automatically
- DO NOT commit, push, or merge without explicit instruction
- If any protected system is affected: STOP and produce Impact Report

---

## Milestone Overview

| Milestone | Name | Risk | Effort | Files Changed |
|---|---|---|---|---|
| M4-M1 | Security Hardening | LOW | 30 min | 2 |
| M4-M2 | Audit Log Completeness | LOW | 2h | 5 |
| M4-M3 | Analytics Accuracy Fix | LOW | 3h | 2 |
| M4-M4 | Contact Form Backend | LOW | 1h | 4 |
| M4-M5 | Report Lifecycle Completion | MEDIUM | 3h | 4 |
| M4-M6 | Admin Notifications | LOW | 2h | 4 |
| M4-M7 | Vendor Product Approval | MEDIUM | 4h | 5 |
| M4-M8 | Admin User Management | HIGH | 2 days | 10+ |

---

## MILESTONE M4-M1 — Security Hardening

### Objective
Make the platform safe to deploy publicly. Close three critical security gaps identified in the production audit.

### Business Goal
No production platform should deploy with default JWT secrets, wildcard CORS, or committed service account keys.

### Files to Modify
- `backend/app/main.py`
- `.gitignore`

### Files to Create
None

### Files to Leave Untouched
All other files

### Backend Changes
1. `_validate_startup_config()` in `main.py`: change JWT secret check from warning to hard `sys.exit(1)` when `len(jwt_secret) < 32`
2. CORSMiddleware: read `CORS_ORIGINS` from env var, default to `["http://localhost:5173", "http://localhost:5174"]` in dev
3. Add slowapi rate limiting to admin router: `60/minute`

### Frontend Changes
None

### Firestore Changes
None

### SQLite Changes
None

### API Changes
None (no new routes)

### Security Impact
- Prevents deployment with weak JWT secret — CRITICAL FIX
- Restricts CORS to approved origins — HIGH FIX
- Rate limits admin endpoints — MEDIUM FIX

### Performance Impact
None

### Regression Checklist
- [ ] Backend imports cleanly: `python -c "from app.main import app; print('OK')"`
- [ ] Admin login still works at `/admin/login`
- [ ] All admin API routes still return 200 with valid JWT
- [ ] Customer auth unchanged
- [ ] Vendor auth unchanged

### Manual Test Checklist
1. Set `JWT_SECRET_KEY=secret` in `.env` → start backend → must fail with clear error
2. Set `JWT_SECRET_KEY=` (empty) → must fail
3. Set `JWT_SECRET_KEY=a_strong_32_character_secret_key` → must start
4. Test admin login → must succeed
5. Test unauthenticated admin route → must return 403

### Rollback Strategy
Revert `main.py` JWT check to warning. Restore `allow_origins=["*"]`.

### Acceptance Criteria
- Backend refuses to start with JWT_SECRET_KEY shorter than 32 chars
- CORS allows localhost:5173 in dev, production domain in prod
- Admin routes have rate limit of 60 requests/minute
- All existing admin functionality unchanged

---

## MILESTONE M4-M2 — Audit Log Completeness

### Objective
Every significant admin action produces a traceable audit log entry.

### Business Goal
Compliance, accountability, and incident investigation require complete admin action history.

### Files to Modify
- `backend/app/admin_api/orders/routes.py`
- `backend/app/admin_api/reviews/routes.py`
- `backend/app/admin_api/support/routes.py`
- `backend/app/admin_api/reports/routes.py`
- `frontend/src/pages/admin/AuditLogs.jsx` (add new action types to ACTION_COLORS and ACTION_OPTIONS)

### Files to Create
- `backend/app/services/audit_log_service.py`

### Files to Leave Untouched
All other files, all customer/vendor/affiliate pages

### Backend Changes
1. Create `audit_log_service.py` with `log_admin_action()` helper
2. Call `log_admin_action()` in:
   - `orders/routes.py`: PUT `/{order_id}/status` → `'order_status_change'`
   - `orders/routes.py`: POST `/{order_id}/refund` → `'order_refund'`
   - `orders/routes.py`: POST `/{order_id}/dispute` → `'order_dispute'`
   - `reviews/routes.py`: POST `/moderate` → `'review_moderated'`
   - `support/routes.py`: POST `/{ticket_id}/reply` → `'support_ticket_replied'`
   - `support/routes.py`: PUT `/{ticket_id}/status` → `'support_ticket_status_changed'`
   - `reports/routes.py`: POST `/resolve` → `'report_resolved'`
   - `reports/routes.py`: POST `/reject` → `'report_rejected'`
   - `reports/routes.py`: POST `/assign` → `'report_assigned'`

### Frontend Changes
`AuditLogs.jsx`: Add new action types to `ACTION_OPTIONS` array and `ACTION_COLORS` map.

### Firestore Changes
None

### SQLite Changes
None (uses existing `audit_logs` table)

### API Changes
None (internal service call only)

### Security Impact
Positive — increases auditability

### Performance Impact
Negligible — one extra INSERT per admin action

### Regression Checklist
- [ ] Order status change still works
- [ ] Order refund still works
- [ ] Review moderation still works
- [ ] Support ticket reply still works
- [ ] Reports resolve/reject still works
- [ ] Audit logs page still loads and paginates

### Manual Test Checklist
1. Change an order status → check Audit Logs page → new entry appears
2. Refund an order → check Audit Logs
3. Moderate a review → check Audit Logs
4. Reply to a support ticket → check Audit Logs
5. Resolve a report → check Audit Logs
6. Filter audit logs by new action types → works

### Rollback Strategy
Remove `log_admin_action()` calls from each route. Delete `audit_log_service.py`.

### Acceptance Criteria
- Audit log entry created for every admin action listed above
- Entries include admin_user_id, action, target_type, target_id
- AuditLogs.jsx shows new action types in filter dropdown
- All existing admin actions continue to work

---

## MILESTONE M4-M3 — Analytics Accuracy Fix

### Objective
Dashboard analytics show real computed growth metrics, not hardcoded values.

### Business Goal
Admin needs accurate growth data to make product and marketing decisions.

### Files to Modify
- `backend/app/admin_api/analytics/services.py`
- `backend/admin/firestore/admin_firestore.py`

### Files to Create
None

### Files to Leave Untouched
All other files

### Backend Changes

**`analytics/services.py`:**
1. Add `compute_growth(current_orders, previous_orders)` function
2. In `get_analytics_dashboard_data()`:
   - When date_range='30d': also fetch previous 30-day orders to compute growth
   - Replace `"revenueChange": 12` with `compute_growth(current, previous)`
   - Replace `"growthVelocity": 18` with computed metric
   - Replace `"conversionRate": 3.2` with `(paid_orders / total_orders * 100)` if available
   - Replace `"aovGrowth": 4` with computed AOV change
3. Do NOT change the response shape — only replace hardcoded values with computed ones

**`admin_firestore.py`:**
1. In `sync_order_to_firestore()`, add `"region": "India"` (default placeholder) to the Firestore order document so geo analytics is non-empty
2. Future: replace with actual billing region when available

### Frontend Changes
None (response shape unchanged)

### Firestore Changes
New `region` field on orders documents going forward

### SQLite Changes
None

### API Changes
None (same endpoints, improved data)

### Security Impact
None

### Performance Impact
Slightly higher — analytics now fetches two date range windows instead of one. Acceptable.

### Regression Checklist
- [ ] Analytics dashboard loads
- [ ] All KPI cards display numbers
- [ ] Date range filter works (7d, 30d, 90d, all)
- [ ] Product performance chart shows data
- [ ] Growth metrics no longer show hardcoded 12%, 18%

### Manual Test Checklist
1. Open Analytics at `http://localhost:5173/admin/analytics`
2. Change date range to 30d → verify revenueChange is a real number (not 12)
3. Switch to 7d → verify different growth number
4. Switch to 90d → verify data loads
5. Check geo analytics → should show "India" or actual regions

### Rollback Strategy
Revert `analytics/services.py` to hardcoded values.

### Acceptance Criteria
- Revenue growth metric computed from actual period-over-period data
- No hardcoded metric values (12, 18, 3.2, 4)
- Geo analytics chart has at least one region (India default)
- Analytics API response structure unchanged

---

## MILESTONE M4-M4 — Contact Form Backend

### Objective
Contact.jsx form persists submissions to backend. Admin sees contact requests in Reports panel.

### Business Goal
Users contact the platform — requests must be tracked and resolvable by the admin team.

### Files to Modify
- `backend/app/main.py`
- `frontend/src/pages/support/Contact.jsx`

### Files to Create
- `backend/app/api/contact_router.py`

### Files to Leave Untouched
All other customer/vendor/affiliate pages, admin pages, auth

### Backend Changes
Create `contact_router.py`:
```
POST /api/contact
Auth: Not required (public)
Rate limit: 3/hour per IP
Body: { name, email, subject, message }
Action:
  - Write to Firestore 'reports' collection with:
    category: 'contact_request', status: 'pending',
    reporter: name, title: subject, description: message,
    user_email: email, severity: 'low', created_at: now()
  - Return 201 { id, status: 'received' }
  - If Firebase unavailable: 503
```

Register in `main.py`: `app.include_router(contact_router, prefix="/api/contact", tags=["Contact"])`

### Frontend Changes
`Contact.jsx`:
- Replace `handleSubmit` with `backendFetch('/contact', { method: 'POST', body: JSON.stringify(form) })`
- Keep `setSent(true)` on 201 response
- Add error state: `setError('Failed to send. Please try again.')` on non-201
- Error banner displayed below form

### Firestore Changes
New documents in `reports` collection with `category: 'contact_request'`

### SQLite Changes
None

### API Changes
New public endpoint `POST /api/contact`

### Security Impact
Rate limited (3/hour per IP). No auth required — appropriate for a public contact form. Data written only to Firestore with admin-only list access.

### Performance Impact
None

### Regression Checklist
- [ ] Existing Reports panel still works
- [ ] Contact.jsx renders correctly
- [ ] Contact form submit works (201 response)
- [ ] Admin Reports panel shows contact_request category items
- [ ] Backend builds clean

### Manual Test Checklist
1. Go to Contact page (customer dashboard Support tab)
2. Fill form and submit
3. Check Firestore `reports` collection → new doc with `category: 'contact_request'`
4. Open Admin Reports panel → contact request appears in list
5. Admin resolves the contact request
6. Try submitting 4 times in 1 hour → 4th should return 429

### Rollback Strategy
Remove `contact_router.py` import from `main.py`. Revert `Contact.jsx` to `setSent(true)`.

### Acceptance Criteria
- Contact form submit reaches backend (201)
- Contact request appears in Admin Reports panel
- Rate limited to 3/hour
- 503 returned if Firebase unavailable
- Existing Reports workflow unchanged

---

## MILESTONE M4-M5 — Report Lifecycle Completion

### Objective
Customer sees the resolution status and note for reports they submitted.

### Business Goal
Closes the feedback loop — customer submits report, admin resolves it, customer knows the outcome.

### Files to Modify
- `backend/app/admin_api/reports/services.py`
- `backend/app/admin_api/reports/routes.py`
- `frontend/src/pages/customer/Dashboard.jsx`

### Files to Create
None

### Files to Leave Untouched
All admin pages, all other customer pages, Auth, Checkout, Orders, Payments

### Backend Changes

**`reports/services.py` — `update_report_status()`:**
Add optional `resolution_note` parameter. When resolving/rejecting, write to Firestore:
```python
update_data = {
    "status": new_status,
    "resolvedAt": datetime.now(timezone.utc).isoformat(),
}
if resolution_note:
    update_data["resolution_note"] = resolution_note
doc_ref.update(update_data)
```

**`reports/routes.py` — `/resolve` and `/reject` endpoints:**
Add optional `note: str = Body(None)` parameter. Pass to `update_report_status()`.

### Frontend Changes

**`Dashboard.jsx` (customer):**
- Add a "My Reports" subsection inside the existing Support tab (or as a new tab alongside Tickets)
- Calls `GET /api/reports/me` on mount
- Renders list of reports showing:
  - `title` / `category` badge
  - `status` badge with color coding (pending=amber, investigating=blue, resolved=green, rejected=red)
  - `resolution_note` if status is resolved/rejected
  - `created_at` date

**Important constraint:** `Dashboard.jsx` already has multiple tabs. This adds a new sub-section — existing tabs/sections are NOT modified.

### Firestore Changes
New `resolution_note` and `resolvedAt` fields on resolved report documents

### SQLite Changes
None

### API Changes
`POST /admin/reports/resolve` and `POST /admin/reports/reject` accept optional `note` body field

### Security Impact
None — customer reads only their own reports (filtered by user_id in `GET /api/reports/me`)

### Performance Impact
None — same Firestore query as before

### Regression Checklist
- [ ] Admin reports resolve/reject still works without a note
- [ ] Admin reports resolve WITH a note works
- [ ] Customer Dashboard existing tabs unchanged
- [ ] Existing SupportCenter.jsx unchanged
- [ ] `GET /api/reports/me` returns correct data

### Manual Test Checklist
1. Submit a report from ProductPage.jsx as customer
2. Admin resolves report with note "We've removed this product. Thank you for reporting."
3. Go to Customer Dashboard → new "My Reports" section
4. Report shows status "resolved" (green badge) and resolution note
5. Submit another report → admin rejects it → customer sees "rejected" status
6. Test resolve without note → still works (note field is optional)

### Rollback Strategy
Remove `resolution_note` from services. Remove "My Reports" section from Dashboard.jsx.

### Acceptance Criteria
- Customer can see status of all submitted reports in Dashboard
- Resolution note visible when provided
- Admin can resolve/reject with optional note
- Existing admin Reports workflow unchanged

---

## MILESTONE M4-M6 — Admin Notifications

### Objective
Admin sidebar shows unread count badges for support tickets, reports, and pending orders.

### Business Goal
Admins must know when action is required without manually checking every module.

### Files to Modify
- `backend/app/main.py`
- `frontend/src/pages/admin/components/AdminSidebar.jsx`

### Files to Create
- `backend/app/admin_api/notifications/__init__.py`
- `backend/app/admin_api/notifications/routes.py`

### Files to Leave Untouched
All other admin pages, all customer/vendor/affiliate pages

### Backend Changes

**`notifications/routes.py`:**
```
GET /api/admin/notifications/counts
Auth: require_admin_role
Returns:
{
  "support_tickets": N,   # open type='support_ticket' in SQLite
  "reports": N,           # pending in Firestore reports collection
  "pending_orders": N,    # Pending/Processing in Firestore orders
  "contact_requests": N,  # category='contact_request' status='pending' in Firestore
  "total": N
}
Cache: 30 seconds server-side (simple time-based cache dict)
```

Register in `main.py` at `/api/admin/notifications`

### Frontend Changes

**`AdminSidebar.jsx`:**
1. Add state: `const [notifCounts, setNotifCounts] = useState({total:0, support_tickets:0, reports:0})`
2. useEffect: fetch `/api/admin/notifications/counts` on mount and every 60 seconds
3. Add red/amber badge on:
   - "Support Inbox" nav item when `support_tickets > 0`
   - "Reports" nav item when `reports + contact_requests > 0`
4. Total badge in sidebar header when `total > 0`

### Firestore Changes
None

### SQLite Changes
None

### API Changes
New `GET /api/admin/notifications/counts`

### Security Impact
Low risk — endpoint requires admin JWT

### Performance Impact
60-second polling from sidebar. Server-side 30-second cache prevents Firestore hammering.

### Regression Checklist
- [ ] Sidebar still renders correctly
- [ ] All nav items still work
- [ ] Sidebar collapse/expand still works
- [ ] No layout shift from badges
- [ ] Backend starts cleanly

### Manual Test Checklist
1. Submit a support ticket as customer
2. Open admin sidebar → Support Inbox shows badge "1"
3. Open Support Inbox → badge clears on view (or on first load)
4. Submit a report → Reports badge shows "1"
5. Resolve the report → badge clears within 60s
6. Simulate Firebase unavailable → sidebar gracefully hides badges

### Rollback Strategy
Remove notifications router from `main.py`. Remove badge state and polling from `AdminSidebar.jsx`.

### Acceptance Criteria
- Badge appears on Support Inbox when unread tickets exist
- Badge appears on Reports when pending reports exist
- Counts update every 60 seconds
- Sidebar layout and collapse behavior unchanged
- Graceful degradation when API unreachable

---

## MILESTONE M4-M7 — Vendor Product Approval Workflow

### Objective
Vendor-submitted products require admin approval before appearing on the marketplace.

### Business Goal
Prevents spam, inappropriate, or low-quality products from going live without review.

### Files to Modify
- `backend/app/api/products_router.py`
- `backend/app/main.py`
- `frontend/src/pages/admin/ProductsManagement.jsx`

### Files to Create
- `backend/app/admin_api/products/__init__.py`
- `backend/app/admin_api/products/routes.py`

### Files to Leave Untouched
All customer pages, vendor pages (DashboardPage.jsx, ManageProducts.jsx — vendors see their own product status), affiliate pages, auth, checkout, orders, payments

### Backend Changes

**`products_router.py` (controlled modification):**
On `POST /api/products/`:
```python
# Determine initial status based on creator role
if current_user.role in ("vendor", "Vendor"):
    initial_status = "pending_review"
elif current_user.role == "admin":
    initial_status = "published"
else:
    initial_status = "pending_review"  # default safe
```

**`admin/products/routes.py` (new):**
```
GET  /api/admin/products/pending
  - Returns products with status='pending_review', paginated
  - Includes vendor name, category, price, created_at

POST /api/admin/products/{product_id}/approve
  - Sets status='published' in SQLite
  - Calls sync_product_to_firestore()
  - Creates audit log: action='product_approved'
  - Returns updated product

POST /api/admin/products/{product_id}/reject
  - Body: { reason: str }
  - Sets status='rejected' in SQLite
  - Adds rejection_reason to product metadata
  - Creates audit log: action='product_rejected'
  - Returns updated product
```

Register in `main.py` at `/api/admin/products`

### Frontend Changes

**`ProductsManagement.jsx`:**
1. Add "Pending Review" tab/filter alongside existing status filters
2. When selected: fetch from `GET /api/admin/products/pending`
3. For pending products: show "Approve" (green) and "Reject" (red) action buttons
4. Rejection: show inline reason input before confirming
5. On approve/reject: refresh the pending list

### Firestore Changes
`sync_product_to_firestore()` called on approve — no new fields needed

### SQLite Changes
None (uses existing `status` field on `products` table)

### API Changes
2 new admin endpoints + products_router.py controlled modification

### Security Impact
- All new admin endpoints protected by `require_admin_role`
- Vendor cannot self-approve their products
- Admin still can create and self-publish products

### Performance Impact
None — additional filter query on existing products table

### Regression Checklist
- [ ] Admin can still create products and publish immediately
- [ ] Existing published products remain published (no backfill)
- [ ] Marketplace still shows only `status='published'` products
- [ ] Vendor dashboard still shows their products with updated status
- [ ] Existing product CRUD in admin still works
- [ ] Frontend build passes

### Manual Test Checklist
1. Log in as vendor → create a new product → status shows 'pending_review'
2. Marketplace does NOT show the new product
3. Log in as admin → ProductsManagement → Pending Review tab → shows vendor's product
4. Admin approves → product appears in marketplace
5. Create another product as vendor → admin rejects with reason "Missing preview images"
6. Vendor dashboard shows product as 'rejected' with reason
7. Admin creates product directly → status is 'published' immediately

### Rollback Strategy
Revert `products_router.py` initial status change. Remove admin products router from `main.py`. Remove "Pending Review" tab from ProductsManagement.jsx.

### Acceptance Criteria
- New vendor products default to `pending_review`
- Admin can approve → immediately visible on marketplace
- Admin can reject with reason
- Existing products unaffected
- Admin-created products self-publish

---

## MILESTONE M4-M8 — Admin User Management

### Objective
Production-grade multi-admin system with RBAC, invitation workflow, and team management.

### Business Goal
A production company needs a team of admins with different roles — moderators, support agents, analysts — without sharing a single account.

### Files to Modify
- `backend/app/main.py`
- `frontend/src/pages/admin/components/AdminSidebar.jsx`
- `frontend/src/App.jsx`

### Files to Create
- `backend/app/models/admin_role.py`
- `backend/app/models/admin_invitation.py`
- `backend/app/core/permissions.py`
- `backend/app/admin_api/admin_users/__init__.py`
- `backend/app/admin_api/admin_users/routes.py`
- `frontend/src/pages/admin/AdminUserManagement.jsx`
- `frontend/src/pages/admin/AcceptInvite.jsx`

### Files to Leave Untouched
All customer/vendor/affiliate pages, auth, ProtectedRoute, checkout, orders, payments, MessagesCenter

### Backend Changes

1. **`admin_role.py` model** — SQLAlchemy model for `admin_roles` table
2. **`admin_invitation.py` model** — SQLAlchemy model for `admin_invitations` table
3. **`permissions.py`** — `ROLE_PERMISSIONS` dict + `require_permission()` dependency factory
4. **`admin_users/routes.py`** — full CRUD for admin team management:
   - `GET /api/admin/team` — list team members
   - `POST /api/admin/team/invite` — create invitation
   - `POST /api/admin/team/activate` — accept invitation and activate
   - `POST /api/admin/team/{user_id}/deactivate` — deactivate member
   - `PUT /api/admin/team/{user_id}/role` — change role
   - `GET /api/admin/team/invitations` — pending invitations
   - `DELETE /api/admin/team/invitations/{id}` — cancel invitation
5. All endpoints protected by `require_permission("write:admin_team")` — only super_admin
6. `Base.metadata.create_all()` in `main.py` creates the new tables on startup
7. Seed script: mark existing seeded admin (`avikapawar4@gmail.com`) as `role_level='super_admin'` in `admin_roles` table

### Frontend Changes

**`AdminUserManagement.jsx`:**
- Team members table: avatar, name, email, role badge, status, joined date, actions
- Invite button → modal: email input + role selector dropdown
- Pending invitations section with cancel button
- Deactivate action with confirmation dialog
- Role change dropdown (super_admin only)

**`AcceptInvite.jsx`:**
- Reads `?token=` from URL
- Verifies token via `GET /api/admin/team/invitations/verify?token=X`
- If valid: shows role assignment confirmation and register/login CTA
- On register/login: activates admin role

**`AdminSidebar.jsx`:**
- Add "Team" nav item under Settings group
- Only visible when current admin is super_admin (check from permissions API)

**`App.jsx`:**
- Add lazy import for `AdminUserManagement`
- Add route `/admin/team` with `requiredRole="admin"`
- Add route `/admin/accept-invite` (public page, no ProtectedRoute)

### Firestore Changes
None (admin roles stored in SQLite only)

### SQLite Changes
New tables:
- `admin_roles` (id, user_id, role_level, permissions, invited_by, is_active, activated_at, deactivated_at, created_at, updated_at)
- `admin_invitations` (id, email, role_level, invite_token, invited_by, expires_at, accepted_at, created_at)

### API Changes
7 new endpoints for team management

### Security Impact
- HIGH importance — this is access control infrastructure
- Invite token: 32-character UUID, expires in 48 hours
- Deactivation immediately revokes admin access (next request gets 403)
- All actions audit-logged

### Performance Impact
None — admin_roles table is tiny

### Regression Checklist
- [ ] Existing admin login still works
- [ ] Existing seeded admin is recognized as super_admin
- [ ] All existing admin routes still work with updated `require_admin_role`
- [ ] Customer auth unchanged
- [ ] Vendor auth unchanged
- [ ] All existing admin pages still load
- [ ] Frontend build passes

### Manual Test Checklist
1. Login as existing admin → access Team Management page
2. Invite new admin with role 'moderator' → invitation appears in pending list
3. Visit `/admin/accept-invite?token=XXX` → confirm activation flow
4. New admin logs in → can access Reports, Reviews, Support only (moderator permissions)
5. New admin tries to access Team Management → gets 403
6. Super admin deactivates new admin → new admin gets 403 on next request
7. Super admin changes new admin role to 'admin' → new admin gets broader access
8. Cancel a pending invitation → disappears from list

### Rollback Strategy
Remove admin_users router from `main.py`. Drop `admin_roles` and `admin_invitations` tables. Remove new frontend pages from App.jsx. Remove Team nav item from sidebar.

### Acceptance Criteria
- Super admin can invite team members by email + role
- Invited admin can accept and activate account
- Role-based access enforced per `ROLE_PERMISSIONS`
- Deactivation immediately blocks access
- All team management actions audit-logged
- Existing admin account (super_admin) retains full access
- All existing admin functionality unchanged

---

## Summary

| Item | Value |
|---|---|
| **Current Production Readiness** | 73.8% |
| **Expected After Phase 4** | 94% |
| **Number of Milestones** | 8 |
| **Files to Modify** | ~15 existing files |
| **New Files to Create** | ~12 new files |
| **New Backend APIs** | ~18 new endpoints |
| **SQLite Changes** | 2 new tables (M4-M8) |
| **Firestore Changes** | New fields on orders + reports (M4-M3, M4-M4, M4-M5) |
| **Estimated Implementation** | ~3–4 days of focused implementation |

### High-Risk Areas
1. M4-M8 Admin User Management — most complex, touches auth logic
2. M4-M7 Vendor Product Approval — modifies `products_router.py` (protected)
3. M4-M1 JWT hard-fail — could block startup if `.env` not updated first

### Protected Systems Verification
- Customer auth: ✅ Untouched across all milestones
- Vendor auth: ✅ Untouched (M4-M7 only modifies default product status)
- Affiliate auth: ✅ Untouched
- Google OAuth: ✅ Untouched
- JWT: ⚠️ M4-M1 strengthens secret requirement — requires `.env` update
- ProtectedRoute: ✅ Untouched
- Checkout/Orders/Payments: ✅ Untouched
- MessagesCenter: ✅ Untouched
- messages_router.py: ✅ Untouched

---

**STOP. Awaiting explicit approval before implementing Milestone M4-M1.**
