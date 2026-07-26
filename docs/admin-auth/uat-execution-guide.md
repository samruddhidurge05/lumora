# Lumora Admin Subsystem — Human User Acceptance Testing (UAT) Execution Guide

## Scope & Purpose
Detailed manual testing runbook for verifying all 8 admin identity lifecycle transition scenarios once production/staging deployment access becomes available.

---

## 🧪 Scenario Test Matrix & Execution Checklists

---

### Scenario 1: Brand New User Onboarding
- **Preconditions**: Target email `new_admin@lumora.design` has no pre-existing user account in PostgreSQL or Firebase Auth.
- **Test Steps**:
  1. Super Admin navigates to `/admin/team` and fills out "Invite Team Member" form with `email = new_admin@lumora.design` and `role_level = editor`.
  2. Open target email inbox and locate email titled *"You are invited to join the Lumora Admin Team"*.
  3. Click **Accept Invitation** link (`/admin/accept-invite?token=...`).
  4. Complete Firebase registration by providing password and display name.
- **Expected Results**:
  - `AdminInvitation.accepted_at` is set to UTC timestamp.
  - `User` record created with `role = 'admin'`.
  - `AdminRole` record created with `role_level = 'editor'` and `is_active = True`.
  - Firebase JWT issued; browser navigates directly to `/admin/dashboard`.
- **Rollback Steps**: Delete created user row from `users` and `admin_roles` tables; remove Firebase Auth UID.
- **Checklist**:
  - [ ] Invitation email received in inbox
  - [ ] Acceptance URL opens AcceptInvite page
  - [ ] Account creation succeeds
  - [ ] User lands on Admin Dashboard

---

### Scenario 2: Existing Customer Upgrade to Admin
- **Preconditions**: User `customer_john@lumora.design` is an active customer with existing purchase history.
- **Test Steps**:
  1. Super Admin sends invitation to `customer_john@lumora.design` with `role_level = editor`.
  2. Customer clicks invitation link while logged in as customer.
  3. Click **Accept Invitation**.
- **Expected Results**:
  - `User.role` updated from `'customer'` to `'admin'`.
  - `AdminRole` created with `role_level = 'editor'`.
  - Existing customer order history, downloads, and cart contents remain 100% intact.
- **Rollback Steps**: Set `User.role = 'customer'` and delete row from `admin_roles`.
- **Checklist**:
  - [ ] Customer receives email
  - [ ] Acceptance elevates role cleanly
  - [ ] Order history preserved

---

### Scenario 3: Existing Vendor Upgrade to Admin
- **Preconditions**: User `vendor_lisa@lumora.design` has active Vendor dashboard access and product listings.
- **Test Steps**:
  1. Super Admin invites `vendor_lisa@lumora.design` with `role_level = moderator`.
  2. Vendor accepts invitation.
- **Expected Results**:
  - `AdminRole` created with `role_level = 'moderator'`.
  - Vendor product listings, analytics, and payout bank settings remain intact.
- **Rollback Steps**: Delete row from `admin_roles`.
- **Checklist**:
  - [ ] Vendor receives email
  - [ ] AdminRole granted
  - [ ] Vendor listings preserved

---

### Scenario 4: Existing Affiliate Upgrade to Admin
- **Preconditions**: User `affiliate_mark@lumora.design` has active affiliate referral links and tracked clicks.
- **Test Steps**:
  1. Super Admin invites `affiliate_mark@lumora.design` with `role_level = analyst`.
  2. Affiliate accepts invitation.
- **Expected Results**:
  - `AdminRole` created with `role_level = 'analyst'`.
  - Affiliate tracking code, referral click logs, and commission balance remain intact.
- **Rollback Steps**: Delete row from `admin_roles`.
- **Checklist**:
  - [ ] Affiliate receives email
  - [ ] AdminRole granted
  - [ ] Affiliate tracking preserved

---

### Scenario 5: Existing Admin (Active Re-invite)
- **Preconditions**: Target user is already an active Super Admin or team member.
- **Test Steps**:
  1. Super Admin sends invitation link or user clicks an already accepted invitation link.
- **Expected Results**:
  - System detects active admin status and returns clean HTTP 200 message: `"You already have administrator access."`
  - No duplicate database rows created.
- **Rollback Steps**: N/A (Idempotent operation).
- **Checklist**:
  - [ ] Idempotent 200 OK returned
  - [ ] UI displays clean status message

---

### Scenario 6: Wrong Email Acceptance Attempt
- **Preconditions**: User A is logged in (`user_a@lumora.design`), but clicks invitation token issued for User B (`user_b@lumora.design`).
- **Test Steps**:
  1. User A opens User B's invitation URL.
  2. Click **Accept Invitation**.
- **Expected Results**:
  - System blocks transaction with `HTTP 403 Forbidden`.
  - Error message displayed: `"This invitation was sent to user_b@lumora.design. Please sign in with that email address."`
- **Rollback Steps**: N/A (Blocked).
- **Checklist**:
  - [ ] HTTP 403 returned
  - [ ] Privilege escalation prevented

---

### Scenario 7: Expired Invitation Token
- **Preconditions**: Invitation token created > 48 hours ago (`expires_at < CURRENT_TIMESTAMP`).
- **Test Steps**:
  1. User clicks expired invitation link.
- **Expected Results**:
  - System blocks acceptance with `HTTP 400 Bad Request`.
  - Error message: `"Invitation token has expired."`
- **Rollback Steps**: N/A (Blocked).
- **Checklist**:
  - [ ] HTTP 400 returned
  - [ ] Expired token rejected

---

### Scenario 8: Revoked Invitation Token
- **Preconditions**: Super Admin clicked "Revoke" on pending invitation (`revoked_at` is set).
- **Test Steps**:
  1. User clicks revoked invitation link.
- **Expected Results**:
  - System blocks acceptance with `HTTP 400 Bad Request`.
  - Error message: `"This invitation has been revoked."`
- **Rollback Steps**: N/A (Blocked).
- **Checklist**:
  - [ ] HTTP 400 returned
  - [ ] Revoked token rejected
