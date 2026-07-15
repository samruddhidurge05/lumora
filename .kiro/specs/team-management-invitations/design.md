# Design Document — Admin Team Management & Invitation System

## Overview

This design covers the eleven production gaps identified in the requirements.
It builds on the existing working skeleton:

- `backend/app/admin_api/admin_users/routes.py` — team/invite API (already has invite, accept-invite, activate, verify, list)
- `backend/app/models/admin_invitation.py` — `AdminInvitation` SQLite model
- `backend/app/models/admin_role.py` — `AdminRole` SQLite model
- `backend/app/core/permissions.py` — `ROLE_PERMISSIONS` dict + `_has_permission()`
- `frontend/src/pages/admin/AdminUserManagement.jsx` — team table + invite modal
- `frontend/src/pages/admin/AcceptInvite.jsx` — invitation acceptance flow
- `frontend/src/pages/admin/components/AdminSidebar.jsx` — sidebar + badge polling
- `backend/app/admin_api/notifications/routes.py` — `/admin/notifications/counts`

No changes are made to admin authentication, vendor, customer, affiliate, marketplace, products, orders, payments, reports, reviews, or analytics.

---

## Architecture Overview

```
super_admin browser
       │
       │  POST /api/admin/team/invite
       ▼
FastAPI (admin_users/routes.py)
       │
       ├── writes AdminInvitation row (SQLite)
       ├── sends email via EmailService (new)
       ├── writes Firestore admin/team/invitations/{id}
       └── returns { accept_url, invite_token, ... }

invitee browser (any browser, no source code needed)
       │
       │  GET /admin/accept-invite?token=TOKEN  (React SPA)
       ▼
AcceptInvite.jsx
       │
       ├── GET /api/admin/team/invitations/verify?token=TOKEN  (public)
       ├── user logs in / registers → regular JWT
       └── POST /api/admin/team/accept-invite  (regular JWT)
              │
              ├── sets user.role = 'admin'
              ├── creates AdminRole
              ├── marks invitation.accepted_at
              ├── writes Firestore admin/team/members/{user_id}
              └── writes Firestore admin/notifications/{id}

AdminUserManagement.jsx
       ├── Firestore_Listener  admin/team/members       → team table
       ├── Firestore_Listener  admin/team/invitations   → invite table
       └── Firestore_Listener  admin/notifications      → header banner

AdminSidebar.jsx
       └── polls /admin/notifications/counts (60s)
              includes team_invites count → badge on "Team Management"
```

---

## Database Changes

### Migration 1 — `admin_invitations` table

Add three columns. Using SQLite `ALTER TABLE ADD COLUMN` (non-destructive, no data loss):

```sql
ALTER TABLE admin_invitations ADD COLUMN revoked_at  DATETIME;
ALTER TABLE admin_invitations ADD COLUMN invited_name VARCHAR(150);
ALTER TABLE admin_invitations ADD COLUMN message     TEXT;
```

**Model change** (`backend/app/models/admin_invitation.py`):

```python
revoked_at   = Column(DateTime, nullable=True)
invited_name = Column(String(150), nullable=True)
message      = Column(Text, nullable=True)
```

### Migration 2 — `users` table

```sql
ALTER TABLE users ADD COLUMN last_login_at DATETIME;
```

**Model change** (`backend/app/models/user.py`):

```python
last_login_at = Column(DateTime, nullable=True)
```

Both migrations run at server startup via a `run_migrations()` helper called from `app/main.py` — no Alembic required (SQLite `ALTER TABLE ADD COLUMN` is idempotent when the column already exists in newer SQLite versions; we guard with `PRAGMA table_info` check).

---

## Backend Changes

### 1. `backend/app/services/email_service.py` (NEW FILE)

Thin wrapper over SMTP / SendGrid. Reads env vars:

```
SMTP_ENABLED=true|false     (default: false for local dev)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<sendgrid_api_key>
SMTP_FROM=noreply@lumora.design
```

