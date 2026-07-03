# Lumora — Admin Control Flow
> Exact sequence diagrams for every Admin control operation.
> Shows Admin → FastAPI → Firestore → Vendor/Affiliate listener chain.
> Date: July 2, 2026

---

## Table of Contents

1. [Vendor Control Flows](#1-vendor-control-flows)
2. [Affiliate Control Flows](#2-affiliate-control-flows)
3. [Product Control Flows](#3-product-control-flows)
4. [Platform Status Control Flows](#4-platform-status-control-flows)
5. [Order Control Flows](#5-order-control-flows)
6. [Analytics & Reports Control Flows](#6-analytics--reports-control-flows)
7. [Settings Control Flows](#7-settings-control-flows)
8. [Complete Control Layer Map](#8-complete-control-layer-map)

---

## 1. Vendor Control Flows

### Enable Vendor

```mermaid
sequenceDiagram
    participant ADM as Admin (Vendors.jsx)
    participant VS as vendorService.approveVendor()
    participant FA as FastAPI PUT /api/admin/vendors/{uid}/status
    participant ACV as admin_controls_vendor/services.py
    participant FS_U as Firestore users/{uid}
    participant FS_V as Firestore vendors/{uid}
    participant SQL as SQLite users
    participant VEN as Vendor Browser

    ADM->>VS: approveVendor(uid)
    VS->>FA: PUT {status: "active"} + JWT
    FA->>FA: require_admin_role() — JWT decode → SQLite role check
    FA->>ACV: update_vendor_status(uid, "active")
    ACV->>FS_U: .set({accountStatus:"active", isApproved:true, status:"Approved"}, merge)
    ACV->>FS_V: .set({status:"active", isApproved:true}, merge)
    ACV->>FS_U: .get() → resolve email for SQLite lookup
    ACV->>SQL: UPDATE users SET is_active=True WHERE email=?
    FA-->>ADM: {success: true}

    Note over FS_U: Real-time propagation:
    FS_U-->>VEN: onSnapshot users/{uid} fires (if AffiliateContext active)
    VEN->>VEN: setIsApproved(true), setIsSuspended(false)
    VEN->>VEN: affiliateAllowed = true
    Note over VEN: Vendor's next API call succeeds
```

### Disable / Suspend Vendor

```mermaid
sequenceDiagram
    participant ADM as Admin
    participant FA as FastAPI PUT /api/admin/vendors/{uid}/status
    participant ACV as admin_controls_vendor/services.py
    participant FS as Firestore
    participant SQL as SQLite
    participant VEN as Vendor Browser

    ADM->>FA: PUT {status: "disabled"} + JWT
    FA->>FA: require_admin_role()
    FA->>ACV: update_vendor_status(uid, "disabled")
    ACV->>FS: users/{uid}.set({accountStatus:"disabled", isApproved:false})
    ACV->>FS: vendors/{uid}.set({status:"disabled", isApproved:false})
    ACV->>SQL: UPDATE users SET is_active=False
    FA-->>ADM: {success: true}

    Note over VEN: Vendor makes API call:
    VEN->>FA_VEN: GET /api/vendors/{id}/products + JWT
    FA_VEN->>FA_VEN: verify_vendor_active()
    FA_VEN->>FS: get_vendor_status_from_firestore(str(user.id))
    FS-->>FA_VEN: "disabled"
    FA_VEN-->>VEN: 403 Vendor account is disabled

    Note over FS: If vendor has AffiliateContext running:
    FS-->>VEN: onSnapshot users/{uid} → isApproved=false
    VEN->>VEN: affiliateAllowed = false (real-time UI block)
```

### Admin Vendor Control — What Each Status Enforces

```mermaid
flowchart TD
    A[Admin sets vendor status] --> B{Status value}

    B --> C["active"]
    B --> D["restricted"]
    B --> E["disabled"]
    B --> F["suspended"]

    C --> C1[Firestore accountStatus = active]
    C --> C2[Firestore isApproved = true]
    C --> C3[SQLite is_active = True]
    C --> C4[All vendor API calls allowed]

    D --> D1[Firestore accountStatus = restricted]
    D --> D2[Firestore isApproved = false]
    D --> D3[SQLite is_active = False]
    D --> D4[All vendor API calls return 403]

    E --> E1[Firestore accountStatus = disabled]
    E --> E2[Firestore isApproved = false]
    E --> E3[SQLite is_active = False]
    E --> E4[All vendor API calls return 403]

    F --> F1[Firestore accountStatus = suspended]
    F --> F2[Firestore isApproved = false]
    F --> F3[SQLite is_active = False]
    F --> F4[All vendor API calls return 403]
```

---

## 2. Affiliate Control Flows

### Enable Affiliate

```mermaid
sequenceDiagram
    participant ADM as Admin (Vendors.jsx Affiliate tab)
    participant VS as vendorService.approveAffiliate()
    participant FA as FastAPI PUT /api/admin/affiliates/{uid}/status
    participant ACA as admin_controls_affiliate/services.py
    participant FS_U as Firestore users/{uid}
    participant FS_A as Firestore affiliates/{uid}
    participant SQL as SQLite users + affiliate_profiles
    participant AFF as Affiliate Browser (AffiliateContext)

    ADM->>VS: approveAffiliate(uid)
    VS->>FA: PUT {status: "active"} + JWT
    FA->>FA: require_admin_role()
    FA->>ACA: update_affiliate_status(uid, "active")
    ACA->>FS_U: .set({accountStatus:"active", isApproved:true}, merge)
    ACA->>FS_A: .set({status:"active"}, merge)
    ACA->>FS_U: .get() → resolve email
    ACA->>SQL: UPDATE users SET is_active=True WHERE email=?
    ACA->>SQL: UPDATE affiliate_profiles SET is_active=True
    FA-->>ADM: {success: true}

    Note over AFF: Real-time — AffiliateContext.jsx:
    FS_U-->>AFF: onSnapshot users/{uid} fires
    AFF->>AFF: setIsApproved(data.isApproved = true)
    AFF->>AFF: affiliateAllowed = true
    Note over AFF: Affiliate's promote/link/payout buttons re-enable immediately
```

### Disable Affiliate

```mermaid
sequenceDiagram
    participant ADM as Admin
    participant FA as FastAPI PUT /api/admin/affiliates/{uid}/status
    participant ACA as admin_controls_affiliate/services.py
    participant FS as Firestore
    participant SQL as SQLite
    participant AFF as Affiliate Browser

    ADM->>FA: PUT {status: "disabled"} + JWT
    FA->>FA: require_admin_role()
    FA->>ACA: update_affiliate_status(uid, "disabled")
    ACA->>FS: users/{uid}.accountStatus = "disabled"
    ACA->>FS: affiliates/{uid}.status = "disabled"
    ACA->>SQL: UPDATE users SET is_active=False
    FA-->>ADM: {success: true}

    Note over AFF: Immediate real-time block (AffiliateContext):
    FS-->>AFF: onSnapshot users/{uid} fires
    AFF->>AFF: isApproved = false (data.isApproved === false)
    AFF->>AFF: affiliateAllowed = false
    Note over AFF: All affiliate actions disabled in UI immediately

    Note over AFF: Also:
    FS-->>AFF: onSnapshot affiliates/{uid} fires
    AFF->>AFF: affiliate.status = "disabled"

    Note over AFF: On next FastAPI call:
    AFF->>FA_AFF: POST /api/affiliate/payouts + JWT
    FA_AFF->>FA_AFF: verify_affiliate_active()
    FA_AFF->>FS: get_affiliate_status_from_firestore(str(user.id))
    FS-->>FA_AFF: "disabled"
    FA_AFF-->>AFF: 403 Affiliate account is disabled
```

### The Affiliate Listener Chain (Why No Direct Coupling Needed)

```mermaid
flowchart TD
    A[Admin disables affiliate] --> B[FastAPI validates + writes Firestore]
    B --> C[(Firestore users/uid<br/>accountStatus: disabled)]
    B --> D[(Firestore affiliates/uid<br/>status: disabled)]

    C --> E[AffiliateContext onSnapshot users/uid fires]
    D --> F[AffiliateContext onSnapshot affiliates fires]

    E --> G[setIsApproved false]
    F --> H[affiliate.status = disabled]

    G --> I[affiliateAllowed = false]
    I --> J[All UI promote buttons disabled]
    I --> K[All link generation disabled]
    I --> L[All payout buttons disabled]

    Note1[Admin never touches Affiliate UI code]
    Note2[Affiliate UI reacts purely through existing Firestore listeners]
    Note3[Zero coupling between Admin logic and Affiliate dashboard]
```

---

## 3. Product Control Flows

### Admin Creates Product

```mermaid
sequenceDiagram
    participant ADM as Admin ProductsManagement.jsx
    participant FA as FastAPI POST /api/admin/products/
    participant SQL as SQLite products
    participant FS as Firestore products/{id}
    participant MKT as AppContext (Marketplace)
    participant VEN as Vendor ManageProducts

    ADM->>FA: POST {title, price, category, ...} + JWT
    FA->>FA: require_admin_role()
    FA->>SQL: INSERT INTO products
    SQL-->>FA: Product {id: 101}
    FA->>FS: sync_product_to_firestore(product)
    FS->>FS: products/101.set({title, price, vendor_id, status, ...})
    FA-->>ADM: ProductResponse {id: 101}

    FS-->>MKT: onSnapshot fires → product 101 appears in marketplace
    Note over VEN: Vendor pages read from FastAPI /vendors/{id}/products
    Note over VEN: No Firestore dependency — vendor list is unaffected
```

### Admin Updates Product

```mermaid
sequenceDiagram
    participant ADM as Admin
    participant FA as FastAPI PUT /api/admin/products/{id}
    participant SQL as SQLite
    participant FS as Firestore

    ADM->>FA: PUT {status: "draft"} + JWT
    FA->>FA: require_admin_role()
    FA->>SQL: UPDATE products SET status='draft'
    FA->>FS: products/{id}.set({status:'draft'}, merge)
    FA-->>ADM: ProductResponse (updated)
    FS-->>MKT: onSnapshot → product removed from published list
```

### Admin Deletes Product

```mermaid
sequenceDiagram
    participant ADM as Admin
    participant FA as FastAPI DELETE /api/admin/products/{id}
    participant SQL as SQLite
    participant FS as Firestore

    ADM->>FA: DELETE /api/admin/products/{id} + JWT
    FA->>FA: require_admin_role()
    FA->>SQL: DELETE FROM products WHERE id=?
    FA->>FS: delete_product_from_firestore(product_id)
    FS->>FS: products/{id}.delete()
    FA-->>ADM: 204 No Content
    FS-->>MKT: onSnapshot → product disappears from all UIs
```

---

## 4. Platform Status Control Flows

### Global Pause

```mermaid
sequenceDiagram
    participant ADM as Admin Settings Page
    participant PS as platformService.disablePlatform()
    participant FA as FastAPI POST /api/admin/settings/pause
    participant FS as Firestore platformSettings/global
    participant ALL as All Frontend Clients

    ADM->>PS: disablePlatform("Maintenance in progress")
    PS->>FA: POST {message: "Maintenance..."} + JWT
    FA->>FA: require_admin_role()
    FA->>FS: platformSettings/global.set({isPlatformPaused:true, pauseMessage, updatedBy})
    FA-->>ADM: {success: true}

    Note over FS: Simultaneous broadcast to all onSnapshot subscribers:
    FS-->>ALL: usePlatformSettings hook fires everywhere
    FS-->>ALL: AffiliateContext.affiliateProgramEnabled = false
    FS-->>ALL: Admin status_checks.check_platform_paused() reads Firestore

    Note over VEN_API: Vendor API calls now blocked:
    VEN_API->>VEN_API: verify_vendor_active() → check_platform_paused()
    VEN_API-->>VEN: 403 Platform is temporarily paused

    Note over AFF_API: Affiliate API calls now blocked:
    AFF_API->>AFF_API: verify_affiliate_active() → check_platform_paused()
    AFF_API-->>AFF: 403 Platform is temporarily paused
```

### Global Resume

```mermaid
sequenceDiagram
    participant ADM as Admin Settings Page
    participant PS as platformService.enablePlatform()
    participant FA as FastAPI POST /api/admin/settings/resume
    participant FS as Firestore platformSettings/global

    ADM->>PS: enablePlatform()
    PS->>FA: POST {} + JWT
    FA->>FA: require_admin_role()
    FA->>FS: platformSettings/global.set({isPlatformPaused:false})
    FA-->>ADM: {success: true}

    Note over FS: All subscribers receive update:
    FS-->>VEN: verify_vendor_active now passes
    FS-->>AFF: verify_affiliate_active now passes
    FS-->>ALL: Platform banners dismissed across all UIs
```

### Feature Flag Toggle

```mermaid
flowchart TD
    A[Admin toggles feature flag in Settings.jsx] --> B{Which service?}

    B -->|pause/resume buttons| C[platformService.js]
    C --> D[POST /api/admin/settings/pause or /resume]
    D --> E[require_admin_role ✅]
    E --> F[(Firestore platformSettings/global)]

    B -->|feature toggle switches| G[settingsService.js ⚠️]
    G --> H[doc.set platformSettings/global DIRECT ⚠️]
    H -.->|no auth check| F

    F --> I[usePlatformSettings fires everywhere]

    style G fill:#e67e22,color:#fff
    style H fill:#e74c3c,color:#fff
    Note1["⚠️ settingsService.js bypass must be fixed\nShould call PUT /api/admin/settings/ instead"]
```

---

## 5. Order Control Flows

### Customer Checkout → Admin Visibility (Current Broken State)

```mermaid
flowchart TD
    A[Customer completes checkout] --> B[AppContext.completePurchase]
    B --> C[POST /api/orders/ via createOrderApi]
    C --> D[(SQLite orders + order_items)]
    D -.->|❌ NEVER SYNCED| E[(Firestore orders)]

    B --> F[ecosystemService.onPurchaseComplete]
    F --> G[addDoc Firestore orders — different schema]
    G --> E

    H[Admin views orders] --> I[orderService.js]
    I --> J[FastAPI GET /api/admin/orders/]
    J --> K[admin_api/orders/services.py]
    K --> L[reads Firestore orders]
    L --> M{Firestore orders content}
    M -->|schema from ecosystemService| N[Shows client-written orders]
    M -->|SQLite orders| O[❌ Never visible]

    style D fill:#2c3e50,color:#fff
    style E fill:#1a73e8,color:#fff
    style O fill:#e74c3c,color:#fff
```

### Target: Customer Checkout → Admin Visibility (After Fix)

```mermaid
sequenceDiagram
    participant CUS as Customer
    participant FA as FastAPI POST /api/orders/
    participant SQL as SQLite
    participant FS as Firestore orders/{id}
    participant ADM as Admin Orders Page

    CUS->>FA: POST {items, total, payment_method} + JWT
    FA->>SQL: INSERT INTO orders (total, user_id, status='completed')
    FA->>SQL: INSERT INTO order_items (order_id, product_id, price_paid)
    FA->>SQL: UPDATE products SET downloads += 1
    FA->>FS: sync_order_to_firestore(order, items)
    FS->>FS: orders/{id}.set({orderId, customerId, items[], totalINR, status, ...})
    FA-->>CUS: OrderResponse

    ADM->>FA: GET /api/admin/orders/
    FA->>FS: orders.stream()
    FS-->>FA: [{id, orderId, customerId, items, status, ...}]
    FA-->>ADM: order list with customer's order
```

### Admin Updates Order Status

```mermaid
sequenceDiagram
    participant ADM as Admin OrdersManagement
    participant OS as orderService.updateOrderStatus()
    participant FA as FastAPI PUT /api/admin/orders/{id}/status
    participant FS as Firestore orders/{id}
    participant SQL as SQLite orders (MISSING — must add)
    participant AFF as Affiliate System

    ADM->>OS: updateOrderStatus(id, "Completed")
    OS->>FA: PUT {status: "Completed"} + JWT
    FA->>FA: require_admin_role()
    FA->>FS: orders/{id}.update({status:"Completed"})
    FA->>SQL: UPDATE orders SET status='Completed' WHERE id=? ← must add
    FA->>FA: check_and_create_affiliate_conversion() — if ref code exists
    Note over FA: Creates affiliateConversions if order has ?ref= code
    FA-->>ADM: {success: true}
```

---

## 6. Analytics & Reports Control Flows

### Admin Dashboard Data Flow

```mermaid
flowchart TD
    subgraph AdminDash["Admin Dashboard.jsx"]
        DS[dashboardService.subscribeToAdminDashboard]
    end

    subgraph DashSvc["dashboardService.js"]
        D1[FastAPI GET /admin/analytics/dashboard-full]
        D2[onSnapshot Firestore orders]
        D3[onSnapshot Firestore reviews]
        D4[onSnapshot Firestore reports]
    end

    subgraph FastAPI_A["FastAPI admin_api/analytics/services.py"]
        A1[reads Firestore orders → revenue, conversions]
        A2[reads Firestore products → counts]
        A3[reads Firestore vendors → approved count]
        A4[reads Firestore reviews → ratings]
    end

    DS --> D1 & D2 & D3 & D4
    D1 --> A1 & A2 & A3 & A4
    D2 & D3 & D4 -.-> FS[(Firestore)]
    A1 & A2 & A3 & A4 --> FS

    FS -->|"⚠️ orders collection only has client-written orders"| BROKEN[Admin analytics incomplete]

    style BROKEN fill:#e74c3c,color:#fff
```

### Admin Reports — Correct Flow (Template for Other Modules)

```mermaid
sequenceDiagram
    participant ADM as Admin Reports.jsx
    participant RS as reportsService.subscribeToReports()
    participant FA as FastAPI /api/admin/reports/
    participant FS as Firestore reports

    ADM->>RS: subscribeToReports(callback)
    RS->>FA: GET /api/admin/reports/analytics
    FA->>FS: reports.stream() → aggregate
    FA-->>RS: analytics data
    RS->>FS: onSnapshot(reports, callback)
    FS-->>RS: live report list
    RS-->>ADM: {analytics, reports[]}

    Note over ADM: Admin takes action:
    ADM->>FA: POST /api/admin/reports/resolve {reportId}
    FA->>FA: require_admin_role()
    FA->>FS: reports/{id}.update({status:'resolved'})
    FS-->>RS: onSnapshot fires → report list updates
```

---

## 7. Settings Control Flows

### Platform Settings Read (Always Works)

```mermaid
flowchart LR
    FS[(Firestore platformSettings/global)] 
    FS --> H1[usePlatformSettings hook]
    FS --> H2[AffiliateContext listener]
    FS --> H3[Admin Settings page]
    FS --> H4[status_checks.py FastAPI dependency]

    H1 --> P1[All pages: feature flags]
    H2 --> P2[Affiliate: program enabled/disabled]
    H3 --> P3[Admin: current settings display]
    H4 --> P4[API layer: pause enforcement]
```

### Platform Settings Write — Target (All Through FastAPI)

```mermaid
flowchart TD
    A[Admin changes any setting] --> B{Setting type}

    B --> C[Pause / Resume]
    C --> D[platformService.disablePlatform / enablePlatform]
    D --> E[POST /admin/settings/pause or /resume + JWT]
    E --> F[require_admin_role ✅]

    B --> G[Feature flag toggle]
    G --> H[Should call: PUT /api/admin/settings/ + JWT ← FIX]
    H --> I[require_admin_role ✅]

    B --> J[General settings update]
    J --> K[PUT /api/admin/settings/ + JWT]
    K --> L[require_admin_role ✅]

    F & I & L --> M[(Firestore platformSettings/global)]
    M --> N[Real-time propagation everywhere]
```

---

## 8. Complete Control Layer Map

```mermaid
graph TD
    ADMIN["Admin Panel"]

    subgraph VendorControl["Vendor Control Layer"]
        VC1["List vendors\nGET /admin/vendors/\n→ Firestore users"]
        VC2["Enable/Disable/Suspend\nPUT /admin/vendors/{uid}/status\n→ Firestore + SQLite"]
    end

    subgraph AffiliateControl["Affiliate Control Layer"]
        AC1["List affiliates\nGET /admin/affiliates/\n→ Firestore users"]
        AC2["Enable/Disable/Suspend\nPUT /admin/affiliates/{uid}/status\n→ Firestore + SQLite"]
    end

    subgraph ProductControl["Product Control Layer"]
        PC1["CRUD products\nPOST/PUT/DELETE /admin/products/\n→ SQLite + Firestore sync"]
    end

    subgraph PlatformControl["Platform Control Layer"]
        PL1["Pause/Resume\nPOST /admin/settings/pause or /resume\n→ Firestore platformSettings"]
        PL2["Feature flags\nPUT /admin/settings/\n→ Firestore platformSettings"]
    end

    subgraph OrderControl["Order Control Layer"]
        OC1["List orders\nGET /admin/orders/\n→ Firestore orders"]
        OC2["Update status\nPUT /admin/orders/{id}/status\n→ Firestore + SQLite (fix)"]
    end

    subgraph AnalyticsControl["Analytics & Reports"]
        AN1["Dashboard\nGET /admin/analytics/dashboard-full\n→ Firestore aggregation"]
        AN2["Reports CRUD\n/admin/reports/*\n→ Firestore reports"]
        AN3["Reviews moderation\n/admin/reviews/*\n→ Firestore reviews"]
    end

    ADMIN --> VendorControl
    ADMIN --> AffiliateControl
    ADMIN --> ProductControl
    ADMIN --> PlatformControl
    ADMIN --> OrderControl
    ADMIN --> AnalyticsControl

    subgraph Reactions["Automatic Reactions (No Admin Coupling)"]
        VEN_REACT["Vendor UI blocked\nvia verify_vendor_active()"]
        AFF_REACT["Affiliate UI blocked\nvia AffiliateContext\nonSnapshot + API guard"]
        MKT_REACT["Marketplace updated\nvia AppContext onSnapshot"]
        ALL_REACT["All UIs get settings\nvia usePlatformSettings"]
    end

    VendorControl --> VEN_REACT
    AffiliateControl --> AFF_REACT
    ProductControl --> MKT_REACT
    PlatformControl --> ALL_REACT

    Note["Admin never touches\nVendor, Affiliate, or Customer UI directly.\nAll propagation through Firestore listeners."]
    style Note fill:#e8f4f8
```
