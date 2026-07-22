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

# ======================================================================
# Download Behavior Preservation
# ======================================================================

## No Automatic Device Downloads
- **NEVER** trigger automatic file downloads to the customer's device on purchase success, payment confirmation, or any other event.
- Files must ONLY download to the customer's device when the customer explicitly clicks a "Download" button in the Downloads section of their dashboard.
- The purchase success flow must navigate the customer to their vault/downloads section — it must NEVER call `window.location.href`, `<a download>`, or any browser download API automatically.
- The `DownloadReadyPopup` must only offer a "Go to Downloads" navigation action, never an automatic device download trigger.

# ======================================================================
# Affiliate Referral Flow Preservation
# ======================================================================

## Referral Link Format
- **NEVER** change the affiliate referral link format. Valid formats are:
  - `/ref/:code/product/:productId`
  - `/ref/:code`
- The `ReferralRouteHandler` component handles these routes and must remain the sole entry point for referral processing.

## Referral Data Persistence Across Login
- **NEVER** remove the `lumora_pending_referral` localStorage key that stores `{ session_id, referral_code, product_id, timestamp }` across the login redirect.
- **NEVER** remove the `lumora_aff_ref` and `lumora_ref_session_id` sessionStorage keys used for referral session tracking.
- These keys must survive the login redirect so attribution is preserved after authentication.

## Referral Redirect URL Format
- **NEVER** use `/product/:id` (path-only) as the post-login redirect URL for referral links. The SPA has no `/product/:id` route.
- The correct redirect format is `/#product/:id` (hash-based SPA URL), e.g., `/#product/123`.
- `ReferralRouteHandler` must always build the redirect as:
  ```
  /auth/login?role=customer&redirect=%2F%23product%2F123&ref=ABC123
  ```

## Exact Product Opens After Referral Login
- **NEVER** redirect customers to the generic dashboard after clicking an affiliate referral link and logging in.
- After login, the exact product in the referral link MUST open automatically.
- `Login.jsx` reads the `redirect` query param (set by `ReferralRouteHandler`) and navigates to it after successful login. This param must NEVER be removed.
- Priority order for post-login navigation: `next` param (admin invite) → `redirect` param (referral product) → `/${role}/dashboard` (default).
- This applies to email/password login, Google Sign-In, and GitHub Sign-In — all three handlers must respect the `redirect` param.

## Post-Authentication Referral Attribution in App.jsx
- **NEVER** replace the `navigateTo('product-detail', id)` call in the `AppContent` post-auth referral processor with `window.location.href`.
- `window.location.href` performs a hard navigation that resets `AppContext` state, causing the home page to render instead of the product.
- The referral processor in `App.jsx` (`AppContent` component) must call `navigateTo('product-detail', pending.product_id)` after a successful `/affiliate/referrals/authenticate` backend call.
- On attribution failure, the product must still open — attribution errors must never block the customer from seeing the product.

## Referral Attribution Backend Call
- **NEVER** remove the `POST /affiliate/referrals/authenticate` call in `ReferralRouteHandler` (for already-logged-in customers) or in the `AppContent` post-auth processor (for customers who just logged in).
- This call links the referral session to the authenticated customer in PostgreSQL and is required for admin purchase attribution tracking.
- The `AffiliateReferral` PostgreSQL model tracks: `CLICKED → AUTHENTICATED → PRODUCT_VIEWED → PURCHASED` lifecycle states.

## Referral Click Tracking
- **NEVER** remove the `POST /affiliate/referrals/click` backend call in `ReferralRouteHandler`.
- This registers the referral click and returns a `session_id` used for the full attribution lifecycle.

# ======================================================================
# Role-Based Login & Routing Preservation
# ======================================================================

## Login Page Role Isolation
- **NEVER** merge the customer, affiliate, vendor, and admin login pages into a single page.
- Each role has its own login context controlled by the `?role=` query parameter on `/auth/login`.
- When navigating to the affiliate login, the URL must always include `?role=affiliate`. Customer login must use `?role=customer`. Vendor must use `?role=vendor`.
- After login, each role navigates to its own dashboard: `/affiliate/dashboard`, `/vendor/dashboard`, `/customer/dashboard`, `/admin/dashboard`.

