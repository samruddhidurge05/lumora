# MarketplaceIntegrationDesign.md
# Phase 4 — Marketplace Integration & Intelligence
**Project:** Lumora Digital Marketplace  
**Phase:** 4 — Production Completion  
**Date:** July 2026  
**Status:** Design — NOT YET IMPLEMENTED

---

## 1. Architecture Overview

Phase 4 closes the gap between the current 73.8% production readiness and a 94% production-ready platform. The design follows three principles:

1. **Additive only** — every change adds new capability without breaking existing functionality
2. **Backward compatible** — existing JWT/Firebase/RBAC pipeline unchanged
3. **Minimal blast radius** — each milestone touches the fewest possible existing files

---

## 2. Milestone Breakdown

```
M4-M1  Security Hardening         (Critical — no code audit changes production risk)
M4-M2  Audit Log Completeness      (Add audit entries for orders/reviews/support)
M4-M3  Analytics Accuracy Fix      (Remove hardcoded metrics, fix geo region)
M4-M4  Contact Form Backend        (Route Contact.jsx to Firestore reports)
M4-M5  Report Lifecycle Completion (Customer sees resolution status)
M4-M6  Admin Notifications         (Unread count badges in sidebar)
M4-M7  Vendor Product Approval     (Approval gate before products go live)
M4-M8  Admin User Management       (RBAC, roles, invite workflow)
```

---

## 3. Detailed Design Per Milestone

---

### M4-M1 — Security Hardening

**Objective:** Make the platform safe to deploy publicly.

#### 3.1.1 JWT Secret Hard-Fail

**File to modify:** `backend/app/main.py` — `_validate_startup_config()`

**Current behavior:**
```python
if jwt_secret == "secret" or len(jwt_secret) < 16:
    _logger.warning(...)  # warns but continues
```

**Required behavior:**
```python
if jwt_secret == "secret" or len(jwt_secret) < 32:
    errors.append("JWT_SECRET_KEY is too weak. Must be 32+ random characters.")
    # sys.exit(1) already called if errors list is non-empty
```

**Impact:** Prevents production deployment with default JWT secret. Zero regression risk.

#### 3.1.2 CORS Restriction

**File to modify:** `backend/app/main.py` — CORSMiddleware configuration

**Design:** Read from environment variable `CORS_ORIGINS` (comma-separated). Default to `["http://localhost:5173"]` if not set. Fail startup if `CORS_ORIGINS` is `*` in production mode.

**New env variable:** `CORS_ORIGINS=https://lumora.app,https://www.lumora.app`

#### 3.1.3 Firebase Service Account — Gitignore

**File to modify:** `.gitignore`

**Add:**
```
lumora-e6ddc-firebase-adminsdk-fbsvc-abcf2d8c21.json
*.json
!package.json
!package-lock.json
!tsconfig.json
```

**Action required:** User must rotate the Firebase service account key in the Firebase Console after this change.

#### 3.1.4 Rate Limiting on Admin Routes

**File to modify:** `backend/app/main.py`

Apply slowapi `@limiter.limit("60/minute")` to admin router. Currently only customer-facing routes have rate limits.

---

### M4-M2 — Audit Log Completeness

**Objective:** Every significant admin action is traceable.

#### 3.2.1 Missing Audit Entries

**Files to modify:**
- `backend/app/admin_api/orders/routes.py` — log `order_status_change`, `order_refund`, `order_dispute`
- `backend/app/admin_api/reviews/routes.py` — log `review_moderated`
- `backend/app/admin_api/support/routes.py` — log `support_ticket_replied`, `support_ticket_status_changed`
- `backend/app/admin_api/reports/routes.py` — log `report_resolved`, `report_rejected`, `report_assigned`

#### 3.2.2 AuditLog Service Helper

**File to create:** `backend/app/services/audit_log_service.py`