```python
def send_invitation_email(
    to_email: str,
    invited_name: str | None,
    role_level: str,
    accept_url: str,
    expires_at: datetime,
    message: str | None = None,
) -> bool:
    """Returns True on success, False on failure. Never raises."""
```

Uses Python `smtplib` + `email.mime` (stdlib, no new dependency).
Template is rendered as a plain-text + HTML multipart message.

When `SMTP_ENABLED=false`: logs the would-be email at DEBUG level and returns `True`.

### 2. `backend/app/admin_api/admin_users/routes.py` — changes

#### `InviteRequest` schema update

```python
class InviteRequest(BaseModel):
    email: str
    role_level: str = "admin"
    invited_name: Optional[str] = None   # NEW — max 150 chars
    message: Optional[str] = None        # NEW — max 300 chars
```

#### `invite_admin` endpoint — additions

After creating `AdminInvitation`:
1. Call `email_service.send_invitation_email(...)` in a background thread (`asyncio.create_task` or `BackgroundTasks`)
2. If email fails → `log_admin_action(..., action="admin_invite_email_failed")` + return 500 with message `"Invitation created but email delivery failed."` (invitation row is already committed)
3. Write Firestore document `admin/team/invitations/{invitation.id}` (see Firestore section)

#### `cancel_invitation` endpoint (DELETE) — change from hard-delete to soft-revoke

```python
# OLD: db.delete(invitation); db.commit()
# NEW:
invitation.revoked_at = datetime.now(timezone.utc)
db.commit()
log_admin_action(..., action="admin_invitation_revoked", ...)
sync_invitation_to_firestore(invitation)
```

#### `verify_invitation` endpoint — revocation check

```python
# Add to filter:
AdminInvitation.revoked_at == None
# Error message when revoked:
# "This invitation has been revoked."
```

#### `accept_invite` endpoint — Firestore writes after commit

After `db.commit()`:
1. Call `sync_team_member_to_firestore(current_user, role_record)`
2. Call `write_admin_notification_to_firestore(current_user, invitation)`

#### NEW: `resend_invitation` endpoint

```
POST /api/admin/team/invitations/{invitation_id}/resend
Auth: require_admin_role + _require_super_admin
```

Logic:
1. Load invitation; check `accepted_at == None` and `revoked_at == None` (otherwise 400)
2. Generate new UUID token, new `expires_at = now + 48h`
3. Update `invitation.invite_token`, `invitation.expires_at`
4. Commit
5. Send email (same as invite_admin)
6. Sync Firestore `admin/team/invitations/{id}`
7. `log_admin_action(..., action="admin_invitation_resent", ...)`

#### NEW: `get_team_audit_log` endpoint

```
GET /api/admin/team/audit-log?limit=50&offset=0
Auth: require_admin_role (analysts allowed — checked via require_permission)
```

```python
TEAM_ACTIONS = {
    "admin_invited", "admin_invite_accepted",
    "admin_invitation_resent", "admin_invitation_revoked",
    "admin_deactivated", "admin_role_changed",
}
query = db.query(AuditLog).filter(
    AuditLog.action.in_(TEAM_ACTIONS)
).order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)
```

Returns `{ items: [...], total: int, limit: int, offset: int }`.

Each item: `{ id, action, admin_user_id, admin_email, target_type, target_id, metadata, ip_address, created_at }` — admin email resolved by join with `users`.

#### NEW: `get_admin_me` endpoint

```
GET /api/admin/me
Auth: require_admin_role
```

```python
role_record = db.query(AdminRole).filter(
    AdminRole.user_id == current_user.id, AdminRole.is_active == True
).first()
role_level = role_record.role_level if role_record else "admin"
permissions = ROLE_PERMISSIONS.get(role_level, [])
return {
    "user_id": current_user.id,
    "email": current_user.email,
    "name": current_user.name,
    "role_level": role_level,
    "permissions": permissions,
}
```

#### `list_team_members` — additions

Include `last_login_at` in response per member.
Sort by `last_login_at DESC NULLS LAST`.

#### `admin_login` in `admin/routes/auth.py` — addition

