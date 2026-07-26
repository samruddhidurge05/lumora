# Lumora Admin Authentication & Identity Architecture

## Overview
The Lumora Admin Identity Architecture enforces strict role isolation, zero-trust token exchange, and multi-tier state synchronization across SQLite/PostgreSQL, Firebase Auth, and Firestore.

```
+-------------------+      +-------------------+      +----------------------+
|  Firebase Auth    | ---> |  Firebase Sync    | ---> |  Lumora Backend JWT  |
| (Client Identity) |      | (/firebase-sync)  |      |  (Role Enforced)     |
+-------------------+      +-------------------+      +----------------------+
                                                                 |
                                                                 v
                                                      +----------------------+
                                                      | Admin Dashboard Gate |
                                                      |  (require_admin_role)|
                                                      +----------------------+
```

---

## Identity Isolation Rules

1. **Role Isolation**: Customer, Vendor, Affiliate, and Admin authentication channels are isolated. Admin authentication does NOT pollute customer login flows.
2. **Dual-Store Persistence**:
   - **PostgreSQL / SQLite**: Primary source of truth for identity, role permissions (`AdminRole`), audit logs, and invitation tokens (`AdminInvitation`).
   - **Firestore**: Real-time broadcast store for Admin Dashboard UI counters, active member cards, and live notifications (`admin_team`, `admin_invitations`, `admin_notifications`).
3. **Stateless Render Boot Recovery**: The backend does NOT hold authorization state in ephemeral process memory. All JWT tokens are cryptographically verified using `JWT_SECRET_KEY`, and user role permissions are fetched from DB on demand.
