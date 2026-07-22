# Lumora Project Rules

## Authentication Preservation
- **NEVER** modify, revert, or disable the authentication fixes, email verification flows, lowercase/strip email normalization, or login gates in the Lumora codebase.
- Standard customer/vendor/affiliate login and registration must always enforce email verification status.
- Admin authentication flows must remain separate and must not be forced through email verification checks.

## Payment & Checkout Page Preservation
- **NEVER** restore manual payment tabs, input controls, or custom UPI/Card forms on the checkout/payment page. The checkout flow must remain unified under a single primary "Pay" button that directly triggers Razorpay Checkout.
- **NEVER** round the checkout total to the nearest integer on the frontend (e.g., using `Math.round`) prior to sending it to the backend. The total must be calculated as a precise float to pass backend expected-total validation.

## Product File Extension Integrity
- **NEVER** hardcode product file extensions (like `.zip`) in the backend product creation/update services. Always preserve and use the original uploaded file extension from the temporary source path.

## Multi-Database Fallback for Reports
- **NEVER** remove the SQL database fallback and dual-write logic for reports. In case Firestore is over quota or unavailable, the backend must gracefully read and write reports via the `SQLReport` SQL database model.

## Message Center Removal
- **NEVER** restore or re-add the customer-creator direct "Messages Center" (chat conversation system) on the customer dashboard or product/creator pages unless explicitly requested. All customer inquiries must be routed through the Support Center ticket system.

## Price Alert Types
- **NEVER** change the `product_id` parameter or DB column type for `PriceAlert` and `RecentlyViewed` from `Integer` to string (`str`/`Union`), to ensure full compatibility with SQL database queries and avoid type mismatch failures.

# ======================================================================
# Admin Panel Preservation & Production Rules
# ======================================================================

## Admin Architecture Preservation
- **NEVER** modify or replace the overall Admin Panel architecture without explicit approval. The current Admin Panel is considered production-ready and its structure, routing, shared components, and design system must remain intact.

## Admin Backend Preservation
- **NEVER** modify Admin backend business logic, service workflows, database interactions, authentication flow, authorization checks, or API contracts unless explicitly requested.
- Existing Admin APIs must remain backward compatible with the frontend.

## Admin Dashboard Preservation
- **NEVER** alter Dashboard calculations, KPI logic, analytics aggregation, statistics generation, Firestore listeners, SQL queries, or realtime update mechanisms unless specifically requested.
- Dashboard metrics must continue updating in real time exactly as implemented.

## Admin Authentication Preservation
- **NEVER** merge Admin authentication with Customer, Vendor, or Affiliate authentication.
- Admin authentication must remain completely isolated.
- Admin authorization middleware, JWT validation, and role verification must remain unchanged.

## Admin Realtime Data Preservation
- **NEVER** remove, replace, or degrade existing realtime synchronization.
- Existing Firestore `onSnapshot` listeners, realtime subscriptions, and update flows must continue functioning without polling replacements.

## Admin Permission System Preservation
- **NEVER** modify permission logic controlling:
  - Vendor Enable / Disable
  - Affiliate Enable / Disable
  - Customer status management
  - Admin-only actions
  unless explicitly requested.

- Existing permission enforcement across frontend and backend must remain unchanged.

## Admin Product Management Preservation
- **NEVER** modify the product creation, editing, publishing, deletion, media upload, Backblaze integration, product validation, or synchronization logic unless explicitly requested.
- Product lifecycle from Admin → Backend → Database → Marketplace → Purchase → Download must remain fully functional.

## Admin Order Management Preservation
- **NEVER** modify order processing, order synchronization, payment confirmation handling, order status updates, download generation, or customer purchase history through Admin unless explicitly requested.

## Admin Payment Preservation
- **NEVER** modify Razorpay integration, payment verification, payment confirmation, payment security validation, or PurchaseService execution unless explicitly requested.

## Admin Referral System Preservation
- **NEVER** modify the completed Admin Referral architecture without explicit approval.
- The referral system must continue to support:
  - realtime campaign analytics
  - click tracking
  - conversion tracking
  - earnings tracking
  - idempotent order logging
  - Firestore synchronization
  while preserving the existing Affiliate system.

## Affiliate System Isolation
- **NEVER** allow Admin Referral changes to affect:
  - AffiliateProfile
  - AffiliateCommission
  - affiliate earnings
  - affiliate payouts
  - affiliate analytics
  - affiliate authentication
- The Admin Referral System and Affiliate System must remain isolated while coexisting.

## Customer / Vendor Isolation
- **NEVER** allow Admin-specific modifications to alter Customer or Vendor business logic, authentication, dashboards, checkout, purchase flow, downloads, or permissions unless explicitly requested.

## Firestore Preservation
- **NEVER** remove, rename, restructure, or repurpose existing Admin Firestore collections, documents, or field names without explicit approval.
- Existing realtime listeners must remain compatible.

## SQLite Preservation
- **NEVER** change SQL schemas, primary keys, foreign keys, data types, or existing database relationships for Admin functionality unless explicitly requested.

## API Contract Preservation
- **NEVER** change request payloads, response structures, endpoint paths, authentication requirements, or HTTP status behavior for Admin APIs unless explicitly requested.

## Admin UI Structure Preservation
- **NEVER** redesign the Admin Panel architecture.
- Shared components (AdminLayout, AdminSidebar, AdminComponents, design system, responsive layout, navigation structure, routing hierarchy) must remain intact.
- Future UI work should extend the current system instead of replacing it.

## Production Responsiveness Preservation
- **NEVER** remove or regress responsive behavior implemented for desktop, tablet, or mobile.
- Future UI modifications must preserve responsive layouts across supported breakpoints.

## Media Handling Preservation
- **NEVER** modify the current product image loading, thumbnail rendering, media resolver, Backblaze integration, or caching behavior unless explicitly requested.

## Production Stability Rule
- When implementing any new feature:
  1. Preserve all existing business logic.
  2. Preserve all existing API behavior.
  3. Preserve all existing realtime functionality.
  4. Preserve all authentication and authorization flows.
  5. Preserve all database interactions.
  6. Preserve all payment flows.
  7. Preserve all responsive layouts.
  8. Preserve all production-tested functionality.
  9. Modify only the minimum required files.
  10. Never perform unrelated refactoring during feature implementation.

## Mandatory Regression Verification
- Before completing any future task, verify that changes have NOT affected:
  - Admin Dashboard
  - Products
  - Orders
  - Customers
  - Vendors
  - Affiliates
  - Referral Campaigns
  - Payments
  - Downloads
  - Authentication
  - Authorization
  - Firestore realtime updates
  - SQLite operations
  - API responses
  - Responsive layouts
  - Backblaze media handling

If any unrelated behavior changes, treat it as a regression and restore the previous behavior before considering the task complete.