```python
from app.models.audit_log import AuditLog
from datetime import datetime
from sqlalchemy.orm import Session

def log_admin_action(
    db: Session,
    admin_user_id: int,
    action: str,
    target_type: str = None,
    target_id: str = None,
    metadata: dict = None,
    ip_address: str = None
) -> AuditLog:
    import json
    entry = AuditLog(
        admin_user_id=admin_user_id,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id else None,
        metadata_json=json.dumps(metadata) if metadata else None,
        ip_address=ip_address,
        created_at=datetime.utcnow()
    )
    db.add(entry)
    db.commit()
    return entry
```

**New action types to add to `AuditLogs.jsx` ACTION_COLORS:**
```
order_status_change, order_refund, order_dispute
review_moderated
support_ticket_replied, support_ticket_status_changed
report_resolved, report_rejected, report_assigned
contact_request_resolved
```

---

### M4-M3 — Analytics Accuracy Fix

**Objective:** Dashboard shows real growth metrics, functional geo analytics.

#### 3.3.1 Real Period-over-Period Growth

**File to modify:** `backend/app/admin_api/analytics/services.py`

**Design:**
```python
def compute_growth(current_period_orders, previous_period_orders):
    current_rev = sum(float(o.get('total', 0)) for o in current_period_orders)
    previous_rev = sum(float(o.get('total', 0)) for o in previous_period_orders)
    if previous_rev == 0:
        return 0
    return round(((current_rev - previous_rev) / previous_rev) * 100, 1)
```

- For 30d view: compare last 30 days vs previous 30 days
- Replace hardcoded `"revenueChange": 12` with real computation
- Replace hardcoded `"growthVelocity": 18` with computed metric
- Remove hardcoded `"conversionRate": 3.2`

#### 3.3.2 Geo Region Fix

**File to modify:** `backend/admin/firestore/admin_firestore.py` — `sync_order_to_firestore()`

**Add region detection from billing address or IP (placeholder fallback to "India"):**
```python
# In sync_order_to_firestore, when building the Firestore document:
region = getattr(order, 'billing_region', None) or 'India'
# Add to Firestore order document:
"region": region,
```

This ensures the geo analytics chart works with real data.

---

### M4-M4 — Contact Form Backend

**Objective:** Contact.jsx form persists to backend; admin sees contact requests in Reports.

#### 3.4.1 New Public Endpoint

**File to create:** `backend/app/api/contact_router.py`

```python
POST /api/contact
Body: { name, email, subject, message }
Auth: NOT required (public endpoint)
Action: Write to Firestore 'reports' collection with:
  - category: 'contact_request'
  - status: 'pending'
  - reporter: name
  - description: message
  - title: subject
  - user_email: email
  - severity: 'low'
  - created_at: now
Returns: 201 { id, status: 'received' }
Rate limit: 3/hour per IP
```

**File to modify:** `backend/app/main.py` — register contact_router

**File to modify:** `frontend/src/pages/support/Contact.jsx`
- Replace `setSent(true)` with `backendFetch('/contact', { method: 'POST', body: JSON.stringify(form) })`
- Show error state if API fails

**Admin impact:** Contact requests appear automatically in Reports panel (already reads `reports` collection). No admin UI changes needed.

---

### M4-M5 — Report Lifecycle Completion

**Objective:** Customer sees the resolution status of their submitted reports.

#### 3.5.1 Backend Enhancement

**File to modify:** `backend/app/api/reports/routes.py`

`GET /api/reports/me` already exists and returns Firestore docs. The Firestore doc already has `status` field that admin updates via `/admin/reports/resolve`.

**Required:** Add `resolution_note` to Firestore report document when admin resolves:

**File to modify:** `backend/app/admin_api/reports/services.py` — `update_report_status()`
```python
def update_report_status(report_id: str, new_status: str, note: str = None):
    doc_ref = db.collection("reports").document(report_id)
    update_data = {
        "status": new_status,
        "resolvedAt": datetime.now(timezone.utc).isoformat(),
    }
    if note:
        update_data["resolution_note"] = note
    doc_ref.update(update_data)
```

