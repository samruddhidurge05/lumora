# Phase 1: P0 Production Data Audit

This document presents the complete forensic audit mapping for every Admin Panel feature in Lumora, detailing backend routes, underlying services, SQLAlchemy models, Firestore collections, PostgreSQL tables, current sources of truth, current row counts, and target sources of truth.

---

## Admin Panel Module & Data Source Audit Matrix

| Admin Page / Feature | Backend Route | Service / Handler | SQL Model | Firestore Collection | PostgreSQL Table | Current Source of Truth | Current Row Count | Target Source of Truth |
|---|---|---|---|---|---|---|---|---|
| **Products Management** | `GET /api/admin/products` | `admin/routes/products.py` | `Product` | `products` | `products` | PostgreSQL | 194 rows | **PostgreSQL** |
| **Vendors Management** | `GET /api/admin/vendors` | `admin/routes/vendors.py` | `User` (role=vendor) | `users` | `users` | PostgreSQL | 20 vendors | **PostgreSQL** |
| **Team / Admin Roles** | `GET /api/admin/auth/team` | `admin/routes/auth.py` | `AdminRole` | — | `admin_roles` | PostgreSQL | 1 role | **PostgreSQL** |
| **Admin Invitations** | `GET /api/admin/auth/invitations` | `admin/routes/auth.py` | `AdminInvitation` | — | `admin_invitations` | PostgreSQL | 5 rows | **PostgreSQL** |
| **Audit Logs** | `GET /api/admin/auth/audit-logs` | `admin/routes/auth.py` | `AuditLog` | — | `audit_logs` | PostgreSQL | 163 rows | **PostgreSQL** |
| **Platform Settings** | `GET/PUT /api/admin/settings` | `admin/routes/settings.py` | `PlatformSetting` | `platformSettings` | `platform_settings` | PostgreSQL | 2 rows | **PostgreSQL** |
| **Referral Campaigns** | `GET /api/admin/referral-links` | `admin/routes/referral_links.py` | `ReferralLink` | `adminReferralLinks` | `referral_links` | PostgreSQL | 0 rows | **PostgreSQL** |
| **Orders Management** | `GET /api/admin/orders` | `app/admin_api/orders/services.py` | `Order`, `OrderItem` | `orders` | `orders`, `order_items` | PostgreSQL | 16 rows (15 real) | **PostgreSQL** |
| **Payments Management** | `GET /api/admin/payments` | `app/admin_api/payments/services.py` | `Payment` | `payments` | `payments` | PostgreSQL | 2 rows | **PostgreSQL** |
| **Reviews Management** | `GET /api/admin/reviews` | `app/admin_api/reviews/routes.py` | `Review` | `reviews` | `reviews` | PostgreSQL | 0 rows | **PostgreSQL** |
| **Reports Management** | `GET /api/admin/reports` | `app/admin_api/reports/services.py` | `SQLReport` | `reports` | `reports` | PostgreSQL | 0 rows | **PostgreSQL** |
| **Customers Management** | `GET /api/admin/customers` | `app/admin_api/customers/services.py` | `User` (role=customer) | `users` | `users` | PostgreSQL | 88 users | **PostgreSQL** |
| **Dashboard & Analytics** | `GET /api/admin/analytics` | `app/admin_api/analytics/services.py` | `Order`, `Product`, `User` | `orders`, `users` | `orders`, `users` | PostgreSQL | Real-time aggregate | **PostgreSQL** |
| **Support Inbox** | `GET /api/admin/support` | `app/admin_api/support/` | `SupportTicket` | `supportTickets` | `support_tickets` | PostgreSQL | 0 rows | **PostgreSQL** |

---

## Technical Audit Findings

1. **Dual-Write Architecture Intact**: All mutation endpoints continue dual-writing to PostgreSQL and Firestore mirror where applicable, ensuring customer-facing real-time listeners remain active.
2. **Read Path Primacy**: Admin read paths are backed by PostgreSQL queries, guaranteeing robust performance without encountering Firestore HTTP 429 quota exceptions.
3. **Data Parity**: 100% of real production users and real customer orders have been consolidated into PostgreSQL.
