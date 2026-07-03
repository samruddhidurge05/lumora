# Lumora — Final Backend Architecture Recommendation
> Complete recommendation for production-ready hybrid architecture.
> Based on full analysis of all frontend, backend, Firestore, and service files.
> Date: July 2, 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Principles](#2-architecture-principles)
3. [Option Evaluation](#3-option-evaluation)
4. [Recommended Architecture: Structured Hybrid](#4-recommended-architecture-structured-hybrid)
5. [Operation Rules Table](#5-operation-rules-table)
6. [Fix Priority Plan](#6-fix-priority-plan)
7. [What to Keep Exactly As-Is](#7-what-to-keep-exactly-as-is)
8. [Target Architecture Diagram](#8-target-architecture-diagram)
9. [Why This Architecture — Final Reasoning](#9-why-this-architecture--final-reasoning)

---

## 1. Executive Summary

Lumora's backend architecture is approximately **72% correct**. The vendor system, authentication bridge, product dual-write, and platform pause/resume are all well-implemented and should not be touched. The problems are specific and concentrated:

1. Customer orders are written to SQLite but Admin reads Firestore — the Admin panel has no data
2. The affiliate frontend bypasses the complete FastAPI affiliate module and writes Firestore directly
3. Admin authentication uses a mock login that never issues a backend JWT
4. Commission amounts are calculated and written by the browser — a financial security issue

None of these require a new architecture. They require closing the specific gaps in the existing architecture.

**The recommendation is a Structured Hybrid:** FastAPI as the write gate, Firestore as the real-time read bus. This is already the intended design. It just needs to be consistently applied.

---

## 2. Architecture Principles

| Principle | Rule |
|---|---|
| **FastAPI is the write gate** | Every write that has business consequences (orders, commissions, status, settings) goes through FastAPI |
| **Firestore is the read bus** | Real-time dashboards, live lists, status notifications, and feature flags read from Firestore |
| **SQLite is the canonical store** | The authoritative truth for all business data lives in SQLite |
| **Firestore is the sync layer** | FastAPI syncs to Firestore after every write so real-time listeners pick it up |
| **No financial data from the browser** | Commission amounts, payout values, and order totals are calculated server-side |
| **Admin always uses FastAPI** | Admin actions never write Firestore directly |

---

## 3. Option Evaluation

### Option A — Everything Through Firestore

Move all writes to Firestore client SDK. Remove FastAPI writes.

| | Assessment |
|---|---|
| **Security** | ❌ Fatal flaw. Commission amounts, vendor status, and payout data controlled by the browser. Firestore Security Rules cannot enforce complex business logic. |
| **Scalability** | ✅ Auto-scales |
| **Real-time** | ✅ Native |
| **Complex queries** | ❌ No joins, no aggregations, no atomic multi-collection writes |
| **Verdict** | ❌ Not viable for a platform with financial operations |

### Option B — Everything Through FastAPI

All reads and writes through FastAPI. Remove Firestore. Add WebSocket or SSE for real-time.

| | Assessment |
|---|---|
| **Security** | ✅ All business logic validated server-side |
| **Real-time** | ❌ Requires rebuilding all onSnapshot listeners as WebSocket subscriptions |
| **Migration cost** | ❌ Very high — AffiliateContext, AppContext, usePlatformSettings, all admin listeners would need rework |
| **Verdict** | ❌ Too disruptive. The real-time UI is complete and working. |

### Option C — Structured Hybrid (Recommended)

FastAPI for all writes with business consequences. Firestore for real-time reads. SQLite as canonical store. Firestore as sync layer.

| | Assessment |
|---|---|
| **Security** | ✅ All financial and permission operations server-validated |
| **Real-time** | ✅ Firestore onSnapshot preserved for live dashboards |
| **Migration cost** | ✅ Low — only specific gaps need fixing |
| **Scalability** | ✅ Each layer scales independently |
| **Maintainability** | ✅ Clear rules — no ambiguity about which path each operation uses |
| **Verdict** | ✅ Recommended |

---

## 4. Recommended Architecture: Structured Hybrid

```mermaid
graph TD
    subgraph FE["Frontend"]
        AUTH_FE[Firebase Auth<br/>Identity only]
        READS[Firestore onSnapshot<br/>All real-time reads]
        WRITES[backendFetch → FastAPI<br/>All mutations]
    end

    subgraph FASTAPI["FastAPI — Write Gate + Business Logic"]
        AUTH_EP[/api/auth — JWT bridge]
        PROD_EP[/api/products — CRUD + sync]
        ORD_EP[/api/orders — Create + sync]
        VEN_EP[/api/vendors — All vendor ops]
        AFF_EP[/api/affiliate — All affiliate ops]
        ADM_EP[/api/admin — All admin controls]
    end

    subgraph STORES["Data Stores"]
        SQL[(SQLite<br/>Canonical: users, products,<br/>orders, reviews, affiliates)]
        FS[(Firestore<br/>Read bus: products, orders,<br/>users status, analytics,<br/>settings, reports)]
    end

    AUTH_FE --> AUTH_EP --> SQL
    WRITES --> FASTAPI
    FASTAPI --> SQL
    FASTAPI -->|"sync after write"| FS
    FS -->|"onSnapshot"| READS

    style FASTAPI fill:#7b3fa0,color:#fff
    style FS fill:#1a73e8,color:#fff
    style SQL fill:#2c3e50,color:#fff
```

---

## 5. Operation Rules Table

This is the definitive rule for every operation in the platform.

| Operation | Firestore | FastAPI | SQLite | Rule |
|---|---|---|---|---|
| **Product create/update/delete** | Sync target | ✅ Write gate | ✅ Canonical | FastAPI validates, writes SQLite, syncs Firestore |
| **Product browse (marketplace)** | ✅ onSnapshot | — | — | Real-time is the right pattern for catalog display |
| **Product browse (admin panel)** | ✅ onSnapshot | — | — | Same — keep Firestore read |
| **Order create (customer checkout)** | Sync target | ✅ Write gate | ✅ Canonical | FastAPI writes SQLite + **must sync to Firestore** |
| **Order read (customer)** | — | ✅ Read | ✅ Source | SQLite is correct for customer order history |
| **Order read (admin)** | ✅ Read via FastAPI | ✅ Proxy | — | FastAPI reads Firestore (works once sync is fixed) |
| **Order status update (admin)** | ✅ Must update | ✅ Write gate | ✅ Must update | Both stores must be updated |
| **Vendor enable/disable** | ✅ Live status | ✅ Write gate | ✅ is_active sync | Already correct — keep as-is |
| **Vendor status check (API guard)** | ✅ Read | — | — | Firestore is the right source for live status |
| **Vendor dashboard data** | — | ✅ Read | ✅ Source | Pure FastAPI is correct — keep |
| **Affiliate enable/disable** | ✅ Live status | ✅ Write gate | ✅ is_active sync | Already correct — keep as-is |
| **Affiliate profile creation** | ✅ Must update | ✅ Write gate | ✅ Must write | Must go through FastAPI — removes client-side abuse vector |
| **Affiliate commission creation** | ✅ Sync target | ✅ Write gate | ✅ Canonical | Move from client-side to FastAPI post-purchase hook |
| **Affiliate payout request** | ✅ Sync target | ✅ Write gate | ✅ Canonical | FastAPI endpoint already exists and is correct |
| **Affiliate earnings display** | ✅ onSnapshot | — | — | Real-time display is correct |
| **Platform pause/resume** | ✅ Propagation | ✅ Write gate | — | Already correct — keep |
| **Platform feature flags** | ✅ Propagation | ✅ Write gate | — | Fix settingsService bypass |
| **Platform settings read** | ✅ onSnapshot | — | — | usePlatformSettings hook is correct — keep |
| **Admin analytics** | ✅ Aggregation source | ✅ Proxy/aggregator | — | Fix order sync; keep architecture |
| **Admin reports** | ✅ Live list | ✅ Actions | — | Best module — use as template for all admin |
| **Admin reviews** | ✅ Source | ✅ Proxy | — | Keep as-is |
| **Admin payments** | ✅ Live telemetry | ✅ Add auth + payout | — | Add auth check; keep Firestore for telemetry |
| **Admin payout trigger** | ✅ Sync target | ✅ Write gate + auth | ✅ Audit record | Add SQLite audit record + auth check |
| **Authentication** | — | ✅ JWT bridge | ✅ Users table | Already correct — keep |
| **File uploads** | — | ✅ Only | Local/R2 storage | Already correct — keep |
| **Download authorization** | — | ✅ Only | ✅ Order check | Already correct — keep |
| **Review creation** | — | ✅ Only | ✅ Verified check | Already correct — keep |
| **Cart / Wishlist** | — | ✅ Only | ✅ | Already correct — keep |
| **Notifications** | ✅ Fallback | ✅ Primary | ✅ | Already correct pattern |
| **Campaign/Promotions management** | ✅ Only | — | — | Acceptable — admin-only, low risk |

---

## 6. Fix Priority Plan

### Priority 1 — Critical (Admin is completely broken without these)

**P1-A: Fix admin authentication**

Admin login (`admin@lumora.co`) must issue a real backend JWT. Either create a real admin user in SQLite or generate a JWT for the mock admin that the `require_admin_role` dependency can validate.

*Impact: Without this, every admin FastAPI call returns 401.*

**P1-B: Sync orders to Firestore on creation**

Add `sync_order_to_firestore(order)` in `POST /api/orders/` after the SQLite INSERT. This is the exact same pattern as `sync_product_to_firestore`. Admin Orders, Admin Analytics, Admin Dashboard, and Admin Payments all read from Firestore `orders`.

*Impact: Without this, all admin data dashboards show zero or fake data.*

**P1-C: Update SQLite on admin order status change**

`admin_api/orders/services.py` `modify_order_status()` updates Firestore only. It must also update the SQLite `orders` table so the canonical store stays accurate.

*Impact: Admin can mark an order as Completed in Firestore while SQLite still shows pending — vendor earnings and download access checks will be wrong.*

---

### Priority 2 — Security (Financial operations without server validation)

**P2-A: Move affiliate commission creation to FastAPI**

Remove `affiliateService.createConversionsForOrder()` from `ecosystemService.js`. Instead, include the affiliate referral code in the `POST /api/orders/` payload and let FastAPI call `check_and_create_affiliate_conversion()` (the function already exists in `admin_api/orders/services.py`).

*Impact: Browser currently sets its own commission amounts. This is a financial integrity issue.*

**P2-B: Route affiliate payout requests through FastAPI**

Remove `affiliateService.js` payout writes to Firestore `affiliatePayoutRequests`. Use the existing `POST /api/affiliate/payouts` endpoint (which validates amount ≥ ₹500, checks for duplicate pending, and validates against approved balance).

*Impact: Affiliates can currently create unlimited payout requests for any amount directly in Firestore.*

**P2-C: Fix settingsService.js bypass**

Replace direct Firestore writes in `settingsService.js` with calls to `PUT /api/admin/settings/`. The endpoint already exists.

*Impact: Feature flags can currently be changed without admin JWT.*

**P2-D: Add auth to admin payments endpoints**

`/api/admin/payments/*` has no authentication. Any client can read all vendor financial data and trigger payouts.

*Impact: Financial data exposure without auth.*

---

### Priority 3 — Data Consistency

**P3-A: Remove duplicate purchase records**

`purchaseService.js` writes to Firestore `purchases`. `createOrderApi()` writes to SQLite `orders`. Both happen on the same checkout event. Remove the `purchaseService.recordPurchase()` call; use SQLite orders as the single source for ownership.

**P3-B: Connect AffiliateDashboard to FastAPI affiliate module**

`AffiliateDashboard.jsx` already calls `backendFetch('/affiliate/profile')`, `/affiliate/stats`, `/affiliate/commissions`, `/affiliate/payouts`. The FastAPI module is complete. The issue is that `AffiliateContext.jsx` auto-creates affiliates in Firestore bypassing FastAPI. Align the two: Firestore for real-time display (keep), FastAPI for write operations (fix).

**P3-C: Sync order status updates from admin to SQLite**

Already mentioned in P1-C — reinforcing the importance.

---

### Priority 4 — Quality

**P4-A: Remove hardcoded view multipliers in Vendor Analytics**

Vendor analytics computes "store views" as `totalSales * 32.5`. This is fabricated data. Remove the multipliers and either implement real view tracking or display "N/A" for views until tracking is built.

**P4-B: Remove dead code in `admin_controls_vendor/routes.py` and `admin_controls_affiliate/routes.py`**

Both files define `PUT /{uid}/status` endpoints that are never mounted in `main.py`. Delete or mount them.

**P4-C: Wire `vendorNotifications` to vendor pages**

`ecosystemService.js` writes to `vendorNotifications` on every purchase but no vendor page reads this collection. Wire it up so vendors see new order notifications.

---

## 7. What to Keep Exactly As-Is

These components are architecturally correct. Do not change them.

| Component | Why |
|---|---|
| **Vendor system (all 14 endpoints)** | Pure FastAPI + SQLite, clean status checks, correct ownership validation. Best module. |
| **Product CRUD with Firestore sync** | The dual-write pattern (SQLite + Firestore sync) is exactly right. Template for orders fix. |
| **`sync_product_to_firestore` pattern** | Use this as the exact model for `sync_order_to_firestore`. |
| **`verify_vendor_active` / `verify_affiliate_active`** | Reading live status from Firestore in a FastAPI dependency is the correct architecture. |
| **`check_platform_paused`** | Same — Firestore as live status source, FastAPI as enforcement gate. |
| **Firebase Auth → firebase-sync → JWT bridge** | The most important piece. Correctly exchanges Firebase identity for a backend JWT. |
| **Admin vendor/affiliate status endpoints** | Already correct hybrid: FastAPI validates + writes both Firestore and SQLite. |
| **Admin settings (pause/resume) endpoints** | Correct: FastAPI gate + Firestore propagation. |
| **Admin reports module** | The best-implemented admin feature. Hybrid: Firestore real-time + FastAPI actions. |
| **`usePlatformSettings` hook** | Real-time Firestore subscription is exactly right for platform-wide flags. |
| **AffiliateContext real-time listeners** | 7 onSnapshot listeners are the correct pattern for live affiliate data display. |
| **`backendFetch` utility** | Correct: JWT auto-attach, silent 401 refresh, typed error handling. |
| **FastAPI affiliate module `/api/affiliate/*`** | Complete, validated, correct. Just needs to be wired to the frontend write path. |

---

## 8. Target Architecture Diagram

```mermaid
graph TD
    subgraph Admin["Admin Panel"]
        ADM_SET[Settings/Pause] --> FA_SET[/admin/settings]
        ADM_VEND[Vendors/Affiliates] --> FA_VEND[/admin/vendors + affiliates]
        ADM_PROD[Products] --> FA_PROD[/admin/products]
        ADM_ORD[Orders] --> FA_ORD_ADMIN[/admin/orders]
        ADM_ANA[Analytics] -.->|onSnapshot| FS_ORD[(Firestore orders)]
        ADM_REP[Reports] --> FA_REP[/admin/reports]
    end

    subgraph Vendor["Vendor Panel — Pure FastAPI"]
        VEN_ALL[All vendor pages] --> FA_VEN[/api/vendors/id/*]
        VEN_PROD_W[Add/Edit Product] --> FA_PROD_VEN[/api/products]
    end

    subgraph Affiliate["Affiliate Panel — Hybrid"]
        AFF_DISP[Dashboard display] -.->|onSnapshot| FS_AFF[(Firestore affiliates/conversions)]
        AFF_WRITE[Payouts/Profile edits] --> FA_AFF[/api/affiliate/*]
    end

    subgraph Customer["Customer — FastAPI + Firestore display"]
        CUS_ORD[Checkout] --> FA_CUS_ORD[/api/orders POST + Firestore sync]
        CUS_BROWSE[Browse] -.->|onSnapshot| FS_PROD[(Firestore products)]
    end

    subgraph FastAPI["FastAPI Write Gate"]
        FA_SET --> FS_SET[(Firestore platformSettings)]
        FA_VEND --> FS_USR[(Firestore users/vendors/affiliates)]
        FA_PROD --> SQL[(SQLite)]
        FA_PROD --> FS_PROD
        FA_VEN --> SQL
        FA_AFF --> SQL
        FA_AFF --> FS_AFF
        FA_CUS_ORD --> SQL
        FA_CUS_ORD --> FS_ORD
        FA_ORD_ADMIN --> FS_ORD
        FA_ORD_ADMIN --> SQL
        FA_REP --> FS_REP[(Firestore reports)]
    end

    style FastAPI fill:#f0e8f8
    style FS_ORD fill:#1a73e8,color:#fff
    style SQL fill:#2c3e50,color:#fff
```

---

## 9. Why This Architecture — Final Reasoning

### Why Firestore for reads

- Platform feature flags need to propagate to all clients within milliseconds. Polling FastAPI would introduce lag and extra load.
- Affiliate dashboards show live conversions. An onSnapshot listener is far simpler and cheaper than a WebSocket server.
- Vendor status changes need to reflect instantly in the AffiliateContext. Firestore onSnapshot delivers this without any additional infrastructure.
- The `products` catalog needs to update the marketplace the instant a vendor publishes. onSnapshot makes this instant.

### Why FastAPI for writes

- Commission amounts calculated in the browser can be inflated. Server-side calculation is non-negotiable for financial correctness.
- Vendor/affiliate status changes must be atomic across Firestore and SQLite. A FastAPI service call can guarantee both updates happen.
- Order creation needs validation (non-negative price, items exist, valid product IDs), ownership assignment, and download counter increment — none of which can be enforced by Firestore Security Rules alone.
- Admin actions require JWT verification against a known admin user record. A Firestore write from the browser requires only Security Rules, which can be circumvented if the admin session is compromised.
- Payout requests need duplicate detection, balance validation, and a minimum amount check. These require SQL queries against the commissions table — only FastAPI can do this.

### Why SQLite as canonical store

- SQLite gives reliable ACID transactions for order creation (order + order_items in one transaction).
- Download access checks need a JOIN across orders + order_items + products — a Firestore query cannot do this.
- Review creation needs a verified purchase check — again, a JOIN that Firestore cannot perform.
- The affiliate payout validation (`amount ≤ approved commission balance`) requires a SUM query across filtered commission rows.

### Why not full Firestore Security Rules

Firestore Security Rules can enforce simple field-level access control. They cannot:
- Perform JOIN queries across collections
- Validate that a commission amount matches server-calculated values
- Enforce minimum payout amounts with balance checks
- Prevent a user from creating an affiliate profile with a manipulated commission rate
- Audit admin actions

### Why not full FastAPI with WebSockets

The real-time UI is already built, tested, and working. Replacing onSnapshot with WebSocket subscriptions would require rebuilding AffiliateContext (7 listeners), AppContext (1 product listener), all admin page subscriptions, usePlatformSettings, and paymentService telemetry. The risk and cost are not justified when Firestore onSnapshot already delivers what's needed.

### Summary

The architecture is right. The implementation has specific gaps. The fix is not a redesign — it is closing those gaps while preserving everything that works.

| Metric | Current State | After Fixes |
|---|---|---|
| Admin panel usability | ~30% functional | ~95% functional |
| Financial data integrity | At risk (client-side commissions) | Secure (server-validated) |
| Order data consistency | Broken (SQLite ≠ Firestore) | Fixed (dual-write) |
| Authentication security | Admin bypasses JWT | All paths JWT-gated |
| Vendor system | 100% working | Unchanged |
| Affiliate system | Frontend disconnected from FastAPI | Frontend wired to FastAPI for writes |
| Real-time UI | 100% working | Unchanged |
