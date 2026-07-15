# Requirements Document

## Introduction

The Lumora Admin Platform has a functioning skeleton for team management and admin invitations — endpoints exist, the invitation acceptance flow is architecturally correct, and basic team/invitation tables are displayed in the UI. However, ten verified gaps prevent this feature from being considered production-ready. This spec covers only the **missing or incomplete** capabilities; it explicitly excludes the parts that already work (Firebase → backend JWT authentication, the `POST /api/admin/team/invite` endpoint, the `GET /api/admin/team/invitations/verify` endpoint, the `POST /api/admin/team/accept-invite` endpoint, the `AcceptInvite.jsx` flow, `Register.jsx` admin invite support, `Login.jsx` `?next=` redirect, and the existing team/invitation tables in `AdminUserManagement.jsx`).

The system under spec is the **Lumora Admin Team Management & Invitation System**, a React + FastAPI + SQLite application. The frontend is served separately from the backend; invitation links must work from any browser without requiring access to source code.

---

## Glossary

- **Admin_Platform**: The Lumora backend FastAPI application serving `/api/admin/*` routes.
- **Team_UI**: The `AdminUserManagement.jsx` React page and its child components.
- **Invitation**: An `AdminInvitation` SQLite record created by a `super_admin`, identified by a 48-character UUID token with a 48-hour expiry.
- **Invitation_Token**: The UUID string stored in `AdminInvitation.invite_token`, embedded in the accept-invite URL.
- **SMTP_Service**: The email delivery integration (e.g. SendGrid, AWS SES, or SMTP relay) configured via environment variables.
- **RBAC_System**: The role-based access control defined in `backend/app/core/permissions.py` mapping role levels to permission strings.
- **Role_Level**: One of `super_admin`, `admin`, `moderator`, `support`, `finance`, `marketing`, `analyst` stored in `AdminRole.role_level`.
- **Permission_String**: A string in the format `action:resource` (e.g. `read:analytics`, `write:products`) or `*` for all permissions, as defined in `ROLE_PERMISSIONS`.
- **Admin_Sidebar**: The navigation component rendered by `AdminLayout` that presents menu items to the authenticated admin user.
- **Firestore_Listener**: A real-time Firestore `onSnapshot` subscription that pushes document changes to a React component without polling.
- **Audit_Log**: A record written by `log_admin_action()` in `audit_log_service.py` to the `audit_logs` SQLite table.
- **Invited_Name**: The display name optionally provided by the inviting admin at the time the invitation is created, stored alongside the invitation record.
- **Revoked_Invitation**: An invitation that a `super_admin` has explicitly cancelled; it carries a `revoked_at` timestamp and a `revoked` status rather than being deleted from the database.
- **Last_Login_At**: A dedicated timestamp column on the `users` table recording the most recent successful admin login.
- **Notification_Banner**: A transient in-app banner displayed to `super_admin` users when a team member accepts an invitation.

---

## Requirements

---

### Requirement 1: Email Delivery of Invitation Links

**User Story:** As a `super_admin`, I want invitation links sent directly to the invitee's email address, so that I do not need to manually copy and share a URL through a separate channel.

#### Acceptance Criteria

1. WHEN a `super_admin` submits the invite form, THE Admin_Platform SHALL send a transactional email to the `InviteRequest.email` address containing the accept-invite URL.
2. THE Admin_Platform SHALL send the invitation email within 10 seconds of the `POST /api/admin/team/invite` request completing successfully.
3. IF the SMTP_Service returns a delivery error, THEN THE Admin_Platform SHALL log the error and return an HTTP 500 response with the message `"Invitation created but email delivery failed."` — the invitation record SHALL still be committed to the database.
4. THE Admin_Platform SHALL use an email template that includes: the invitee's name (if provided), the `Role_Level` being granted, the accept-invite URL, and the expiry time formatted as a human-readable local date/time string.
5. WHERE the `SMTP_ENABLED` environment variable is set to `false`, THE Admin_Platform SHALL skip email delivery and return the `accept_url` in the API response body only (current behaviour preserved for local development).
6. THE Team_UI SHALL display the generated `accept_url` in the invite-success panel regardless of whether SMTP is enabled, so that admins can always copy the link manually.

---

### Requirement 2: Resend Invitation

