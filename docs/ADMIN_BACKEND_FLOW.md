# Admin Backend Flowcharts — Lumora Platform

This document presents workflow visualisations of operations in the Lumora Admin Control Layer.

---

## 1. Product Management Flow

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant API as admin.routes.products
    participant DB as SQLite Products Table
    participant FS as Firestore products Collection
    participant Client as Vendor/Customer Client (onSnapshot)

    Admin->>API: POST/PUT/DELETE /products
    API->>API: verify role == "admin"
    API->>DB: Perform SQL writes (insert/update/delete)
    API->>FS: Trigger sync_product_to_firestore
    FS-->>Client: Live updates propagated immediately
    API-->>Admin: Return JSON response
```

---

## 2. Vendor Management (Status Updates)

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant API as admin_controls_vendor.routes
    participant FS as Firestore (users & vendors)
    participant DB as SQLite Users Table
    participant Client as Vendor Dashboard (onSnapshot)

    Admin->>API: PUT /vendors/{uid}/status (status: active/disabled)
    API->>API: verify role == "admin"
    API->>FS: Update status & approval fields
    API->>DB: Sync user.is_active field
    FS-->>Client: Real-time telemetry detects status change
    Note over Client: Read-only layout is automatically applied if disabled
    API-->>Admin: Return success response
```

---

## 3. Affiliate Management (Status Updates)

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant API as admin_controls_affiliate.routes
    participant FS as Firestore (users & affiliates)
    participant DB as SQLite (users & profiles)
    participant Client as Affiliate Dashboard (onSnapshot)

    Admin->>API: PUT /affiliates/{uid}/status (status: active/disabled)
    API->>API: verify role == "admin"
    API->>FS: Update status fields
    API->>DB: Sync user.is_active & profile.is_active
    FS-->>Client: Real-time telemetry updates dashboard state
    API-->>Admin: Return success response
```

---

## 4. Global Pause Flow

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant API as admin.routes.settings
    participant FS as Firestore (platformSettings/global)
    actor Vendor as Vendor/Affiliate
    participant V_API as Protected Write Endpoints

    Admin->>API: POST /settings/pause
    API->>FS: Set isPlatformPaused = true
    Note over FS: Settings subscription triggers platform-wide
    Vendor->>V_API: Attempt Write (e.g. Create Product)
    V_API->>V_API: Dependency checkPlatformPaused()
    V_API-->>Vendor: Raise 403 Forbidden ("Platform is temporarily paused.")
```

---

## 5. User Authentication Guard Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Vendor/Affiliate
    participant Auth as api/auth (login / firebase-sync)
    participant FS as Firestore status lookup
    participant API as Token issue

    User->>Auth: Submit Login Credentials / Sync Token
    Auth->>FS: Check account status for roles vendor/affiliate
    alt Status is suspended/disabled/rejected
        FS-->>Auth: status matches disabled list
        Auth-->>User: Raise 403 Forbidden ("Account Disabled")
    else Status is active
        FS-->>Auth: status == "active"
        Auth->>API: Generate Access Token JWT
        API-->>User: Return access token
    end
```

---

## 6. Real-time Analytics Update Flow

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant Checkout as checkout_router
    participant FS as Firestore orders Collection
    participant Client as Admin Analytics (onSnapshot)

    Customer->>Checkout: Complete payment
    Checkout->>FS: Insert new order document
    FS-->>Client: Analytics refresh metrics automatically
```