After successful login, set `user.last_login_at = datetime.now(timezone.utc)` and commit before returning the token.

#### `list_invitations` — `_status()` function update

```python
def _status(inv):
    if inv.revoked_at:
        return "revoked"           # highest priority
    if inv.accepted_at:
        return "accepted"
    if inv.expires_at.replace(tzinfo=timezone.utc) < now:
        return "expired"
    return "pending"
```

Response payload additions: `invited_name`, `revoked_at`.

### 3. `backend/app/admin_api/notifications/routes.py` — addition

`team_invites` count already added (done). The count query:

```python
team_invites = db.query(AdminInvitation).filter(
    AdminInvitation.accepted_at == None,
    AdminInvitation.expires_at > now,
    AdminInvitation.revoked_at == None,
).count()
```

---

## Firestore Document Writes (backend)

All Firestore writes are **best-effort** — wrapped in `try/except`, never block the SQLite commit.

### `sync_team_member_to_firestore(user, role_record)`

```
Path: admin/team/members/{user.id}
Fields: { user_id, name, email, role_level, is_active, activated_at, last_login_at }
```

Called from: `activate_admin`, `accept_invite`, `deactivate_admin`, `change_admin_role`.

### `sync_invitation_to_firestore(invitation)`

```
Path: admin/team/invitations/{invitation.id}
Fields: { id, email, invited_name, role_level, status, expires_at, accepted_at, revoked_at, created_at }
```

Called from: `invite_admin`, `cancel_invitation` (soft-revoke), `resend_invitation`, `accept_invite`.
Status is computed using the same `_status()` logic.

### `write_admin_notification_to_firestore(user, invitation)`

```
Path: admin/notifications/{uuid}
Fields: {
  type: "invite_accepted",
  actor_email: user.email,
  actor_name: user.name,
  role_level: invitation.role_level,
  invitation_id: invitation.id,
  created_at: now.isoformat(),
  read: false
}
```

Called from: `accept_invite` only.

All three helpers live in `backend/admin/firestore/admin_firestore.py`.

---

## Frontend Changes

### 1. `AdminSidebar.jsx` — team badge

The `team_invites` field is now returned by `/admin/notifications/counts`.
Add badge to the `team` nav item (same pattern as `support` and `reports`):

```jsx
{item.id === 'team' && notifCounts.team_invites > 0 && (
  <span style={{
    background: '#7B3FA0', color: '#fff', borderRadius: '10px',
    fontSize: '0.6rem', fontWeight: 800, padding: '1px 6px', minWidth: '18px',
    textAlign: 'center', lineHeight: 1.5
  }}>
    {notifCounts.team_invites}
  </span>
)}
```

Badge appears **immediately on mount** because `fetchCounts()` is called synchronously before `setInterval` in the existing `useEffect`. No interaction required.

### 2. `AdminUserManagement.jsx` — all requirement changes

#### Invite modal additions (Req 8)
- Add `invitedName` state (string, max 150)
- Add `inviteMessage` state (string, max 300)
- Render `<input>` for Name and `<textarea>` for Message below the email/role fields
- Include in the POST body: `invited_name: invitedName, message: inviteMessage`
- Display `invited_name` as sub-label under email in invitation history table

#### Invitation actions (Req 2, 3, 11)
- **Resend** button: shown for `pending` and `expired` status. Calls `POST /admin/team/invitations/{id}/resend`. Shows toast on success.
- **Copy Link** button: shown for `pending` status. Constructs URL from `import.meta.env.VITE_FRONTEND_URL + '/admin/accept-invite?token=' + inv.invite_token`. Uses `navigator.clipboard.writeText()`. Falls back to selectable `<input>` if Clipboard API unavailable. Shows 3s toast.
- **Cancel** button (renamed from current): calls `DELETE /admin/team/invitations/{id}` (now soft-revoke). Shows toast `"Invitation revoked."`.
- Status badge: add `revoked` case → grey badge.

#### Real-time Firestore listeners (Req 5)
Replace manual `fetchData()` REST calls with two Firestore listeners on mount:

