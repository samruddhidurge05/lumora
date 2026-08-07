# Admin Portal Control Workflows

This document outlines the lifecycles, states, and operations of administrative controls in Lumora.

---

## 🔄 Complete Admin Lifecycle

```mermaid
sequenceDiagram
    actor Admin as Authorized Admin
    participant Auth as AuthContext
    participant Router as RoleRouter
    participant Dash as Admin Dashboard
    participant API as FastAPI Admin Router
    participant DB as Firestore DB

    Admin->>Auth: Request login (admin@lumora.co / JWT)
    Auth->>Auth: Validate claims (role == 'admin')
    Auth->>Router: Resolve path redirection
    Router->>Dash: Load /admin/dashboard
    activate Dash
    Dash->>DB: Subscribe to real-time streams (orders, users, reports)
    DB-->>Dash: Feed initial telemetry data sets
    deactivate Dash

    Admin->>Dash: Perform action (e.g., approve vendor)
    Dash->>API: HTTP POST /api/admin/vendors/approve {vendor_id}
    API->>API: Authenticate Admin token
    API->>DB: Set vendor status = 'active'
    DB-->>Dash: Reactive UI Update
```

---

## ⏸️ Global Platform Pause Workflow

Admins have the capability to execute a **Global Pause**. This stops vendor product creation and affiliate linking operations, but keeps the marketplace fully open for customers.

```mermaid
graph TD
    AdminClick["Admin Toggles Global Pause Switch"]
    AdminClick --> WriteDB["Write 'maintenanceMode = true' to Firestore ('settings/global')"]
    
    subgraph Reactive Impact Listeners
        WriteDB --> ListenerV["Vendor Dashboard Hook (usePlatformSettings)"]
        WriteDB --> ListenerA["Affiliate Dashboard Hook (usePlatformSettings)"]
        WriteDB --> ListenerC["Customer Marketplace Header/Cart"]
    end

    ListenerV --> BlockV["Disable Add/Edit Product buttons & show banner"]
    ListenerA --> BlockA["Disable referral generation & disable dashboard actions"]
    ListenerC --> AllowC["Show soft status warning banner, but ALLOW purchases"]

    style BlockV fill:#fcc,stroke:#f66,stroke-width:2px
    style BlockA fill:#fcc,stroke:#f66,stroke-width:2px
    style AllowC fill:#cfc,stroke:#3a3,stroke-width:2px
```

---

## 🚫 Individual Vendor & Affiliate Suspension Workflow

If a vendor or affiliate violates policies, they can be suspended individually without affecting any other sellers or customer orders.

```mermaid
graph LR
    AdminPanel["Admin: Click Suspend User"]
    AdminPanel --> POST["REST POST /api/admin/vendors/suspend"]
    POST --> TokenCheck{"Valid Admin Token?"}
    
    TokenCheck -- No --> Reject["HTTP 403 Forbidden"]
    TokenCheck -- Yes --> UpdateDB["Update Firestore ('users/{uid}') -> { accountStatus: 'suspended' }"]
    
    UpdateDB --> VendorAuth["Vendor Session (Real-time listener)"]
    VendorAuth --> ForceLogout["Block Access & Display Suspension Message"]

    style Reject fill:#f99,stroke:#e33
    style ForceLogout fill:#f99,stroke:#e33
```

---

*For backend integration details of these workflows, see [ADMIN_BACKEND_FLOW.md](file:///d:/SAM(DIGI)/digital-marketplace/Digi/digital-marketplace/ADMIN_BACKEND_FLOW.md).*