**File to modify:** `backend/app/admin_api/reports/routes.py` — add optional `note` body param to `/resolve` and `/reject`

#### 3.5.2 Customer Dashboard — Reports Tab

**File to modify:** `frontend/src/pages/customer/Dashboard.jsx`

Add a "Reports" sub-tab to the Support section of the customer dashboard that calls `GET /api/reports/me` and shows:
- Title / Category
- Status badge (pending → investigating → resolved/rejected)
- Resolution note (when resolved)
- Date submitted

**Important:** This is a NEW tab inside an existing page — the existing layout is preserved. Only adds a new sub-tab/section.

---

### M4-M6 — Admin Notifications (Unread Counts)

**Objective:** Admin sidebar shows unread count badges for critical events.

#### 3.6.1 Backend — Notifications Count API

**File to create:** `backend/app/admin_api/notifications/routes.py`

```
GET /api/admin/notifications/counts
Auth: require_admin_role
Returns:
{
  "support_tickets": N,    # type='support_ticket', status='open', last 7d
  "reports": N,            # status='pending' in Firestore
  "pending_orders": N,     # status='Pending' or 'Processing' in Firestore
  "total": N               # sum of above
}
```

Implementation reads from:
- SQLite: `Conversation` table (type='support_ticket', status='open')
- Firestore: `reports` collection (status='pending')
- Firestore: `orders` collection (status='Pending' or 'Processing')

**File to create:** `backend/app/admin_api/notifications/__init__.py`

**File to modify:** `backend/app/main.py` — register notifications router at `/api/admin/notifications`

#### 3.6.2 Frontend — Sidebar Badge

**File to modify:** `frontend/src/pages/admin/components/AdminSidebar.jsx`

Add notification count fetching with 60-second polling:
```jsx
const [notifCounts, setNotifCounts] = useState({ total: 0, support_tickets: 0, reports: 0 });

useEffect(() => {
  const fetchCounts = () => backendFetch('/admin/notifications/counts')
    .then(d => setNotifCounts(d)).catch(() => {});
  fetchCounts();
  const interval = setInterval(fetchCounts, 60000);
  return () => clearInterval(interval);
}, []);
```

Show badge on "Support Inbox" nav item when `support_tickets > 0`.
Show badge on "Reports" nav item when `reports > 0`.
Show total badge on the sidebar header.

---

### M4-M7 — Vendor Product Approval Workflow

**Objective:** Vendor products require admin approval before going live on the marketplace.

#### 3.7.1 Status Flow Change

**New product status lifecycle:**
```
vendor creates product → status: 'pending_review'
admin approves → status: 'published' + audit log
admin rejects → status: 'rejected' + reason stored + vendor notified
```

**Current products** with status='published' are unaffected (grandfathered).

#### 3.7.2 Backend

**File to modify:** `backend/app/api/products_router.py`

On `POST /api/products/` (vendor creates product):
- If creator role is `vendor`: set initial status to `'pending_review'`
- If creator role is `admin`: set initial status to `'published'` (admin can self-publish)

**File to create:** `backend/app/admin_api/products/routes.py`

```
GET /api/admin/products/pending
  - Returns list of products where status='pending_review'
  - Paginated, protected by require_admin_role

POST /api/admin/products/{product_id}/approve
  - Sets status to 'published'
  - Syncs to Firestore via sync_product_to_firestore()
  - Creates audit log entry: action='product_approved'
  - Sends vendor notification

POST /api/admin/products/{product_id}/reject
  - Body: { reason: str }
  - Sets status to 'rejected'
  - Stores rejection_reason on product
  - Creates audit log entry: action='product_rejected'
  - Sends vendor notification
```

**File to create:** `backend/app/admin_api/products/__init__.py`