**User Story:** As a `super_admin`, I want to resend or renew an expired or pending invitation, so that an invitee who missed the link or whose link expired can receive a fresh one without me creating a duplicate record.

#### Acceptance Criteria

1. WHEN a `super_admin` requests `POST /api/admin/team/invitations/{invitation_id}/resend`, THE Admin_Platform SHALL generate a new `Invitation_Token`, set a new `expires_at` of 48 hours from the current time, update the existing `AdminInvitation` record, and trigger email delivery as defined in Requirement 1.
2. THE Admin_Platform SHALL accept a resend request only if the invitation's current `status` is `pending` or `expired`; IF the invitation `status` is `accepted` or `revoked`, THEN THE Admin_Platform SHALL return HTTP 400 with the message `"Cannot resend an accepted or revoked invitation."`.
3. THE Team_UI SHALL render a **Resend** button in the Actions column of the Invitation History table for every invitation whose status is `pending` or `expired`.
4. WHEN a `super_admin` clicks the **Resend** button, THE Team_UI SHALL call `POST /api/admin/team/invitations/{invitation_id}/resend` and display a success toast message `"Invitation resent to {email}"` upon a 200 response.
5. THE Admin_Platform SHALL log an `Audit_Log` entry with `action = "admin_invitation_resent"` on every successful resend, recording the `invitation_id`, `email`, and new `expires_at` in the metadata.

---

### Requirement 3: Invitation Revocation

**User Story:** As a `super_admin`, I want to explicitly revoke a pending invitation (rather than hard-deleting it), so that the audit history is preserved and the invitee's link becomes immediately invalid.

#### Acceptance Criteria

1. WHEN a `super_admin` requests `DELETE /api/admin/team/invitations/{invitation_id}`, THE Admin_Platform SHALL set `AdminInvitation.revoked_at` to the current UTC timestamp instead of deleting the row.
2. THE Admin_Platform SHALL add a `revoked_at` column (`DateTime`, nullable) to the `admin_invitations` table via a database migration.
3. WHEN the `GET /team/invitations/verify` endpoint is called with a token whose `revoked_at` is non-null, THE Admin_Platform SHALL return HTTP 400 with the message `"This invitation has been revoked."`.
4. THE Admin_Platform SHALL compute invitation `status` as `revoked` when `revoked_at IS NOT NULL`, superseding the `pending`/`expired` calculation.
5. THE Team_UI SHALL display `revoked` status with a distinct visual style (grey badge) in the Invitation History table.
6. THE Admin_Platform SHALL log an `Audit_Log` entry with `action = "admin_invitation_revoked"` on every successful revocation, recording the `invitation_id` and `email`.

---

### Requirement 4: Frontend RBAC — Permission-Gated Sidebar and Routes

**User Story:** As a `super_admin`, I want the Admin Sidebar and protected routes to show only the sections each admin's role permits, so that lower-privilege admins cannot see or access pages their `Permission_String` set does not cover.

#### Acceptance Criteria

1. THE Team_UI SHALL resolve the authenticated admin's `Role_Level` from the backend JWT or a `/api/admin/me` response and expose it via a React context available to all admin pages.
2. WHEN rendering the Admin_Sidebar, THE Team_UI SHALL display a menu item only if the authenticated admin's `Role_Level` has at least one `Permission_String` matching that section (using the same prefix-wildcard logic as `_has_permission()` in `permissions.py`).
3. WHILE an admin user's `Role_Level` is `support` or `analyst`, THE Team_UI SHALL NOT render the Team Management or Platform Settings menu items in the Admin_Sidebar.
4. WHEN an admin navigates directly to a URL for a section their `Role_Level` cannot access, THE Team_UI SHALL redirect them to `/admin/dashboard` and display a toast with the message `"You do not have permission to access that page."`.
5. THE Admin_Platform SHALL expose `GET /api/admin/me` returning `{ user_id, email, name, role_level, permissions[] }` so the frontend can resolve permissions without embedding them in the JWT.
6. IF the `GET /api/admin/me` request returns HTTP 401 or 403, THEN THE Team_UI SHALL clear the admin session and redirect the user to `/admin/login`.

---

### Requirement 5: Real-Time Team Updates via Firestore

**User Story:** As a `super_admin`, I want the Team Management page to update automatically when a team member accepts an invitation or is deactivated, so that I do not need to manually refresh the browser.