## ForgotPassword Role Preservation
- **NEVER** hardcode `?role=customer` in the "Sign In" link inside `ForgotPassword.jsx`.
- The `ForgotPassword` page reads the active role from `?role=` query param or `sessionStorage('lumora_last_auth_role')` and always routes back to `/auth/login?role=${activeRole}`.
- This ensures an affiliate who resets their password returns to the affiliate login, not the customer login.

## Role Persistence Across Navigation
- **NEVER** remove the `useEffect` in `AppContent` (`App.jsx`) that synchronizes the active auth role from URL params and path prefixes into `sessionStorage('lumora_last_auth_role')` and `localStorage('lumora_active_role')`.
- This effect is required to prevent role confusion when navigating between affiliate/vendor/customer/admin sections.

# ======================================================================
# React Hook Rules (CRITICAL — Prevents React Error #310)
# ======================================================================

## Hooks Must Always Be Unconditional
- **NEVER** place a conditional `return` statement before any React Hook (`useState`, `useEffect`, `useContext`, `useMemo`, `useCallback`, or any custom hook) in a component.
- All hooks must be declared at the TOP of the component function, before any `if` statement that returns JSX.
- **This rule was the root cause of React Error #310 (Minified React Error #310: "Rendered more hooks than during the previous render").**

## Login.jsx Hook Order (FROZEN)
- In `Login.jsx`, the hook declarations MUST follow this exact order:
  1. `useSearchParams` 
  2. `useNavigate`
  3. `useAuth`
  4. All `useState` declarations (email, password, rememberMe, errors, isLoading, authStatus, statusMessage)
  5. `useEffect` (justRegistered banner restoration)
  6. **ONLY THEN**: the `if (!role || !validRoles.includes(role)) return <Navigate>` guard
- **NEVER** move the role-guard `return <Navigate>` above the hook declarations.

## Register.jsx Hook Order (FROZEN)
- In `Register.jsx`, the hook declarations MUST follow this exact order:
  1. `useSearchParams`
  2. `useAuth`
  3. `useNavigate`
  4. All `useState` declarations (name, email, password, errors, isLoading, pwStrength)
  5. **ONLY THEN**: the `if (!role || (!validRoles.includes(role) && !isAdminInvite)) return <Navigate>` guard
- **NEVER** move the role-guard `return <Navigate>` above the hook declarations.

## AdminContextProvider Always Mounted
- **NEVER** conditionally mount `AdminContextProvider` based on route, user role, or any runtime condition.
- `AdminContextProvider` must always be mounted statically at the root level in `App.jsx`, wrapping `AdminBoundary` and `AppContent`.
- Conditional provider mounting changes the React hook tree between renders and causes Error #310.

# ======================================================================
# SPA Navigation Rules
# ======================================================================

## Hash-Based Product Navigation
- The Lumora SPA uses hash-based navigation for product pages: `/#product/:id`.
- **NEVER** create or navigate to a path-based `/product/:id` route — no such route exists in `App.jsx`.
- To navigate to a product page, always use `navigateTo('product-detail', productId)` from `useApp()`, which sets `activeProductId`, calls `navigate(\`/#product/${productId}\`)`, and updates `currentView`.
- Direct hash navigation via `window.location.href = \`/#product/${id}\`` bypasses `AppContext` state and must NEVER be used for product navigation.

## AppContext currentView State
- `currentView` in `AppContext` controls which page the SPA renders (via `SPARouter`).
- Navigations via `window.location.href` or `window.location.hash =` bypass `currentView` updates and will show stale/wrong content.
- Always use `navigateTo(view, payload)` from `useApp()` for in-SPA navigation to ensure `currentView`, `activeProductId`, and `activeCreatorId` are correctly updated.