**File to modify:** `backend/app/main.py` — register admin products router

#### 3.7.3 Frontend

**File to modify:** `frontend/src/pages/admin/ProductsManagement.jsx`

Add "Pending Review" filter tab. When selected, shows products with `status='pending_review'`.
Add "Approve" and "Reject" action buttons on pending products.
Rejection shows a modal to enter rejection reason.

**Impact on vendor frontend:** Vendors see their submitted product with `status: 'pending_review'` label. No changes to vendor pages needed.

---

### M4-M8 — Admin User Management

**Objective:** Production-grade RBAC for multiple admin team members.

#### 3.8.1 Database Design

**New SQLite table:** `admin_roles`

```sql
CREATE TABLE admin_roles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  role_level   VARCHAR(50) NOT NULL DEFAULT 'admin',
  -- role_level: super_admin | admin | moderator | support | finance | marketing | analyst
  permissions  TEXT,        -- JSON array of explicit permission strings
  invited_by   INTEGER REFERENCES users(id),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  activated_at DATETIME,
  deactivated_at DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**New SQLite table:** `admin_invitations`

```sql
CREATE TABLE admin_invitations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       VARCHAR(255) NOT NULL,
  role_level  VARCHAR(50) NOT NULL DEFAULT 'admin',
  invite_token VARCHAR(128) UNIQUE NOT NULL,
  invited_by  INTEGER REFERENCES users(id),
  expires_at  DATETIME NOT NULL,
  accepted_at DATETIME,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**New SQLAlchemy models:**
- `backend/app/models/admin_role.py`
- `backend/app/models/admin_invitation.py`

#### 3.8.2 Permission System Design

**File to create:** `backend/app/core/permissions.py`

```python
ROLE_PERMISSIONS = {
    "super_admin": ["*"],  # all permissions
    "admin": [
        "read:*", "write:products", "write:orders", "write:reviews",
        "write:reports", "write:support", "write:vendors", "write:affiliates",
        "write:referral_links", "write:platform_settings", "read:analytics",
        "write:audit_logs_read",
    ],
    "moderator": ["read:*", "write:reviews", "write:reports", "write:support"],
    "support": ["read:support", "write:support", "read:customers"],
    "finance": ["read:orders", "read:payments", "read:analytics", "read:reports"],
    "marketing": ["read:products", "write:products_limited", "read:analytics", "write:referral_links"],
    "analyst": ["read:analytics", "read:reports", "read:audit_logs"],
}

def require_permission(permission: str):
    """FastAPI dependency factory for permission-based route protection."""
    def checker(current_user: User = Depends(get_current_user_required), db = Depends(get_db)):
        role_record = db.query(AdminRole).filter(AdminRole.user_id == current_user.id, AdminRole.is_active == True).first()
        if not role_record:
            raise HTTPException(403, "Admin role not found")
        perms = ROLE_PERMISSIONS.get(role_record.role_level, [])
        if "*" in perms or permission in perms:
            return current_user
        raise HTTPException(403, f"Permission denied: {permission} required")
    return checker
```

#### 3.8.3 Backend API

**File to create:** `backend/app/admin_api/admin_users/routes.py`

```
GET  /api/admin/team                    — list all admin team members
POST /api/admin/team/invite             — send invitation (email + role_level)
POST /api/admin/team/{user_id}/activate — activate invited admin
POST /api/admin/team/{user_id}/deactivate — deactivate admin (session revoked)
PUT  /api/admin/team/{user_id}/role     — change role level
GET  /api/admin/team/invitations        — list pending invitations
DELETE /api/admin/team/invitations/{id} — cancel invitation
```

All protected by `require_permission("write:admin_team")` (only super_admin).

#### 3.8.4 Frontend

**New file:** `frontend/src/pages/admin/AdminUserManagement.jsx`
- Team members table: name, email, role, status, last active, actions
- Invite modal: email + role selector
- Pending invitations list
- Deactivate confirmation dialog

