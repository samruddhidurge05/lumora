# Lumora — Connectivity Flow Map
> Complete data flow diagrams for every major system in the platform.
> Date: July 2, 2026

---

## Table of Contents

1. [System Connectivity Overview](#1-system-connectivity-overview)
2. [Products Flow](#2-products-flow)
3. [Orders Flow](#3-orders-flow)
4. [Users & Roles Flow](#4-users--roles-flow)
5. [Vendor Control Flow](#5-vendor-control-flow)
6. [Affiliate Control Flow](#6-affiliate-control-flow)
7. [Payments Flow](#7-payments-flow)
8. [Global Pause Flow](#8-global-pause-flow)
9. [Platform Settings Flow](#9-platform-settings-flow)
10. [Referral Codes Flow](#10-referral-codes-flow)
11. [Analytics Flow](#11-analytics-flow)
12. [Full Dependency Graph](#12-full-dependency-graph)

---

## 1. System Connectivity Overview

```mermaid
graph TD
    subgraph Roles
        ADM[Admin]
        VEN[Vendor]
        AFF[Affiliate]
        CUS[Customer]
    end

    subgraph Gateway["FastAPI Write Gate"]
        AUTH[/api/auth]
        PROD[/api/products]
        ORD[/api/orders]
        VEND[/api/vendors]
        AFFAPI[/api/affiliate]
        ADMIN[/api/admin]
    end

    subgraph Stores
        SQL[(SQLite)]
        FS[(Firestore)]
    end

    ADM -->|JWT| ADMIN
    VEN -->|JWT| VEND
    VEN -->|JWT| PROD
    AFF -->|JWT| AFFAPI
    AFF -.->|direct SDK — bypass| FS
    CUS -->|JWT| ORD
    CUS -->|JWT| PROD

    ADMIN -->|read/write| FS
    ADMIN -->|write| SQL
    VEND -->|read/write| SQL
    PROD -->|write| SQL
    PROD -->|sync| FS
    ORD -->|write| SQL
    ORD -.->|missing sync| FS
    AFFAPI -->|read/write| SQL

    style FS fill:#1a73e8,color:#fff
    style SQL fill:#2c3e50,color:#fff
    style Gateway fill:#f0e8f8
```

---

## 2. Products Flow

### Write Path (Vendor or Admin Creates Product)

```mermaid
sequenceDiagram
    participant VEN as Vendor/Admin
    participant FA as FastAPI POST /api/products/
    participant SQL as SQLite
    participant FS as Firestore products/{id}
    participant MKT as Marketplace (AppContext)
    participant ADM as Admin Products Page

    VEN->>FA: POST {title, price, category, ...} + JWT
    FA->>FA: verify_vendor_active() → check Firestore status
    FA->>FA: validate price, title, commission rules
    FA->>SQL: INSERT INTO products → id = 42
    SQL-->>FA: product record
    FA->>FS: sync_product_to_firestore(product)
    FS->>FS: products/42.set({title, price, status, vendor_id, ...})
    FA-->>VEN: ProductResponse {id: 42, ...}

    FS-->>MKT: onSnapshot fires
    MKT->>MKT: products state updated
    Note over MKT: New product visible in marketplace immediately

    FS-->>ADM: onSnapshot fires
    ADM->>ADM: product list updated
    Note over ADM: Admin sees new product immediately
```

### Read Path (Marketplace)

```mermaid
flowchart LR
    A[AppContext mounts] --> B[FastAPI GET /api/products/ one-time fetch]
    A --> C[Firestore onSnapshot products]
    B --> D[Merge into products state]
    C --> D
    D --> E[Marketplace renders]
    D --> F[Affiliate Products renders]
    D --> G[Admin Products onSnapshot]
```

### Delete Path

```mermaid
sequenceDiagram
    participant VEN as Vendor
    participant FA as FastAPI DELETE /api/products/42
    participant SQL as SQLite
    participant FS as Firestore

    VEN->>FA: DELETE /api/products/42 + JWT
    FA->>FA: ownership check (vendor_id matches)
    FA->>SQL: DELETE FROM products WHERE id = 42
    FA->>FS: delete_product_from_firestore(42)
    FS->>FS: products/42.delete()
    FA-->>VEN: 204 No Content
    FS-->>MKT: onSnapshot fires — product removed
```

---

## 3. Orders Flow

### Current State (Broken)

```mermaid
flowchart TD
    A[Customer completes checkout] --> B[AppContext.completePurchase]
    
    B --> C[createOrderApi → POST /api/orders/]
    C --> D[(SQLite: orders + order_items)]
    D -.->|❌ NEVER SYNCED| E[(Firestore: orders)]
    
    B --> F[ecosystemService.onPurchaseComplete]
    F --> G[addDoc to Firestore orders]
    G -->|different schema| E

    E --> H[Admin Orders page reads Firestore]
    E --> I[Admin Analytics reads Firestore]
    E --> J[Admin Payments reads Firestore]
    E --> K[Admin Dashboard reads Firestore]
    
    D --> L[Customer /orders/me reads SQLite]
    D --> M[Vendor /orders reads SQLite]
    D --> N[Download auth check reads SQLite]

    style D fill:#2c3e50,color:#fff
    style E fill:#1a73e8,color:#fff
    style H fill:#e74c3c,color:#fff
    style I fill:#e74c3c,color:#fff
```

### What the Order Schema Looks Like in Each Store

| Field | SQLite (canonical) | Firestore (ecosystemService) |
|---|---|---|
| ID | integer auto-increment | `ORD-{timestamp}` string |
| user_id | integer FK | customerId (Firebase UID) |
| total_amount | decimal | totalUSD + totalINR |
| status | "completed" (default) | "completed" |
| items | order_items table | embedded array |
| created_at | datetime | ISO string |
| Product link | product_id (FK) | productId (Firestore doc ID string) |

**The two schemas are incompatible.** An admin order update via FastAPI touches Firestore; the same order in SQLite is never updated.

### Target State (After Fix)

```mermaid
sequenceDiagram
    participant CUS as Customer
    participant FA as FastAPI POST /api/orders/
    participant SQL as SQLite
    participant FS as Firestore orders/{id}
    participant ADM as Admin Orders

    CUS->>FA: POST {items, total, payment_method} + JWT
    FA->>SQL: INSERT INTO orders + order_items
    SQL-->>FA: Order {id: 42, status: 'completed'}
    FA->>FS: orders/{id}.set({orderId, customerId, items, status, ...})
    FA-->>CUS: OrderResponse

    ADM->>FA: GET /api/admin/orders/
    FA->>FS: orders.stream() → includes new order
    FA-->>ADM: order list with new order
```

---

## 4. Users & Roles Flow

```mermaid
flowchart TD
    subgraph Registration
        R1[Customer registers] --> R2[Firebase createUser]
        R2 --> R3[Firestore users/{uid}.set role=customer]
        R3 --> R4[Firestore customers/{uid}.set]
        R2 --> R5[POST /api/auth/firebase-sync]
        R5 --> R6[SQLite INSERT users role=customer]
    end

    subgraph VendorReg["Vendor Registration"]
        V1[Vendor registers] --> V2[Firebase createUser]
        V2 --> V3[Firestore users/{uid} role=vendor]
        V2 --> V4[Firestore vendors/{uid}.set]
        V2 --> V5[POST /api/auth/firebase-sync role=vendor]
        V5 --> V6[SQLite INSERT users role=vendor]
    end

    subgraph AffReg["Affiliate Auto-Creation"]
        A1[User navigates /affiliate] --> A2[AffiliateContext mounts]
        A2 --> A3{affiliates where userId==uid?}
        A3 -->|not found| A4[Firestore affiliates/{uid}.set commissionRate=30]
        A4 --> A5[Firestore users/{uid}.update role=Affiliate]
        A3 -->|found| A6[load affiliate data via onSnapshot]
        Note over A4: ⚠️ No FastAPI call — no validation
    end
```

---

## 5. Vendor Control Flow

### Admin Enables / Disables Vendor

```mermaid
sequenceDiagram
    participant ADM as Admin Vendors Page
    participant VS as vendorService.js
    participant FA as FastAPI /api/admin/vendors/{uid}/status
    participant ACV as admin_controls_vendor/services.py
    participant FS as Firestore
    participant SQL as SQLite
    participant VEN as Vendor Dashboard

    ADM->>VS: approveVendor(uid) / disableVendor(uid)
    VS->>FA: PUT /admin/vendors/{uid}/status {status}
    FA->>FA: require_admin_role() — JWT + SQLite role check
    FA->>ACV: update_vendor_status(uid, status)
    ACV->>FS: users/{uid}.set({accountStatus, isApproved, ...})
    ACV->>FS: vendors/{uid}.set({status, isApproved, ...})
    ACV->>FS: users/{uid}.get() — resolve email
    ACV->>SQL: UPDATE users SET is_active = (status=='active')
    ACV-->>FA: done
    FA-->>ADM: {success: true}

    Note over FS: Vendor's next API call:
    VEN->>FA: GET /vendors/{id}/products + JWT
    FA->>FA: verify_vendor_active()
    FA->>FS: users/{str(user.id)}.get() → accountStatus
    alt status = disabled
        FA-->>VEN: 403 Vendor account is disabled
    else status = active
        FA-->>VEN: 200 products list
    end

    Note over FS: AffiliateContext reads users/{uid}:
    FS-->>VEN: onSnapshot users/{uid} fires (if vendor uses affiliate tab)
```

### Vendor Sees Status Change — Real-time Path

```mermaid
flowchart LR
    A[Admin disables vendor] --> B[FastAPI updates Firestore users/uid]
    B --> C[Firestore onSnapshot fires]
    C --> D[AffiliateContext isSuspended state updates]
    D --> E[Vendor UI shows suspension notice if on /affiliate tab]
    
    B --> F[Next vendor API call]
    F --> G[verify_vendor_active reads Firestore]
    G --> H[403 returned — vendor blocked]
```

---

## 6. Affiliate Control Flow

### Admin Enables / Disables Affiliate

```mermaid
sequenceDiagram
    participant ADM as Admin Vendors Page (Affiliate tab)
    participant VS as vendorService.js
    participant FA as FastAPI /api/admin/affiliates/{uid}/status
    participant ACA as admin_controls_affiliate/services.py
    participant FS as Firestore
    participant SQL as SQLite
    participant AFF as Affiliate Dashboard

    ADM->>VS: approveAffiliate(uid) / disableAffiliate(uid)
    VS->>FA: PUT /admin/affiliates/{uid}/status {status}
    FA->>FA: require_admin_role()
    FA->>ACA: update_affiliate_status(uid, status)
    ACA->>FS: users/{uid}.set({accountStatus, isApproved, ...})
    ACA->>FS: affiliates/{uid}.set({status, ...})
    ACA->>SQL: UPDATE users + affiliate_profile SET is_active
    FA-->>ADM: {success: true}

    Note over FS: AffiliateContext real-time update:
    FS-->>AFF: onSnapshot users/{uid} fires
    AFF->>AFF: setIsApproved / setIsSuspended
    AFF->>AFF: affiliateAllowed = false
    AFF->>AFF: UI blocks affiliate actions

    Note over FS: Also: AffiliateContext reads affiliates collection:
    FS-->>AFF: onSnapshot affiliates where userId==uid fires
    Note over AFF: Affiliate is immediately locked out of all actions
```

### Affiliate Conversion Creation — Current (Broken) vs Target

```mermaid
flowchart TD
    subgraph Current["Current State — Client-Side (Broken)"]
        P1[Customer purchases via ?ref=AFF001] --> P2[AppContext.completePurchase]
        P2 --> P3[ecosystemService.onPurchaseComplete]
        P3 --> P4[affiliateService.createConversionsForOrder]
        P4 --> P5[Firestore affiliateConversions.add<br/>commission calculated in browser]
        P4 --> P6[Firestore affiliates/id.update<br/>totalCommission++]
        P4 --> P7[Firestore affiliateLinks/id.update<br/>conversions++]
        style P5 fill:#e74c3c,color:#fff
    end

    subgraph Target["Target State — FastAPI Validated"]
        T1[Customer purchases via ?ref=AFF001] --> T2[POST /api/orders/ {ref_code}]
        T2 --> T3[FastAPI validates + INSERT SQLite orders]
        T3 --> T4[check_and_create_affiliate_conversion]
        T4 --> T5[Firestore affiliateConversions.add<br/>commission calculated server-side]
        T4 --> T6[Firestore affiliates/id.update]
        T5 --> T7[AffiliateContext onSnapshot picks up new conversion]
        style T5 fill:#27ae60,color:#fff
    end
```

---

## 7. Payments Flow

### Current State

```mermaid
flowchart LR
    subgraph AdminFE["Admin Payments Page"]
        P[Payments.jsx] --> PS[paymentService.subscribeToPaymentsTelemetry]
    end

    subgraph Service["paymentService.js"]
        PS --> O1[onSnapshot Firestore orders]
        PS --> O2[onSnapshot Firestore users]
    end

    subgraph FS_Collections["Firestore"]
        O1 --> ORD[(orders collection)]
        O2 --> USR[(users collection)]
    end

    subgraph Issue["⚠️ Issues"]
        I1[No auth on FastAPI payments endpoints]
        I2[Orders in Firestore are client-written — unvalidated]
        I3[Vendor payout trigger — stub only]
    end
```

### Vendor Payout Trigger

```mermaid
sequenceDiagram
    participant ADM as Admin Payments Page
    participant PS as paymentService.triggerVendorPayout
    participant FA as FastAPI POST /api/admin/payments/payout
    participant FS as Firestore affiliatePayouts

    ADM->>PS: triggerVendorPayout(vendorId, amount)
    PS->>FA: POST /admin/payments/payout {vendor_id, amount}
    Note over FA: ⚠️ No auth check on this endpoint
    FA->>FS: affiliatePayouts/{id}.set({vendorId, amount, status: 'Completed'})
    FA->>FS: vendors/{vendorId}.update({lastPayoutAmount, lastPayoutDate})
    FA-->>ADM: {success: true}
    Note over FA: ⚠️ No SQLite record — payout is not auditable
```

---

## 8. Global Pause Flow

```mermaid
sequenceDiagram
    participant ADM as Admin Settings Page
    participant PS as platformService.disablePlatform
    participant FA as FastAPI POST /api/admin/settings/pause
    participant FS as Firestore platformSettings/global

    ADM->>PS: disablePlatform(message)
    PS->>FA: POST /admin/settings/pause {message}
    FA->>FA: require_admin_role() — JWT check
    FA->>FS: platformSettings/global.set({isPlatformPaused: true, pauseMessage, updatedBy})
    FA-->>ADM: {success: true}

    Note over FS: Real-time propagation to all subscribers:
    FS-->>ALL1: usePlatformSettings hook fires everywhere
    FS-->>ALL2: AffiliateContext.affiliateProgramEnabled updates
    FS-->>VEN_API: status_checks.check_platform_paused() reads Firestore
    FS-->>AFF_API: status_checks.verify_affiliate_active() reads Firestore

    Note over VEN_API: Next vendor API call blocked:
    VEN_API->>VEN: 403 Platform is temporarily paused

    Note over AFF_API: Next affiliate API call blocked:
    AFF_API->>AFF: 403 Platform is temporarily paused

    Note over CUS: Customer checkout → POST /api/orders/ → NOT blocked
    Note over CUS: ⚠️ Customer purchases are NOT gated by platform pause
```

**Finding:** Customer orders go through `POST /api/orders/` which does NOT call `check_platform_paused()`. Only vendor and affiliate operations are blocked by the platform pause.

---

## 9. Platform Settings Flow

```mermaid
flowchart TD
    subgraph WritePaths["Write Paths"]
        W1[Admin Settings page → platformService] --> W1A[POST /admin/settings/pause ✅]
        W1 --> W1B[POST /admin/settings/resume ✅]
        W1 --> W1C[PUT /admin/settings/ ✅]
        W2[Admin Settings page → settingsService] --> W2A[⚠️ direct Firestore write BYPASS]
    end

    W1A --> FS[(platformSettings/global)]
    W1B --> FS
    W1C --> FS
    W2A --> FS

    subgraph ReadPaths["Read Paths — All real-time onSnapshot"]
        FS --> R1[usePlatformSettings hook → all pages]
        FS --> R2[AffiliateContext → affiliateProgramEnabled]
        FS --> R3[status_checks.py → check_platform_paused]
        FS --> R4[status_checks.py → verify_vendor_active]
        FS --> R5[admin_firestore.py → get_platform_settings]
    end
```

---

## 10. Referral Codes Flow

### Affiliate Referral Link Flow

```mermaid
sequenceDiagram
    participant AFF as Affiliate
    participant AFFCTX as AffiliateContext (Firestore)
    participant FA as FastAPI /api/affiliate/referral-links
    participant SQL as SQLite

    Note over AFF: AffiliateContext path (current implementation):
    AFF->>AFFCTX: Reads affiliateLinks onSnapshot
    Note over AFFCTX: All link data from Firestore

    Note over AFF: FastAPI path (exists but unused):
    AFF->>FA: POST /api/affiliate/referral-links + JWT
    FA->>SQL: INSERT INTO referral_links (unique code)
    FA-->>AFF: ReferralLinkResponse
    Note over FA: Validation: product exists, no duplicate, unique code

    Note over AFF: ⚠️ Frontend uses Firestore path for display
    Note over AFF: ⚠️ FastAPI path is wired but the frontend does not call it
```

### Admin Referral Link (CampaignManager)

```mermaid
flowchart LR
    A[Admin creates campaign] --> B[CampaignManager.jsx]
    B --> C[addDoc adminReferralLinks]
    C --> D[(Firestore adminReferralLinks)]
    D --> E[onSnapshot — link list updates]
    
    F[Customer clicks referral link] --> G[?ref=ADM-XXXXX in URL]
    G --> H[ecosystemService reads affiliateLinks collection]
    H -.->|⚠️ adminReferralLinks not read| I[Conversion may not be tracked]
```

**Finding:** Admin referral links in `adminReferralLinks` are not read by `ecosystemService.js`. The ecosystem service looks up `affiliateLinks` collection. Admin campaigns are created in a separate, disconnected collection.

---

## 11. Analytics Flow

### Admin Dashboard Analytics

```mermaid
flowchart TD
    subgraph DashSvc["dashboardService.js"]
        D1[subscribeToAdminDashboard] --> D2[FastAPI GET /admin/analytics/dashboard-full]
        D1 --> D3[onSnapshot Firestore orders]
        D1 --> D4[onSnapshot Firestore reviews]
        D1 --> D5[onSnapshot Firestore reports]
    end

    subgraph FastAPI_Analytics["FastAPI admin_api/analytics/services.py"]
        D2 --> A1[reads Firestore orders]
        D2 --> A2[reads Firestore products]
        D2 --> A3[reads Firestore vendors]
        D2 --> A4[reads Firestore reviews]
    end

    subgraph Problem["⚠️ Data Problem"]
        P1[SQLite has all customer orders]
        P2[Firestore orders = client-written only]
        P3[FastAPI analytics reads Firestore orders]
        P4[Result: analytics show wrong/no data]
        P1 -.->|not connected| P3
        P2 --> P3 --> P4
    end
```

### Vendor Analytics (Working Correctly)

```mermaid
flowchart LR
    VA[Vendor Analytics.jsx] --> VH[useVendorData hooks]
    VH --> FA1[GET /vendors/id/orders]
    VH --> FA2[GET /vendors/id/products]
    FA1 --> SQL[(SQLite orders)]
    FA2 --> SQL
    SQL --> VH --> VA
    Note over VA: All real data from SQLite via FastAPI
    Note over VA: ⚠️ "Views" metrics are hardcoded multipliers
```

---

## 12. Full Dependency Graph

```mermaid
graph LR
    subgraph Admin
        ADM_DASH[Admin Dashboard]
        ADM_PROD[Admin Products]
        ADM_VEND[Admin Vendors]
        ADM_AFF[Admin Affiliates]
        ADM_ORD[Admin Orders]
        ADM_ANA[Admin Analytics]
        ADM_SET[Admin Settings]
        ADM_REP[Admin Reports]
        ADM_PAY[Admin Payments]
        ADM_CAM[Campaign Manager]
        ADM_PRO[Promotions]
    end

    subgraph Vendor
        VEN_DASH[Vendor Dashboard]
        VEN_PROD[Vendor Products]
        VEN_ORD[Vendor Orders]
    end

    subgraph Affiliate
        AFF_DASH[Affiliate Dashboard]
        AFF_EARN[Affiliate Earnings]
    end

    subgraph Customer
        CUS_MKT[Marketplace]
        CUS_ORD[Customer Orders]
        CUS_DL[Downloads]
    end

    subgraph FastAPI
        FA_APROD[/api/products]
        FA_AORD[/api/orders]
        FA_VEND[/api/vendors]
        FA_AFF[/api/affiliate]
        FA_ADMIN[/api/admin]
    end

    subgraph Firestore
        FS_PROD[(products)]
        FS_ORD[(orders)]
        FS_USR[(users/vendors/affiliates)]
        FS_SET[(platformSettings)]
        FS_REP[(reports)]
        FS_ACONV[(affiliateConversions)]
        FS_ADMIN[(adminReferralLinks<br/>adminPromotions)]
    end

    SQL_DB[(SQLite)]

    ADM_PROD --> FA_ADMIN --> FS_PROD
    ADM_PROD -.->|onSnapshot| FS_PROD
    ADM_VEND --> FA_ADMIN --> FS_USR
    ADM_AFF --> FA_ADMIN --> FS_USR
    ADM_ORD --> FA_ADMIN --> FS_ORD
    ADM_ANA --> FA_ADMIN --> FS_ORD
    ADM_SET --> FA_ADMIN --> FS_SET
    ADM_REP --> FA_ADMIN --> FS_REP
    ADM_PAY -.->|onSnapshot| FS_ORD
    ADM_CAM -.->|onSnapshot| FS_ADMIN
    ADM_PRO -.->|onSnapshot| FS_ADMIN

    VEN_DASH --> FA_VEND --> SQL_DB
    VEN_PROD --> FA_VEND --> SQL_DB
    VEN_ORD --> FA_VEND --> SQL_DB

    AFF_DASH --> FA_AFF --> SQL_DB
    AFF_EARN --> FA_AFF --> SQL_DB
    AFF_EARN -.->|AffiliateContext| FS_ACONV

    CUS_MKT -.->|onSnapshot| FS_PROD
    CUS_ORD --> FA_AORD --> SQL_DB
    CUS_DL --> FA_APROD --> SQL_DB

    FA_APROD --> SQL_DB
    FA_APROD --> FS_PROD

    style FS_ORD fill:#e74c3c,color:#fff
    style FA_ADMIN fill:#7b3fa0,color:#fff
    style SQL_DB fill:#2c3e50,color:#fff
```

*Red node = Firestore orders collection — broken data source.*
