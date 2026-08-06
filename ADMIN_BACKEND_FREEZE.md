# ADMIN BACKEND FREEZE MANIFEST & PRODUCTION SPECIFICATION

**Status**: FROZEN & PRODUCTION-READY  
**Freeze Effective Date**: August 6, 2026  
**Scope**: All Admin Backend API Endpoints, FastAPI Routers, Business Services, SQLAlchemy Models, Database Schemas, Authorization Middleware, Payment Integrations, and Audit Systems.

---

> [!IMPORTANT]
> **STRICT POLICY**: Any modification to the frozen APIs, services, models, routes, or business logic defined in this document **requires explicit approval** from the lead architecture authority. No refactoring, workflow changes, or contract mutations are permitted during routine UI updates or maintenance.

---

## 1. Frozen API Endpoints

The following REST API endpoints are frozen for backward compatibility with all production clients:

| Category | Endpoint Path | Method | Description |
| :--- | :--- | :---: | :--- |
| **Authentication** | `/api/admin/auth/login` | `POST` | Separate Admin JWT authentication |
| | `/api/admin/auth/me` | `GET` | Current authenticated admin session profile |
| **Analytics** | `/api/admin/analytics/kpis` | `GET` | Enterprise system metrics & revenue aggregation |
| | `/api/admin/analytics/charts` | `GET` | Time-series revenue, commission, and order analytics |
| **Products** | `/api/admin/products` | `GET`, `POST` | Product listing & create service |
| | `/api/admin/products/{id}` | `GET`, `PUT`, `DELETE` | Product detail, edit, and soft/hard delete |
| **Orders** | `/api/admin/orders` | `GET` | Order history & search filtering |
| | `/api/admin/orders/{id}` | `GET` | Order breakdown, items, and attribution trace |
| **Customers** | `/api/admin/customers` | `GET` | Customer directory & status management |
| | `/api/admin/customers/{id}/status` | `PATCH` | Enable / disable customer account |
| **Vendors** | `/api/admin/vendors` | `GET` | Creator directory & status management |
| | `/api/admin/vendors/{id}/status` | `PATCH` | Enable / disable vendor account & sync to Firestore |
| **Affiliates** | `/api/admin/affiliates` | `GET` | Affiliate directory & financial profiles |
| | `/api/admin/affiliates/payouts` | `GET` | Payout request queue |
| | `/api/admin/affiliates/payouts/{id}/test-payout` | `POST` | Development test payout flow (runs `complete_payout()`) |
| | `/api/admin/affiliates/payouts/{id}/status` | `PATCH` | Approve, hold, or reject payout |
| | `/api/admin/affiliates/commissions` | `GET` | Ledger of approved/paid affiliate commissions |
| **Refunds** | `/api/admin/refunds` | `GET` | Refund request queue |
| | `/api/admin/refunds/{id}/approve` | `POST` | Approve refund & trigger payment gateway refund |
| | `/api/admin/refunds/{id}/reject` | `POST` | Reject refund request |
| **Treasury** | `/api/admin/treasury/withdrawals` | `GET` | Platform treasury withdrawal history |
| | `/api/admin/treasury/withdraw` | `POST` | Execute platform treasury withdrawal |
| **Invitations** | `/api/admin/invitations` | `GET`, `POST` | Admin team invitations & resend flow |
| | `/api/admin/invitations/{id}` | `DELETE` | Revoke pending invitation |
| **Reviews** | `/api/admin/reviews` | `GET`, `PATCH`, `DELETE` | Review moderation |
| **Reports** | `/api/admin/reports` | `GET`, `PATCH` | Content violation report resolution |
| **Support** | `/api/admin/support/tickets` | `GET`, `POST` | Support ticket queue & admin replies |
| **Settings** | `/api/admin/settings` | `GET`, `PUT` | System configuration & platform pause state |

---

## 2. Frozen Backend Services & Core Handlers