**File to modify:** `frontend/src/pages/admin/components/AdminSidebar.jsx`
- Add "Team Management" nav item under Settings group (visible only to super_admin)

**File to modify:** `frontend/src/App.jsx`
- Add lazy import and route `/admin/team` with `requiredRole="admin"`

#### 3.8.5 Invitation Workflow

```
1. Super admin enters email + role in invite modal
2. POST /api/admin/team/invite → generates UUID invite token, stores in admin_invitations
3. Email sent to invitee (for now: token displayed in UI, email integration is future work)
4. Invitee visits /admin/accept-invite?token=XXX
5. If not registered: redirect to /auth/register?role=admin&invite_token=XXX
6. On registration/login: POST /api/admin/team/activate with token
7. Admin user activated, role assigned, audit log entry created
```

**New page:** `frontend/src/pages/admin/AcceptInvite.jsx`

---

## 4. Firestore Rules Changes

**M4-M4 (Contact form):**
```
match /reports/{reportId} {
  // already exists — no change needed
  // contact_request category will use same rules as reports
}
```

**M4-M5 (Report lifecycle):**
No new rules needed. Customer reads via authenticated `/api/reports/me` which uses Firebase Admin SDK server-side.

**M4-M7 (Product approval):**
```
match /products/{productId} {
  // existing rule allows vendor create + admin write
  // no change needed
}
```

---

## 5. Protected Systems Impact Matrix

| System | M4-M1 | M4-M2 | M4-M3 | M4-M4 | M4-M5 | M4-M6 | M4-M7 | M4-M8 |
|---|---|---|---|---|---|---|---|---|
| Customer auth | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe |
| Vendor auth | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ⚠️ products_router modified | ✅ Safe |
| Affiliate auth | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe |
| Google OAuth | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe |
| JWT | ⚠️ Secret strengthened | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe |
| ProtectedRoute | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe |
| Checkout | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe |
| Orders/Payments | ✅ Safe | ⚠️ orders/routes.py + audit only | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe |
| Marketplace | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ⚠️ New pending_review status | ✅ Safe |
| MessagesCenter | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe |
| messages_router.py | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe | ✅ Safe |

### M4-M7 Impact on products_router.py

**Controlled change:** Only the default status of vendor-created products changes from `'published'` to `'pending_review'`. This change affects:
- New products created by vendors after M4-M7 is deployed
- Existing published products are unaffected
- Admin-created products are unaffected (admins self-publish)
- Customer marketplace: only shows `status='published'` (AppContext filter already in place via P3-M2)

**Risk level:** LOW — existing marketplace unaffected, existing products unaffected, only new vendor submissions require approval.

---

## 6. Performance Design Considerations

- Notification counts endpoint: cache result for 30 seconds server-side to avoid hammering Firestore on every sidebar render
- Admin user management: `admin_roles` table is small (< 100 rows) — no indexing concern
- Product approval queue: standard paginated query with `status='pending_review'` filter — existing SQLite index on `status`
- Analytics growth computation: compare two date-range queries — acceptable latency for on-demand analytics

---

## 7. Rollback Strategy Per Milestone

| Milestone | Rollback |
|---|---|
| M4-M1 | Revert env var handling; restore `allow_origins=["*"]`; undo gitignore change |
| M4-M2 | Remove `log_admin_action()` calls — no data is deleted |
| M4-M3 | Revert analytics/services.py — hardcoded values restored |
| M4-M4 | Remove contact_router.py registration from main.py; revert Contact.jsx |
| M4-M5 | Revert Dashboard.jsx; remove `resolution_note` from resolve endpoint |
| M4-M6 | Remove notifications router from main.py; remove badge from sidebar |
| M4-M7 | Revert products_router.py status default; remove admin products router |
| M4-M8 | Remove admin_users router; admin_roles/invitations tables can be dropped |
