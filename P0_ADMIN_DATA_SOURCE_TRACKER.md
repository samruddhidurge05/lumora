# P0 Admin Data Source Tracker

This document serves as the authoritative source-of-truth mapping for all Lumora Admin Panel modules, detailing their database ownership, current status, restoration phase, and required recovery actions.

---

## Admin Pages & Data Source Matrix

| Admin Page / Feature | Backend Route | Database Ownership | Current Status | Restore Phase | Action Required |
|---|---|---|---|---|---|
| **Products Management** | `GET /api/admin/products` | PostgreSQL | Healthy (194 rows in Render PG) | Completed | None — PostgreSQL data is active and primary. |
| **Vendors Management** | `GET /api/admin/vendors` | PostgreSQL (`users` role=vendor) | Healthy (20 vendors in Render PG) | Completed | None — Verified in Render PG. |
| **Team / Admin Roles** | `GET /api/admin/auth/team` | PostgreSQL (`admin_roles`, `users`) | Healthy (1 admin role present) | Phase 1 | Verified — Self-heals on admin login. |
| **Admin Invitations** | `GET /api/admin/auth/invitations` | PostgreSQL (`admin_invitations`) | Missing (0 rows in Render PG) | Phase 1 | **Restore** 6 verified production invitations from backup. |
| **Audit Logs** | `GET /api/admin/auth/audit-logs` | PostgreSQL (`audit_logs`) | Partial (2 rows in Render PG) | Phase 1 | **Restore** 162 verified production audit logs from backup (remap user_id 8→2). |
| **Platform Settings** | `GET/PUT /api/admin/settings` | PostgreSQL (`platform_settings`) | Missing (0 rows in Render PG) | Phase 1 | **Seed** 2 legitimate platform default settings. |
| **Referral Campaigns** | `GET /api/admin/referral-links` | PostgreSQL (`referral_links`) | Healthy (Schema present, 0 links) | Phase 1 | Verified — SQL primary, ready for creation. |
| **Orders Management** | `GET /api/admin/orders` | Firestore (Primary) / PG (Fallback) | Blocked by HTTP 429 | Phase 2 | **Wait** — Await Firestore quota restoration. |
| **Payments Management** | `GET /api/admin/payments` | Firestore | Blocked by HTTP 429 | Phase 2 | **Wait** — Await Firestore quota restoration. |
| **Reviews Management** | `GET /api/admin/reviews` | Firestore | Blocked by HTTP 429 | Phase 2 | **Wait** — Await Firestore quota restoration. |
| **Reports Management** | `GET /api/admin/reports` | Firestore (Primary) / PG (Fallback) | Blocked by HTTP 429 | Phase 2 | **Wait** — Await Firestore quota restoration. |
| **Customers Management** | `GET /api/admin/customers` | Firestore (Primary) / PG (Fallback) | Blocked by HTTP 429 | Phase 2 | **Wait** — Await Firestore quota restoration. |
| **Dashboard & Analytics** | `GET /api/admin/analytics` | Firestore | Blocked by HTTP 429 | Phase 2 | **Wait** — Await Firestore quota restoration. |
| **Support Inbox** | `GET /api/admin/support` | Firestore | Blocked by HTTP 429 | Phase 2 | **Wait** — Await Firestore quota restoration. |

---

## Detailed Data Source Analysis

### Phase 1: PostgreSQL-Owned Modules (ACTIVE RECOVERY)

1. **`admin_invitations`**
   - **Original Source**: Local backup `lumora_backup_20260718_233756.db`.
   - **Why Missing on Render PG**: Invitations were created locally during admin setup but never pushed/migrated to the remote Render PostgreSQL database.
   - **Data Quality**: 6 verified production invitations (real Gmail addresses: `durgesamruddhi@gmail.com`, `68.samruddhidurge@gmail.com`, `avikapawar4@gmail.com`, `alokparmar251181@gmail.com` x2, `vaizagupta19@gmail.com`). 0 synthetic `@lumora.io` records.

2. **`audit_logs`**
   - **Original Source**: Local backup `lumora_backup_20260718_233756.db`.
   - **Why Missing on Render PG**: Local admin actions (product creation, updates, invitation revocations, login attempts) were saved to local SQLite `lumora.db` before Render PostgreSQL was wired up.
   - **Data Quality**: 162 verified production audit records performed by `avikapawar08@gmail.com` (backup `admin_user_id` 8 -> mapped to Render PG `user_id` 2).

3. **`platform_settings`**
   - **Original Source**: Application defaults.
   - **Why Missing on Render PG**: `platform_settings` key-values were stored dynamically in Firestore or in-memory fallback. SQL table was created empty.
   - **Data Quality**: 2 legitimate default rows (`isPlatformPaused=false`, `pauseMessage`).

---

### Phase 2: Firestore-Owned Modules (ISOLATED / BLOCKED BY HTTP 429)

The following modules depend on Firestore as their primary real-time store. Because Firebase returns `HTTP 429 RESOURCE_EXHAUSTED`, these modules are intentionally untouched during Phase 1:
- Orders (`orders`)
- Payments (`payments`)
- Reviews (`reviews`)
- Reports (`reports`)
- Customers (`users` stream)
- Dashboard Analytics (`analytics`)
- Support Inbox (`support_tickets`)