#### Acceptance Criteria

1. THE Admin_Platform SHALL write a Firestore document at path `admin/team/members/{user_id}` with fields `{ user_id, name, email, role_level, is_active, activated_at }` whenever an `AdminRole` record is created, updated, or deactivated.
2. THE Team_UI SHALL establish a Firestore_Listener on the `admin/team/members` collection when the Team Management page mounts, and SHALL update the active team table reactively without a full page refresh.
3. THE Admin_Platform SHALL write a Firestore document at path `admin/team/invitations/{invitation_id}` with fields `{ id, email, role_level, status, expires_at, accepted_at, revoked_at }` whenever an `AdminInvitation` record changes status.
4. THE Team_UI SHALL establish a Firestore_Listener on the `admin/team/invitations` collection and SHALL update the Invitation History table reactively.
5. WHEN the Firestore_Listener connection is lost, THE Team_UI SHALL display a non-blocking warning banner `"Live updates paused — reconnecting…"` and fall back to a polling interval of 30 seconds.
6. WHEN the Firestore_Listener reconnects, THE Team_UI SHALL remove the warning banner and resume reactive updates.

---

### Requirement 6: Invitation-Specific Audit Log View

**User Story:** As a `super_admin`, I want to see an audit trail of all invitation-related actions on the Team Management page, so that I can review who invited whom, when invitations were resent or revoked, and when roles were changed.

#### Acceptance Criteria

1. THE Admin_Platform SHALL expose `GET /api/admin/team/audit-log?limit=50&offset=0` returning `Audit_Log` entries filtered to `target_type IN ('invitation', 'user')` with `action` values from the team management domain (`admin_invited`, `admin_invite_accepted`, `admin_invitation_resent`, `admin_invitation_revoked`, `admin_deactivated`, `admin_role_changed`).
2. THE Team_UI SHALL render an **Audit Log** section below the Invitation History table on the Team Management page, displaying: timestamp, acting admin name/email, action label, target email, and any relevant metadata fields (old role → new role, new expiry date).
3. WHEN the **Audit Log** section contains more than 50 entries, THE Team_UI SHALL render a **Load More** button that fetches the next page using the `offset` query parameter.
4. THE Admin_Platform SHALL return audit log entries in descending `created_at` order.
5. WHILE the `Role_Level` of the authenticated admin is `analyst`, THE Admin_Platform SHALL allow read access to the audit log endpoint (consistent with the `read:audit_logs` permission in `ROLE_PERMISSIONS`).

---

### Requirement 7: In-App Notification on Invitation Acceptance

**User Story:** As a `super_admin`, I want to see an in-app notification when a team member accepts their invitation, so that I know the onboarding completed without checking the team table.

#### Acceptance Criteria

1. WHEN `POST /api/admin/team/accept-invite` completes successfully, THE Admin_Platform SHALL write a Firestore document at path `admin/notifications/{notification_id}` with fields `{ type: "invite_accepted", actor_email, actor_name, role_level, invitation_id, created_at, read: false }`.
2. THE Team_UI SHALL establish a Firestore_Listener on `admin/notifications` filtered to `read == false` and SHALL display each unread notification as a Notification_Banner in the Admin_Platform header.
3. THE Team_UI SHALL display the Notification_Banner with the message: `"{actor_name} ({actor_email}) accepted their invitation and joined as {role_level}."`.
4. WHEN a `super_admin` clicks the Notification_Banner or a dismiss button, THE Team_UI SHALL update the Firestore document's `read` field to `true` and remove the banner.
5. THE Team_UI SHALL display the count of unread notifications as a badge on the Team Management navigation item in the Admin_Sidebar.
6. IF the authenticated admin's `Role_Level` is not `super_admin`, THEN THE Team_UI SHALL NOT display invitation-acceptance notifications.

---

### Requirement 8: Optional Message and Invited Name Fields on Invitation

**User Story:** As a `super_admin`, I want to include the invitee's name and an optional personal message when creating an invitation, so that the invitation email feels personal and the team list shows a meaningful name immediately.

#### Acceptance Criteria

