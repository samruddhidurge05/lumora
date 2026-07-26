-- Lumora Digital Marketplace - Database DDL Migration
-- Migration: Phase B.5 Email Persistence, Audit Logs & Metadata
-- Target: PostgreSQL / SQLite
-- ============================================================

-- UPGRADE MIGRATION DDL
-- ---------------------

-- 1. Create append-only admin_email_logs table
CREATE TABLE IF NOT EXISTS admin_email_logs (
    id SERIAL PRIMARY KEY,
    invitation_id INTEGER NOT NULL REFERENCES admin_invitations(id) ON DELETE CASCADE,
    event VARCHAR(50) NOT NULL,
    job_id VARCHAR(36),
    correlation_id VARCHAR(36),
    recipient VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'gmail_smtp',
    attempt INTEGER NOT NULL DEFAULT 1,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    status_code INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_admin_email_logs_invitation_id ON admin_email_logs(invitation_id);
CREATE INDEX IF NOT EXISTS ix_admin_email_logs_event ON admin_email_logs(event);
CREATE INDEX IF NOT EXISTS ix_admin_email_logs_job_id ON admin_email_logs(job_id);
CREATE INDEX IF NOT EXISTS ix_admin_email_logs_correlation_id ON admin_email_logs(correlation_id);
CREATE INDEX IF NOT EXISTS ix_admin_email_logs_created_at ON admin_email_logs(created_at);

-- 2. Add Phase B metadata tracking columns to admin_invitations
ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS email_status VARCHAR(50) DEFAULT 'email_queued';
ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS email_error_log TEXT;
ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS resend_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS first_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'gmail_smtp';


-- DOWNGRADE MIGRATION DDL (ROLLBACK INSTRUCTIONS)
-- ------------------------------------------------

-- DROP TABLE IF EXISTS admin_email_logs CASCADE;
-- ALTER TABLE admin_invitations DROP COLUMN IF EXISTS resend_count;
-- ALTER TABLE admin_invitations DROP COLUMN IF EXISTS first_sent_at;
-- ALTER TABLE admin_invitations DROP COLUMN IF EXISTS last_attempt_at;
-- ALTER TABLE admin_invitations DROP COLUMN IF EXISTS next_retry_at;
-- ALTER TABLE admin_invitations DROP COLUMN IF EXISTS provider;
