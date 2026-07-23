# Phase 4 — Marketplace Integration & Intelligence
**Project:** Lumora Digital Marketplace
**Phase:** 4 — Production Completion
**Based on:** MarketplaceIntegrationRequirement.md + MarketplaceIntegrationDesign.md + MarketplaceIntegrationTasks.md

---

## Milestone Overview

| Milestone | Name | Risk | Effort |
|-----------|------|------|--------|
| M4-M1 | Security Hardening | LOW | 30 min |
| M4-M2 | Audit Log Completeness | LOW | 2h |
| M4-M3 | Analytics Accuracy Fix | LOW | 3h |
| M4-M4 | Contact Form Backend | LOW | 1h |
| M4-M5 | Report Lifecycle Completion | MEDIUM | 3h |
| M4-M6 | Admin Notifications | LOW | 2h |
| M4-M7 | Vendor Product Approval | MEDIUM | 4h |
| M4-M8 | Admin User Management | HIGH | 2 days |

---

## Tasks

### MILESTONE M4-M1 — Security Hardening

- [x] 1. In `backend/app/main.py` `_validate_startup_config()`: change JWT secret check to hard `sys.exit(1)` when `len(jwt_secret) < 32` instead of warning
- [x] 2. In `backend/app/main.py` CORSMiddleware: read `CORS_ORIGINS` from env var, default to `["http://localhost:5173", "http://localhost:5174"]` when not set
- [x] 3. In `.gitignore`: add `lumora-e6ddc-firebase-adminsdk-fbsvc-abcf2d8c21.json` and `*-firebase-adminsdk-*.json` entries
- [x] 4. Run `python -c "from app.main import app; print('OK')"` — must PASS
- [x] 5. Verify backend starts when JWT_SECRET_KEY is 32+ chars and refuses when shorter

---

### MILESTONE M4-M2 — Audit Log Completeness

- [x] 1. Create `backend/app/services/audit_log_service.py` with `log_admin_action(db, admin_user_id, action, target_type, target_id, metadata, ip_address)` helper
- [x] 2. Add `log_admin_action()` calls to `backend/app/admin_api/orders/routes.py` for: order status change (`order_status_change`), refund (`order_refund`), dispute (`order_dispute`)
- [x] 3. Add `log_admin_action()` call to `backend/app/admin_api/reviews/routes.py` moderate endpoint: `review_moderated`
- [x] 4. Add `log_admin_action()` calls to `backend/app/admin_api/support/routes.py`: `support_ticket_replied`, `support_ticket_status_changed`
- [x] 5. Add `log_admin_action()` calls to `backend/app/admin_api/reports/routes.py`: `report_resolved`, `report_rejected`, `report_assigned`
- [x] 6. Add new action types to `ACTION_COLORS` and `ACTION_OPTIONS` in `frontend/src/pages/admin/AuditLogs.jsx`
- [x] 7. Run `python -c "from app.main import app; print('OK')"` — must PASS
- [x] 8. Run `npm run build` — must PASS

---

### MILESTONE M4-M3 — Analytics Accuracy Fix

- [x] 1. Add `compute_growth(current_orders, previous_orders)` function to `backend/app/admin_api/analytics/services.py`
- [x] 2. In `get_analytics_dashboard_data()`: fetch previous period orders for 30d view and replace hardcoded `revenueChange: 12`, `growthVelocity: 18`, `conversionRate: 3.2`, `aovGrowth: 4` with computed values
- [x] 3. In `backend/admin/firestore/admin_firestore.py` `sync_order_to_firestore()`: add `"region"` field to Firestore order document (default `"India"` placeholder)
- [ ] 4. Run `python -c "from app.main import app; print('OK')"` — must PASS
- [x] 5. Verify Analytics dashboard loads and KPI cards show computed (non-hardcoded) values

---

### MILESTONE M4-M4 — Contact Form Backend

- [x] 1. Create `backend/app/api/contact_router.py` with `POST /api/contact` — public endpoint, rate-limit 3/hour per IP, writes to Firestore `reports` collection with `category: 'contact_request'`, returns 201 or 503
- [x] 2. Register contact router in `backend/app/main.py`: `app.include_router(contact_router, prefix="/api/contact", tags=["Contact"])`
- [x] 3. Run `python -c "from app.main import app; print('OK')"` — must PASS
- [x] 4. In `frontend/src/pages/support/Contact.jsx`: replace `setSent(true)` stub with real `backendFetch('/contact', { method:'POST', body: JSON.stringify(form) })`, keep `setSent(true)` on 201, add error state on failure
- [ ] 5. Run `npm run build` — must PASS
- [x] 6. Verify contact submission appears in Admin Reports panel under `category: 'contact_request'`

---

### MILESTONE M4-M5 — Report Lifecycle Completion