```js
// In useEffect on mount:
const unsubTeam = onSnapshot(
  collection(db, 'admin/team/members'),
  snapshot => setTeam(snapshot.docs.map(d => d.data()))
);
const unsubInvites = onSnapshot(
  collection(db, 'admin/team/invitations'),
  snapshot => setInvitations(snapshot.docs.map(d => d.data()))
);
return () => { unsubTeam(); unsubInvites(); };
```

If Firestore is offline: show non-blocking banner `"Live updates paused — reconnecting…"` and fall back to 30s polling via `setInterval(fetchData, 30000)`.

#### Audit log section (Req 6)
Below the invitation history table, add `<TeamAuditLog />` component:
- Fetches `GET /api/admin/team/audit-log?limit=50&offset=0` on mount
- Renders table: Timestamp | Action | Acting Admin | Target | Details
- Load More button: increments offset by 50, appends results

#### Last Login column (Req 9)
Add **Last Login** column to team table. Render using `formatRelativeTime(member.last_login_at)` helper — returns `"Never"` for null, otherwise `"3 days ago"` style string using `Intl.RelativeTimeFormat`. Default sort: `last_login_at` descending, nulls last.

#### Role change modal improvements (Req 10)
Current: dropdown change triggers `setRoleChangeTarget` → modal with just name + new role.

Changes:
1. Modal shows: member name, current role badge, arrow →, new role badge
2. Adds plain-language permission description for the target role (derived from `ROLE_PERMISSIONS` constant duplicated/imported in the frontend)
3. Adds warning sentence when demoting: `"This will reduce their access. Confirm only if intentional."`
4. On dismiss: resets dropdown to `member.role_level` (currently done, keep)
5. Disable own-row dropdown: compare `member.user_id` to `localStorage.getItem('lumora_backend_uid')`

### 3. `AdminSidebar.jsx` + Admin header — notifications (Req 7)

New `AdminNotificationBanner` component rendered inside `AdminLayout` header area:

```jsx
// Firestore listener (super_admin only):
const unsubNotifs = onSnapshot(
  query(collection(db, 'admin/notifications'), where('read', '==', false)),
  snapshot => setUnreadNotifs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
);
```

Renders each unread notification as a banner:
```
"{actor_name} ({actor_email}) accepted their invitation and joined as {role_level}."  [✕]
```

On dismiss: `updateDoc(doc(db, 'admin/notifications', notifId), { read: true })`.

**Only rendered when `role_level === 'super_admin'`** — resolved from `GET /api/admin/me` (cached in `AdminContext`).

The unread count badge on the "Team Management" sidebar item comes from `notifCounts.team_invites` (pending invites) — this is distinct from accepted-invite notifications. The two serve different purposes:
- Badge = pending invites awaiting acceptance (admin needs to follow up)
- Banner = accepted invites (real-time onboarding confirmation)

### 4. `AdminContext` (NEW — `frontend/src/context/AdminContext.jsx`)

Provides `role_level` and `permissions[]` to all admin pages:

```jsx
const AdminContext = createContext(null);

export function AdminContextProvider({ children }) {
  const [adminProfile, setAdminProfile] = useState(null); // { user_id, email, name, role_level, permissions }

  useEffect(() => {
    backendFetch('/admin/me')
      .then(data => setAdminProfile(data))
      .catch(() => {}); // keep null — sidebar shows all items as fallback
  }, []);

  return (
    <AdminContext.Provider value={{ adminProfile }}>
      {children}
    </AdminContext.Provider>
  );
}

export const useAdminContext = () => useContext(AdminContext);
```

Used in:
- `AdminSidebar` — filter nav items by permission
- `AdminNotificationBanner` — check `role_level === 'super_admin'`
- Team table row — disable own-row role dropdown

### 5. `AdminSidebar.jsx` — RBAC-gated nav items (Req 4)

Each nav item gets an optional `requiredPermission` field:

