# Lumora Admin Disaster Recovery, Operational Hardening & Recovery Procedures

## 1. Render Cold Boot / Restart Recovery
- All authentication token claims and permissions are persisted in PostgreSQL/SQLite and verified statelessly via signed JWTs.
- Following a Render instance restart, active admin sessions remain valid until token expiration.
- Database connections automatically reconnect via SQLAlchemy pool management.

## 2. Provider Failover Chain Operations
- Transport delivery is managed by `FailoverEmailProvider`, which attempts delivery in sequence:
  `Primary (Gmail SMTP)` ➔ `Secondary (SendGrid / Resend API)` ➔ `Tertiary (Mock / Fallback)`.
- If the primary provider experiences a transport or auth error, the system logs a structured `email_provider_failover` warning and immediately attempts delivery via the next provider in the chain.

## 3. Dead Letter Queue (DLQ) Recovery
- If all providers in the failover chain fail across all exponential retries, the email event is committed to `AdminEmailLog` under event type `DEAD_LETTER_QUEUE`.
- **Inspection**: Super admins can view all dead-lettered email jobs via:
  `GET /api/admin/team/email-dlq`
- **Re-queueing**: Dead-lettered jobs can be manually re-queued without generating new user tokens via:
  `POST /api/admin/team/email-dlq/{log_id}/retry`

## 4. DDL Database Migration Rollback Procedure
- SQL DDL migration scripts are located in `backend/migrations/phase_b5_email_persistence.sql`.
- **Upgrade Execution**:
  ```bash
  psql -U $DB_USER -d $DB_NAME -f backend/migrations/phase_b5_email_persistence.sql
  ```
- **Rollback Execution**:
  ```sql
  DROP TABLE IF EXISTS admin_email_logs CASCADE;
  ALTER TABLE admin_invitations DROP COLUMN IF EXISTS resend_count;
  ALTER TABLE admin_invitations DROP COLUMN IF EXISTS first_sent_at;
  ALTER TABLE admin_invitations DROP COLUMN IF EXISTS last_attempt_at;
  ALTER TABLE admin_invitations DROP COLUMN IF EXISTS next_retry_at;
  ALTER TABLE admin_invitations DROP COLUMN IF EXISTS provider;
  ```

## 5. Webhook Integration Points Architecture
- **Inbound Endpoint**: `POST /api/admin/webhooks/email-events`
- Supported Provider Event Mapping:
  - **SendGrid**: `delivered` ➔ `SENT`, `bounce` ➔ `BOUNCED`, `spamreport` ➔ `COMPLAINT`.
  - **Resend**: `email.delivered` ➔ `SENT`, `email.bounced` ➔ `BOUNCED`.
  - **AWS SES**: `Delivery` ➔ `SENT`, `Bounce` ➔ `BOUNCED`, `Complaint` ➔ `COMPLAINT`.
- Every incoming webhook payload is validated using HMAC signature verification (`X-Webhook-Signature`).
