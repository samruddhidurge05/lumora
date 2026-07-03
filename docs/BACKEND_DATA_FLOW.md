# Lumora Backend Data Flow
> Complete data flow maps for every major operation in the Lumora platform.  
> **Analysis only — no code was modified.**  
> Date: July 2, 2026

---

## Table of Contents

1. [Authentication Flow](#1-authentication-flow)
2. [Product Lifecycle Flow](#2-product-lifecycle-flow)
3. [Purchase & Order Flow](#3-purchase--order-flow)
4. [Vendor Management Flow](#4-vendor-management-flow)
5. [Affiliate System Flow](#5-affiliate-system-flow)
6. [Admin Control Flow](#6-admin-control-flow)
7. [Platform Settings Flow](#7-platform-settings-flow)
8. [Real-time Listener Map](#8-real-time-listener-map)

---

## 1. Authentication Flow

### 1A — Normal User Login (Customer / Vendor)

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend (React)
    participant FB as Firebase Auth
    participant FS as Firestore
    participant FA as FastAPI

    User->>FE: Enter email + password
    FE->>FB: signInWithEmailAndPassword()
    FB-->>FE: FirebaseUser object
    FE->>FS: getDoc(users/{uid})
    FS-->>FE: User profile + role
    FE->>FE: localStorage.set('lumora_active_role', role)
    FE->>FB: firebaseUser.getIdToken()
    FB-->>FE: Firebase ID Token
    FE->>FA: POST /api/auth/firebase-sync {idToken, role}
    FA->>FA: verify_firebase_id_token() — RS256 check
    FA->>FA: SELECT user WHERE email = ?
    alt First login
        FA->>FA: INSERT user (firebase_managed)
    end
    FA-->>FE: {access_token: JWT, user: {id, role, email}}
    FE->>FE: localStorage.set('lumora_backend_token', JWT)
    FE->>FE: localStorage.set('lumora_backend_uid', user.id)
    Note over FE,FA: All subsequent API calls use JWT Bearer header
```

### 1B — Admin Login (Mock — No Real Authentication)

```mermaid
sequenceDiagram
    actor Admin
    participant FE as Frontend
    participant FA as FastAPI

    Admin->>FE: Enter admin@lumora.co
    FE->>FE: Hardcoded check in AuthContext.login()
    FE->>FE: setUser({uid: 'admin-mock-uid', ...})
    FE->>FE: localStorage.set('lumora_mock_user', mockUser)
    Note over FE,FA: ⚠️ No Firebase token issued
    Note over FE,FA: ⚠️ No backend JWT issued
    Note over FE,FA: Admin API calls will fail (401) if FastAPI
    Note over FE,FA: cannot find 'admin-mock-uid' in SQLite
```

### 1C — Token Refresh Flow

```mermaid
flowchart LR
    A[backendFetch call] --> B{401 from API?}
    B -->|No| C[Return response]
    B -->|Yes| D[getIdToken force=true]
    D --> E[POST /api/auth/firebase-sync]
    E --> F[New JWT stored in localStorage]
    F --> G[Retry original request]
    G --> C
```

---

## 2. Product Lifecycle Flow

### 2A — Vendor Creates a Product

```mermaid
sequenceDiagram
    participant VendorFE as Vendor Frontend
    participant FA as FastAPI /api/products/
    participant SQLite
    participant FS as Firestore

    VendorFE->>FA: POST /api/products/ {title, price, ...} + JWT
    FA->>FA: verify JWT → get user
    FA->>FA: check role == 'vendor' or 'admin'
    FA->>FA: verify_vendor_active() → check Firestore status
    FA->>FA: validate price, title, commission rules
    FA->>SQLite: INSERT INTO products
    SQLite-->>FA: Product record with integer ID
    FA->>FS: sync_product_to_firestore(product)
    FS->>FS: products/{id}.set({title, price, status, ...})
    FA-->>VendorFE: ProductResponse {id, title, ...}
    Note over FS: Firestore listener in AppContext picks up new product
    Note over FS: Marketplace shows new product in real-time
```

### 2B — Admin Creates/Updates a Product

```mermaid
sequenceDiagram
    participant AdminFE as Admin Frontend
    participant FA as FastAPI /api/admin/products/
    participant SQLite
    participant FS as Firestore

    AdminFE->>FA: POST /api/admin/products/ + JWT
    FA->>FA: require_admin_role() — check SQLite role == 'admin'
    FA->>SQLite: INSERT INTO products
    FA->>FS: sync_product_to_firestore(product)
    FA-->>AdminFE: ProductResponse
    Note over AdminFE: Admin Products page reads Firestore onSnapshot
    Note over AdminFE: New product appears immediately
```

### 2C — Product Display Flow (Marketplace)

```mermaid
flowchart TD
    A[AppContext mounts] --> B[FastAPI: GET /api/products/ — one-time fetch]
    A --> C[Firestore: onSnapshot products collection — real-time]
    B --> D{Products loaded?}
    C --> D
    D --> E[Merge: Firestore overrides FastAPI for matching IDs]
    E --> F[products state in AppContext]
    F --> G[Marketplace page renders]
    F --> H[Affiliate Products page renders]
    F --> I[Customer product detail renders]
    
    style C fill:#4a90d9,color:#fff
    style B fill:#7b3fa0,color:#fff
```

### 2D — Product Delete Flow

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant FA as FastAPI DELETE /api/products/{id}
    participant SQLite
    participant FS as Firestore

    FE->>FA: DELETE /api/products/{id} + JWT
    FA->>FA: verify ownership (vendor_id == current_user.id)
    FA->>SQLite: DELETE FROM products WHERE id = ?
    FA->>FS: delete_product_from_firestore(product_id)
    FS->>FS: products/{id}.delete()
    FA-->>FE: 204 No Content
    Note over FS: onSnapshot listeners pick up deletion immediately
```

---

## 3. Purchase & Order Flow

### 3A — Customer Checkout (Current Implementation)

```mermaid
sequenceDiagram
    participant Customer
    participant FE as AppContext.completePurchase()
    participant FA as FastAPI /api/orders/
    participant SQLite
    participant FS as Firestore
    participant Eco as ecosystemService

    Customer->>FE: Confirm payment
    FE->>FE: setOwnedProducts([...ids]) — localStorage
    FE->>FA: POST /api/orders/ {items, total, payment_method} + JWT
    FA->>SQLite: INSERT INTO orders
    FA->>SQLite: INSERT INTO order_items
    FA->>SQLite: UPDATE products SET downloads += 1
    FA-->>FE: OrderResponse {id, status: 'completed'}
    FE->>FS: purchaseService.recordPurchase(uid, productId)
    FS->>FS: purchases/{docId}.add({userId, productId, accessStatus})
    Note over SQLite,FS: ⚠️ Two separate records for same purchase
    FE->>Eco: onPurchaseComplete(uid, items, total, affCode)
    Eco->>FS: affiliateConversions.add({affiliateId, amount, ...})
    Eco->>FS: affiliateLinks/{id}.update({conversions++})
    Eco->>FS: vendorAnalytics/{vendorId}.update({revenue++})
    Note over FS: All affiliate + vendor analytics updates are<br/>client-side writes — no server validation
```

### 3B — Order Status Update (Admin)

```mermaid
sequenceDiagram
    participant AdminFE as Admin Orders Page
    participant FA as FastAPI /api/admin/orders/{id}/status
    participant FS as Firestore
    participant SQLite

    AdminFE->>FA: PUT /api/admin/orders/{id}/status {status: 'Completed'}
    FA->>FS: orders/{id}.update({status: 'Completed'})
    FA->>FA: check_and_create_affiliate_conversion() — if status == Completed
    FA->>FS: affiliateConversions.add({...}) — if affiliate order
    FA-->>AdminFE: success
    Note over SQLite: ⚠️ SQLite order record is NOT updated
    Note over SQLite: SQLite and Firestore orders are now out of sync
```

### 3C — Download Authorization Flow

```mermaid
flowchart TD
    A[Customer requests download] --> B[GET /api/products/id/download + JWT]
    B --> C{Check SQLite}
    C --> D{Completed order<br/>contains product?}
    D -->|Yes| E[Return download_url]
    D -->|No| F{Is vendor owner?}
    F -->|Yes| E
    F -->|No| G{Is admin?}
    G -->|Yes| E
    G -->|No| H[403 Forbidden]
    
    style E fill:#27ae60,color:#fff
    style H fill:#e74c3c,color:#fff
```

---

## 4. Vendor Management Flow

### 4A — Vendor Dashboard Data Flow

```mermaid
flowchart LR
    subgraph VendorFE["Vendor Frontend"]
        D[Dashboard.jsx]
        MP[ManageProducts.jsx]
        O[Orders.jsx]
        E[Earnings.jsx]
        R[Reviews.jsx]
    end

    subgraph Hooks["useVendorData Hooks"]
        UH[useDashboard]
        UP[useVendorProducts]
        UO[useOrders]
        UE[useEarnings → stats]
        UR[useReviews]
    end

    subgraph API["FastAPI Endpoints"]
        VD[GET /api/vendors/id/dashboard]
        VPR[GET /api/vendors/id/products]
        VO[GET /api/vendors/id/orders]
        VS[GET /api/vendors/id/stats]
        VR[GET /api/vendors/id/reviews]
    end

    subgraph DB["SQLite"]
        P[(products)]
        OR[(orders)]
        OI[(order_items)]
        REV[(reviews)]
        WD[(withdrawals)]
    end

    D --> UH --> VD --> DB
    MP --> UP --> VPR --> P
    O --> UO --> VO --> OR & OI
    E --> UE --> VS --> P & OR
    R --> UR --> VR --> REV

    style API fill:#7b3fa0,color:#fff
    style DB fill:#2c3e50,color:#fff
```

### 4B — Vendor Status Change Flow (Admin Action)

```mermaid
sequenceDiagram
    participant AdminFE as Admin Vendors Page
    participant VS as vendorService.js
    participant FA as FastAPI /api/admin/vendors/{uid}/status
    participant FS as Firestore
    participant SQLite

    AdminFE->>VS: approveVendor(uid) / disableVendor(uid)
    VS->>FA: PUT /api/admin/vendors/{uid}/status {status: 'active'}
    FA->>FA: require_admin_role()
    FA->>FA: update_vendor_status(uid, 'active')
    FA->>FS: users/{uid}.set({accountStatus, isApproved, ...})
    FA->>FS: vendors/{uid}.set({status, isApproved, ...})
    FA->>FS: users/{uid}.get() → resolve email
    FA->>SQLite: UPDATE users SET is_active = True WHERE email = ?
    FA-->>AdminFE: {success: true}
    Note over FS: Vendor's status_checks.py reads Firestore on next API call
    Note over FS: verify_vendor_active() will now allow vendor operations
```

---

## 5. Affiliate System Flow

### 5A — Affiliate Profile Creation (Fully Client-Side)

```mermaid
sequenceDiagram
    participant User
    participant FE as AffiliateContext.jsx
    participant FS as Firestore

    User->>FE: Navigate to /affiliate route
    FE->>FS: onSnapshot(affiliates where userId == uid)
    alt No affiliate doc found
        FE->>FS: getDocs(affiliates) — count all docs
        FE->>FS: affiliates/{uid}.set({code: 'AFF001', commissionRate: 30, ...})
        FE->>FS: users/{uid}.updateDoc({isApproved: true, role: 'Affiliate'})
        Note over FS: ⚠️ No FastAPI validation — any user becomes affiliate
        Note over FS: ⚠️ Commission rate hardcoded to 30% client-side
    else Affiliate doc found
        FE->>FE: setAffiliate(data)
        FE->>FS: affiliateConversions where affiliateId == affId — onSnapshot
        FE->>FS: affiliatePayoutRequests where affiliateId == affId — onSnapshot
        FE->>FS: affiliateActivity where affiliateId == affId — onSnapshot
    end
```

### 5B — Affiliate Referral & Conversion Flow

```mermaid
sequenceDiagram
    participant Customer
    participant FE as AppContext
    participant FS as Firestore
    participant Eco as ecosystemService.js

    Customer->>FE: Click affiliate link ?ref=AFF001
    FE->>FE: sessionStorage.set('lumora_aff_ref', 'AFF001')
    Customer->>FE: Complete purchase
    FE->>Eco: onPurchaseComplete(uid, items, total, 'AFF001')
    Eco->>FS: affiliateLinks where code == 'AFF001' — getDocs
    Eco->>FS: affiliateLinks/{id}.update({conversions++, revenue++})
    Eco->>FS: affiliateConversions.add({affiliateId, amount, commission, ...})
    Eco->>FS: vendorAnalytics/{vendorId}.update({revenue++})
    Eco->>FS: products/{id}.update({downloads++})
    Note over FS: ⚠️ All writes are client-side — amounts unvalidated
    Note over FS: ⚠️ Commission calculation is done in browser
```

### 5C — Affiliate Payout Request Flow

```mermaid
sequenceDiagram
    participant AffiliateFE as Affiliate Earnings Page
    participant FA as FastAPI /api/affiliate/payouts
    participant SQLite

    AffiliateFE->>FA: POST /api/affiliate/payouts {amount, method} + JWT
    FA->>SQLite: INSERT INTO affiliate_payouts
    FA-->>AffiliateFE: payout record
    Note over FA: FastAPI validates amount against SQLite commissions
    Note over FA: This is the ONE safe path in the affiliate system
    Note over FS: ⚠️ But Firestore payout requests (affiliatePayoutRequests)
    Note over FS: are created separately by AffiliateContext — not linked
```

---

## 6. Admin Control Flow

### 6A — Admin Page Data Flow Overview

```mermaid
flowchart TD
    subgraph AdminPages["Admin Frontend Pages"]
        direction LR
        DASH[Dashboard.jsx]
        PROD[ProductsManagement.jsx]
        VEND[Vendors.jsx]
        CUST[CustomersManagement.jsx]
        ORD[OrdersManagement.jsx]
        ANA[Analytics.jsx]
        REP[Reports.jsx]
        REV[Reviews.jsx]
        SET[Settings.jsx]
        PAY[Payments.jsx]
    end

    subgraph Services["Frontend Services"]
        DS[dashboardService]
        AS[analyticsService]
        OS[orderService]
        RS[reportsService]
        RAS[reviewAnalyticsService]
        SS[settingsService]
        VS[vendorService]
        PS[paymentService]
    end

    subgraph FastAPI["FastAPI Admin Endpoints"]
        FA1[/api/admin/analytics/dashboard-full]
        FA2[/api/admin/orders/]
        FA3[/api/admin/reports/]
        FA4[/api/admin/reviews/dashboard]
        FA5[/api/admin/settings/]
        FA6[/api/admin/vendors/ & affiliates/]
        FA7[/api/admin/payments/]
    end

    subgraph FS["Firestore"]
        FSO[orders collection]
        FSP[products collection]
        FSU[users collection]
        FSPS[platformSettings/global]
        FSREP[reports collection]
        FSREV[reviews collection — via analytics service]
    end

    DASH --> DS --> FA1 --> FS
    DASH -.->|onSnapshot| FSO & FSREV
    PROD -.->|onSnapshot| FSP
    PROD --> FA_PROD[/api/admin/products/]
    VEND --> VS --> FA6 --> FS
    CUST -.->|onSnapshot| FSU & FSO
    ORD --> OS --> FA2 --> FSO
    ANA --> AS --> FA1 --> FS
    ANA -.->|onSnapshot| FSO & FSREV
    REP --> RS --> FA3 --> FSREP
    REP -.->|onSnapshot| FSREP
    REV --> RAS --> FA4 --> FS
    SET --> SS --> FSPS
    SET --> FA5 --> FSPS
    PAY --> PS --> FA7 --> FSO

    style FS fill:#e8f4f8
    style FastAPI fill:#f0e8f8
```

### 6B — Platform Pause/Resume Flow

```mermaid
sequenceDiagram
    participant AdminFE as Admin Settings Page
    participant FA as FastAPI /api/admin/settings/pause
    participant FS as Firestore platformSettings/global
    participant AllUsers as All Frontend Clients

    AdminFE->>FA: POST /api/admin/settings/pause {message}
    FA->>FA: require_admin_role()
    FA->>FS: platformSettings/global.set({isPlatformPaused: true, pauseMessage, ...})
    FA-->>AdminFE: {success: true}
    
    FS-->>AllUsers: onSnapshot fires for all subscribers
    AllUsers->>AllUsers: usePlatformSettings hook receives update
    AllUsers->>AllUsers: AffiliateContext receives update
    AllUsers->>AllUsers: UI shows platform paused banner

    Note over FA,FS: Next vendor API call triggers:
    Note over FA,FS: verify_vendor_active() → check_platform_paused()
    Note over FA,FS: → reads platformSettings/global from Firestore
    Note over FA,FS: → raises 403 if isPlatformPaused == true
```

---

## 7. Platform Settings Flow

```mermaid
flowchart TD
    subgraph Writes["Write Paths"]
        W1[Admin Settings Page → FastAPI POST /settings/pause]
        W2[Admin Settings Page → FastAPI PUT /settings/]
        W3[Settings.jsx handlePlatformToggle → settingsService → Firestore direct]
    end

    FS[(Firestore<br/>platformSettings/global)]

    W1 --> FS
    W2 --> FS
    W3 --> FS

    subgraph Reads["Read Paths — Real-time Subscribers"]
        R1[usePlatformSettings hook → all pages]
        R2[AffiliateContext.jsx → affiliateProgramEnabled]
        R3[Admin validators → check_platform_paused]
        R4[status_checks.py → verify_vendor_active]
        R5[Admin Settings UI → display current flags]
    end

    FS --> R1
    FS --> R2
    FS --> R3
    FS --> R4
    FS --> R5

    note["⚠️ W3 writes directly to Firestore bypassing FastAPI<br/>W1 and W2 write via FastAPI (preferred path)"]
    style note fill:#fff3cd
```

---

## 8. Real-time Listener Map

This table lists every `onSnapshot` / real-time Firestore listener in the frontend.

| File | Collection / Doc | Trigger | Updates |
|---|---|---|---|
| `AffiliateContext.jsx` | `platformSettings/global` | Always (mount) | `affiliateProgramEnabled` state |
| `AffiliateContext.jsx` | `users/{uid}` | Always (mount) | `isApproved`, `isSuspended`, `canPromote` |
| `AffiliateContext.jsx` | `affiliates` where `userId == uid` | Always (mount) | `affiliate` profile state |
| `AffiliateContext.jsx` | `affiliateConversions` where `affiliateId == affId` | After affiliate found | `conversions` state |
| `AffiliateContext.jsx` | `affiliatePayoutRequests` where `affiliateId == affId` | After affiliate found | `payouts` state |
| `AffiliateContext.jsx` | `affiliateActivity` where `affiliateId == affId` | After affiliate found | `activity` state |
| `AffiliateContext.jsx` | `notifications` where `userId == uid` | Always (mount) | `notifications` state |
| `AppContext.jsx` | `products` (all) | Mount | `products` state (merges with FastAPI data) |
| `CustomersManagement.jsx` | `users` (role=customer) | Mount | Customers list |
| `CustomersManagement.jsx` | `orders` (all) | Mount | Orders joined with customers |
| `dashboardService.js` | `orders` (all) | Subscribe call | Dashboard revenue stats |
| `dashboardService.js` | `reviews` (all) | Subscribe call | Dashboard review stats |
| `dashboardService.js` | `reports` (all) | Subscribe call | Dashboard report count |
| `analyticsService.js` | `orders` (all) | Subscribe call | Real-time order analytics |
| `analyticsService.js` | `reviews` (all) | Subscribe call | Real-time review analytics |
| `reportsService.js` | `reports` (all) | Subscribe call | Live report list |
| `settingsService.js` | `platformSettings/global` | Subscribe call | Platform feature flags |
| `usePlatformSettings.js` | `platformSettings/global` | Mount | Settings for any component |
| `paymentService.js` | `orders` (all) | Subscribe call | Payment telemetry |
| `paymentService.js` | `users` (all) | Subscribe call | Vendor list for payout calc |

### Listener Dependency Graph

```mermaid
graph LR
    FS[(Firestore)]
    
    subgraph "Always Active"
        AC[AffiliateContext<br/>7 listeners]
        APP[AppContext<br/>1 listener]
        UPS[usePlatformSettings<br/>1 listener]
    end
    
    subgraph "Admin Page Subscriptions"
        DS[dashboardService<br/>3 listeners]
        AS[analyticsService<br/>2 listeners]
        RS[reportsService<br/>1 listener]
        SS[settingsService<br/>1 listener]
        CM[CustomersManagement<br/>2 listeners]
        PS[paymentService<br/>2 listeners]
    end
    
    FS --> AC
    FS --> APP
    FS --> UPS
    FS --> DS
    FS --> AS
    FS --> RS
    FS --> SS
    FS --> CM
    FS --> PS
    
    note["⚠️ When an affiliate user is on admin pages,<br/>AffiliateContext listeners + admin page listeners<br/>may run simultaneously — up to 20 active listeners"]
    style note fill:#fff3cd
```