```js
{ id: 'team',     label: 'Team Management',  requiredPermission: 'write:team' },
{ id: 'platform', label: 'Platform Status',  requiredPermission: 'write:platform_settings' },
{ id: 'settings', label: 'Settings',         requiredPermission: 'write:platform_settings' },
{ id: 'audit-logs', label: 'Audit Logs',     requiredPermission: 'read:audit_logs' },
```

Filter logic (mirrors `_has_permission()` from Python):

```js
function hasPermission(permissions, required) {
  if (!required) return true;
  if (permissions.includes('*')) return true;
  if (permissions.includes(required)) return true;
  const prefix = required.split(':')[0];
  return permissions.includes(`${prefix}:*`);
}

// In render:
{group.items
  .filter(item => hasPermission(adminProfile?.permissions ?? ['*'], item.requiredPermission))
  .map(item => ...)}
```

When `adminProfile` is null (still loading): show all items (safe default, server will enforce 403).

Route-level guard: `ProtectedRoute` extended to accept `requiredPermission` prop — if admin lacks it, redirect to `/admin/dashboard` with toast.

---

## Migration Execution Strategy

No Alembic. On server startup, `app/main.py` calls:

```python
def run_schema_migrations(engine):
    """Safe, idempotent ALTER TABLE migrations for SQLite."""
    with engine.connect() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(admin_invitations)"))}
        if 'revoked_at'   not in existing: conn.execute(text("ALTER TABLE admin_invitations ADD COLUMN revoked_at DATETIME"))
        if 'invited_name' not in existing: conn.execute(text("ALTER TABLE admin_invitations ADD COLUMN invited_name VARCHAR(150)"))
        if 'message'      not in existing: conn.execute(text("ALTER TABLE admin_invitations ADD COLUMN message TEXT"))

        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(users)"))}
        if 'last_login_at' not in existing: conn.execute(text("ALTER TABLE users ADD COLUMN last_login_at DATETIME"))
        conn.commit()
```

---

## Files to Create / Modify

### New files
| File | Purpose |
|---|---|
| `backend/app/services/email_service.py` | SMTP email delivery |
| `frontend/src/context/AdminContext.jsx` | Admin profile + permissions context |

### Modified files
| File | Changes |
|---|---|
| `backend/app/models/admin_invitation.py` | Add `revoked_at`, `invited_name`, `message` |
| `backend/app/models/user.py` | Add `last_login_at` |
| `backend/app/main.py` | Call `run_schema_migrations()` on startup |
| `backend/app/admin_api/admin_users/routes.py` | resend, soft-revoke, audit log, admin/me, invitedName/message, Firestore writes, last_login update |
| `backend/admin/routes/auth.py` | Set `user.last_login_at` on successful login |
| `backend/admin/firestore/admin_firestore.py` | Add `sync_team_member_to_firestore`, `sync_invitation_to_firestore`, `write_admin_notification_to_firestore` |
| `backend/app/admin_api/notifications/routes.py` | `team_invites` count (done) |
| `frontend/src/pages/admin/AdminUserManagement.jsx` | Invite modal (name/message), resend/copy/revoke actions, Firestore listeners, audit log section, last login column, role modal improvements |
| `frontend/src/pages/admin/components/AdminSidebar.jsx` | RBAC filter, team badge, AdminContext consumer |
| `frontend/src/App.jsx` | Wrap admin routes in `AdminContextProvider` |

---

## Security Constraints (unchanged from existing)

- Invitation token: UUID4 (128 bits of entropy), single-use, 48h expiry, server-validated
- `accept-invite` endpoint: email guard — only invited email can accept
- `revoked_at` check added to `verify_invitation` — revoked tokens immediately invalid
- `require_admin_role` + `_require_super_admin` guard on all write endpoints
- No permissions embedded in JWT — resolved server-side per request via `GET /admin/me`
- Firestore writes are best-effort; SQLite is the authoritative source of truth

---

## What Is NOT in Scope

- Email open-tracking / click-tracking
- Invitation expiry extension beyond 48h
- Multi-tenant / multi-platform support
- SMS delivery
- Admin 2FA / MFA
- Any change to vendor, customer, affiliate, marketplace, product, order, payment, report, review, or analytics flows
