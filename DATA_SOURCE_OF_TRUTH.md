# Phase 7: Master Data Source of Truth Specification

This document establishes the single authoritative source of truth for all Lumora domain models following Phase 4 data consolidation.

---

## Authoritative Database Specifications

### 1. Products
- **Source of Truth**: Render PostgreSQL (`products` table)
- **Secondary Mirror**: Firestore (`products` collection) for customer catalog indexing
- **Write Workflow**: Admin UI -> PostgreSQL -> Firestore mirror async background sync

### 2. Orders
- **Source of Truth**: Render PostgreSQL (`orders` & `order_items` tables)
- **Secondary Mirror**: Firestore (`orders` collection) for customer vault/purchases real-time UI
- **Write Workflow**: Checkout API -> PostgreSQL -> Firestore mirror sync

### 3. Payments
- **Source of Truth**: Render PostgreSQL (`payments` table)
- **Write Workflow**: Razorpay Webhook -> PostgreSQL

### 4. Reviews
- **Source of Truth**: Render PostgreSQL (`reviews` table)
- **Secondary Mirror**: Firestore (`reviews` collection)

### 5. Reports
- **Source of Truth**: Render PostgreSQL (`reports` table)
- **Secondary Mirror**: Firestore (`reports` collection)

### 6. Users & Customers
- **Source of Truth**: Render PostgreSQL (`users` table)
- **Authentication**: Firebase Authentication / JWT
- **Sync**: User Registration -> PostgreSQL `users` table + Firebase Auth UID link

### 7. Notifications
- **Source of Truth**: Render PostgreSQL (`notifications` table)

### 8. Team & Permissions
- **Source of Truth**: Render PostgreSQL (`admin_roles` & `admin_invitations` tables)

### 9. Audit Logs
- **Source of Truth**: Render PostgreSQL (`audit_logs` table)

### 10. Referral Links & Campaigns
- **Source of Truth**: Render PostgreSQL (`referral_links` table)

---

## Architecture Principle

For every Admin Panel feature and backend route in Lumora, **Render PostgreSQL is the single authoritative source of truth**. Firestore operates purely as a read-only or real-time mirror for customer UI listeners, eliminating all dependencies on Firestore for core administrative features and preventing HTTP 429 quota disruptions.