1. **`complete_payout()`** (`app/payments/payout/completion_handler.py`):
   - Single source of truth for payout completion across test payouts and RazorpayX webhooks.
   - Row-level lock (`.with_for_update()`), idempotency guard check, atomic deduction of `pending_earnings`, increment of `paid_earnings`, transition of approved commissions to `paid`, and `AuditLog` write.

2. **`log_admin_action()`** (`app/services/audit_log_service.py`):
   - Immutable audit logging service writing directly to PostgreSQL `audit_logs`.

3. **`update_vendor_status()`** (`admin_controls/vendor/services.py`):
   - Handles vendor status state machine (active/suspended) with dual-write synchronization between PostgreSQL `vendors` table and Firestore `vendors` collection.

4. **`update_affiliate_status()`** (`admin_controls/affiliate/services.py`):
   - Manages affiliate lifecycle status and syncs profile settings.

5. **`RefundService`** (`app/services/refund_service.py`):
   - Executes refund eligibility checks, payment gateway refund requests, order status updates, and commission reversal logic.

---

## 3. Frozen Database Models & Schema Contracts

| SQLAlchemy Model | PostgreSQL Table | Primary Key | Critical Frozen Fields |
| :--- | :--- | :---: | :--- |
| `User` | `users` | `id` (int) | `email`, `role`, `is_active`, `password_hash`, `created_at` |
| `Product` | `products` | `id` (int) | `title`, `price`, `vendor_id`, `status`, `affiliate_enabled`, `commission_value` |
| `Order` | `orders` | `id` (int) | `total_amount`, `payment_status`, `user_id`, `affiliate_id`, `created_at` |
| `AffiliateProfile` | `affiliate_profiles` | `id` (int) | `user_id`, `referral_code`, `pending_earnings`, `paid_earnings`, `kyc_status` |
| `AffiliatePayout` | `affiliate_payouts` | `id` (int) | `affiliate_id`, `amount`, `status`, `razorpay_payout_id`, `completed_at` |
| `AffiliateCommission`| `affiliate_commissions` | `id` (int) | `affiliate_id`, `order_id`, `commission_amt`, `commission_status`, `status` |
| `AuditLog` | `audit_logs` | `id` (int) | `admin_user_id`, `action`, `target_type`, `target_id`, `metadata_json` |
| `PlatformWithdrawal` | `platform_withdrawals` | `id` (int) | `withdrawal_number`, `amount`, `status`, `requested_by`, `completed_at` |
| `AdminInvitation` | `admin_invitations` | `id` (int) | `email`, `invite_token`, `role_level`, `email_status`, `resend_count` |

---

## 4. Frozen Core Business Rules

1. **Authentication Preservation**:
   - Admin authentication is completely isolated from customer, vendor, and affiliate login flows.
   - Admin JWT tokens use dedicated validation and role verification (`require_admin_role`).

2. **Payout Logic Singularity**:
   - Development Test Payout and production RazorpayX webhooks execute the exact same `complete_payout()` service.
   - Balance updates (`paid_earnings` / `pending_earnings`) are exclusively owned by `complete_payout()`.

3. **Multi-Database Fallback for Reports**:
   - In case Firestore is over quota or unavailable, the backend reads and writes reports using the `SQLReport` PostgreSQL model.

4. **Product Ownership Architecture**:
   - Products explicitly track `owner_type` (`PLATFORM` vs `VENDOR`) and `created_by_role` (`ADMIN` vs `VENDOR`).

5. **Audit Trail Integrity**:
   - All admin mutations (status changes, payouts, refunds, invitations, settings updates) append immutable JSON metadata records into `audit_logs`.

---

## 5. Explicit Approval Clause

> **NOTICE TO ALL DEVELOPERS AND AGENTS**:  
> **Any modification to the above APIs, Services, Models, Routes, Business Rules, or Database Schemas requires explicit written approval.**  
> Future work is restricted exclusively to UI enhancements, styling, labeling, layout responsiveness, and performance optimizations that preserve existing backend business logic without modification.
