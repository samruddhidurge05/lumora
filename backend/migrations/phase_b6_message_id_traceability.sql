-- Lumora Digital Marketplace - Database DDL Migration
-- Migration: Phase B.6 — Message-ID Traceability Column in admin_email_logs
-- Target: PostgreSQL / SQLite
-- ============================================================

-- UPGRADE MIGRATION DDL
-- ---------------------

-- 1. Add message_id column to admin_email_logs for RFC 5322 Message-ID traceability
ALTER TABLE admin_email_logs ADD COLUMN IF NOT EXISTS message_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS ix_admin_email_logs_message_id ON admin_email_logs(message_id);

-- DOWNGRADE MIGRATION DDL (ROLLBACK INSTRUCTIONS)
-- ------------------------------------------------

-- ALTER TABLE admin_email_logs DROP COLUMN IF EXISTS message_id;
-- DROP INDEX IF EXISTS ix_admin_email_logs_message_id;
