# Implementation Tasks — Admin Team Management & Invitation System

## Task List

- [x] 1. Database migrations (SQLite ALTER TABLE) — app/main.py `_run_schema_migrations()`
- [x] 2. Email service (`app/services/email_service.py`)
- [x] 3. Firestore sync helpers (`admin/firestore/admin_firestore.py` — 3 new helpers)
- [x] 4. Model updates — `admin_invitation.py` (revoked_at, invited_name, message) + `user.py` (last_login_at)
- [x] 5. Backend routes — `app/admin_api/admin_users/routes.py` (resend, soft-revoke, audit log, /me, Firestore writes, email)
- [x] 6. Backend: admin login sets last_login_at — `admin/routes/auth.py`
- [x] 7. Backend: notifications counts includes team_invites — `app/admin_api/notifications/routes.py`
- [x] 8. Frontend: AdminContext (`frontend/src/context/AdminContext.jsx`)
- [x] 9. Frontend: AdminSidebar — RBAC filter + team badge (`components/AdminSidebar.jsx`)
- [x] 10. Frontend: AdminUserManagement — all UI changes (`pages/admin/AdminUserManagement.jsx`)
- [x] 11. Frontend: AdminNotificationBanner (`components/AdminNotificationBanner.jsx`)
- [x] 12. Frontend: App.jsx — AdminContextProvider + AdminNotificationBanner wired