1. THE Admin_Platform SHALL add `invited_name` (`String(150)`, nullable) and `message` (`Text`, nullable) columns to the `admin_invitations` table via a database migration.
2. THE Admin_Platform SHALL accept `invited_name` and `message` as optional fields in the `InviteRequest` Pydantic schema for `POST /api/admin/team/invite`.
3. WHEN `invited_name` is provided in the invitation, THE Admin_Platform SHALL include it in the invitation email template as the recipient's greeting name.
4. WHEN `invited_name` is provided, THE Admin_Platform SHALL store it in the `AdminInvitation` record and return it in the `GET /team/invitations` response payload.
5. THE Team_UI invite modal SHALL include an optional **Name** text input (max 150 characters) and an optional **Personal message** textarea (max 300 characters) in addition to the existing email and role fields.
6. THE Team_UI SHALL display the `invited_name` value (when present) in the Email column of the Invitation History table as a sub-label beneath the email address.
7. WHERE `message` is non-empty, THE Admin_Platform SHALL include it in the invitation email template in a visually distinct quoted block.

---

### Requirement 9: Last Login Tracking for Team Members

**User Story:** As a `super_admin`, I want to see when each team member last logged in to the Admin Portal, so that I can identify inactive admin accounts.

#### Acceptance Criteria

1. THE Admin_Platform SHALL add a `last_login_at` column (`DateTime`, nullable) to the `users` table via a database migration.
2. WHEN `POST /api/admin/auth/login` completes successfully and issues an admin JWT, THE Admin_Platform SHALL set `User.last_login_at` to the current UTC timestamp.
3. THE `GET /api/admin/team` endpoint response SHALL include a `last_login_at` field (ISO 8601 string or `null`) for each team member.
4. THE Team_UI SHALL render a **Last Login** column in the Active Team Members table displaying the `last_login_at` value formatted as a relative time string (e.g. "3 days ago") when available, or `"Never"` when `null`.
5. THE Team_UI SHALL sort the Active Team Members table by `last_login_at` descending by default, with `null` values appearing last.

---

### Requirement 10: Role Change Confirmation UX

**User Story:** As a `super_admin`, I want a clear, role-aware confirmation dialog before a role change is applied, so that I cannot accidentally demote a co-admin without an explicit review step.

#### Acceptance Criteria

1. WHEN a `super_admin` selects a new value in the role dropdown for a team member, THE Team_UI SHALL open a confirmation modal that displays the member's name, their current role, and the target role.
2. THE Team_UI confirmation modal SHALL include a plain-language description of the key permissions granted by the target `Role_Level`, derived from `ROLE_PERMISSIONS` in `permissions.py`.
3. WHEN the target `Role_Level` is lower-privilege than the current role (e.g. demoting from `admin` to `support`), THE Team_UI SHALL add a prominent warning sentence: `"This will reduce their access. Confirm only if intentional."`.
4. WHEN a `super_admin` confirms the role change, THE Team_UI SHALL call `PUT /api/admin/team/{user_id}/role` and display a success toast `"Role updated to {new_role}."` on a 200 response.
5. WHEN a `super_admin` dismisses the confirmation modal without confirming, THE Team_UI SHALL reset the role dropdown to the member's current role without making an API call.
6. THE Team_UI SHALL prevent a `super_admin` from changing their own role via the team table; the role dropdown SHALL be disabled for the authenticated user's own row.

---

### Requirement 11: Invitation Link Delivery Channel (Non-Email Fallback)

**User Story:** As a `super_admin`, I want the accept URL always visible in the Admin UI regardless of email delivery status, so that I can share it manually if the invitee did not receive the email.

#### Acceptance Criteria

1. THE Team_UI invite-success panel SHALL always display the `accept_url` in a copyable code block after a successful `POST /api/admin/team/invite` response, independent of `SMTP_ENABLED` state.
2. THE Team_UI Invitation History table SHALL include a **Copy Link** icon button in the Actions column for every invitation whose `status` is `pending`; clicking it SHALL copy the reconstructed `accept_url` to the clipboard.
3. THE reconstructed `accept_url` SHALL be derived from the pattern `{VITE_FRONTEND_URL}/admin/accept-invite?token={invite_token}` using the token already stored in the invitation record.
4. THE Team_UI SHALL display a transient toast `"Link copied to clipboard"` for 3 seconds after a successful clipboard write.
5. IF the browser does not support the Clipboard API, THEN THE Team_UI SHALL fall back to displaying the URL in a selectable text input with a `"Select all"` affordance.