- [x] 1. In `backend/app/admin_api/reports/services.py` `update_report_status()`: add optional `resolution_note` param, write `resolution_note` and `resolvedAt` to Firestore report document on resolve/reject
- [x] 2. In `backend/app/admin_api/reports/routes.py`: add optional `note: str = Body(None)` to `/resolve` and `/reject` endpoints, pass to `update_report_status()`
- [x] 3. In `frontend/src/pages/customer/Dashboard.jsx`: add "My Reports" sub-section inside Support tab — calls `GET /api/reports/me`, shows title/category/status badge/resolution_note/date
- [ ] 4. Run `python -c "from app.main import app; print('OK')"` — must PASS
- [ ] 5. Run `npm run build` — must PASS
- [ ] 6. Verify customer can see submitted report status and resolution note after admin resolves

---

### MILESTONE M4-M6 — Admin Notifications

- [ ] 1. Create `backend/app/admin_api/notifications/__init__.py`
- [ ] 2. Create `backend/app/admin_api/notifications/routes.py` with `GET /counts` — returns `{ support_tickets, reports, pending_orders, total }` with 30-second server-side cache, requires admin JWT
- [ ] 3. Register notifications router in `backend/app/main.py` at prefix `/api/admin/notifications`
- [ ] 4. Run `python -c "from app.main import app; print('OK')"` — must PASS
- [ ] 5. In `frontend/src/pages/admin/components/AdminSidebar.jsx`: add 60-second polling of `/api/admin/notifications/counts`, show badge on "Support Inbox" when `support_tickets > 0`, badge on "Reports" when `reports > 0`, total badge in sidebar header
- [ ] 6. Run `npm run build` — must PASS
- [ ] 7. Verify badge appears in sidebar after submitting a support ticket as customer

---

### MILESTONE M4-M7 — Vendor Product Approval

- [ ] 1. In `backend/app/api/products_router.py` `POST /api/products/`: set initial status to `'pending_review'` when creator role is vendor, `'published'` when creator is admin
- [ ] 2. Create `backend/app/admin_api/products/__init__.py`
- [ ] 3. Create `backend/app/admin_api/products/routes.py` with: `GET /pending` (paginated list of pending_review products), `POST /{product_id}/approve` (publish + audit log), `POST /{product_id}/reject` (reject + reason + audit log)
- [ ] 4. Register admin products router in `backend/app/main.py`
- [ ] 5. Run `python -c "from app.main import app; print('OK')"` — must PASS
- [ ] 6. In `frontend/src/pages/admin/ProductsManagement.jsx`: add "Pending Review" filter tab, show Approve/Reject action buttons on pending products, rejection modal with reason input
- [ ] 7. Run `npm run build` — must PASS
- [ ] 8. Verify: vendor creates product → status is `pending_review` → not visible on marketplace → admin approves → appears on marketplace

---

### MILESTONE M4-M8 — Admin User Management

- [ ] 1. Create `backend/app/models/admin_role.py` — SQLAlchemy model for `admin_roles` table with columns: id, user_id (FK), role_level, permissions (JSON text), invited_by (FK nullable), is_active, activated_at, deactivated_at, created_at, updated_at
- [ ] 2. Create `backend/app/models/admin_invitation.py` — SQLAlchemy model for `admin_invitations` table with columns: id, email, role_level, invite_token (unique), invited_by (FK), expires_at, accepted_at, created_at
- [ ] 3. Create `backend/app/core/permissions.py` — `ROLE_PERMISSIONS` dict for roles (super_admin, admin, moderator, support, finance, marketing, analyst) + `require_permission(permission)` FastAPI dependency factory
- [ ] 4. Create `backend/app/admin_api/admin_users/__init__.py`
- [ ] 5. Create `backend/app/admin_api/admin_users/routes.py` with full CRUD: `GET /team`, `POST /team/invite`, `POST /team/{user_id}/activate`, `POST /team/{user_id}/deactivate`, `PUT /team/{user_id}/role`, `GET /team/invitations`, `DELETE /team/invitations/{id}` — all protected by `require_permission("write:admin_team")`
- [ ] 6. Register admin_users router in `backend/app/main.py`, ensure `Base.metadata.create_all()` creates new tables
- [ ] 7. Run `python -c "from app.main import app; print('OK')"` — must PASS (tables auto-created)
- [ ] 8. Create `frontend/src/pages/admin/AdminUserManagement.jsx` — team table, invite modal, pending invitations section, deactivate/role-change actions
- [ ] 9. Create `frontend/src/pages/admin/AcceptInvite.jsx` — reads `?token=` from URL, verifies token, shows confirmation and register/login CTA
- [ ] 10. In `frontend/src/pages/admin/components/AdminSidebar.jsx`: add "Team Management" nav item under Settings group
- [ ] 11. In `frontend/src/App.jsx`: add lazy imports and routes for `/admin/team` (requiredRole="admin") and `/admin/accept-invite` (public)
- [ ] 12. Run `npm run build` — must PASS
- [ ] 13. Verify: existing admin login works, super_admin can invite team member, invited admin can accept and activate, deactivation blocks access
