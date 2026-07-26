# Lumora Admin Subsystem — Production Go-Live & Migration Runbook

## Scope & Purpose
Step-by-step operational runbook for executing zero-downtime deployment of `v1.1-email-persistence` on production hosting (Render / PostgreSQL / Firebase / Gmail SMTP).

---

## 📋 Pre-Deployment Checklist

1. [ ] **Environment Variables Verification**:
   - `DATABASE_URL` ➔ Verified PostgreSQL production connection string.
   - `JWT_SECRET_KEY` ➔ Verified signed secret key (>= 32 characters).
   - `SMTP_USER` & `SMTP_PASSWORD` ➔ Verified active Gmail App Password credentials.
   - `FIREBASE_SERVICE_ACCOUNT_JSON` ➔ Verified production Firebase Admin SDK JSON path.
   - `ADMIN_FRONTEND_URL` ➔ Verified `https://admin.lumora.design`.
2. [ ] **Database Pre-Flight Check**:
   - Run `python backend/scripts/phase_c_staging_config_check.py`.

---

## 🚀 Step-by-Step Go-Live Deployment Execution

### Step 1: Database DDL Upgrade Migration
Execute SQL DDL script against production PostgreSQL database:
```bash
psql $DATABASE_URL -f backend/migrations/phase_b5_email_persistence.sql
```

### Step 2: Backend API Service Deployment (Render)
1. Deploy main backend service to Render instance.
2. Confirm startup logs display:
   `[Step 7/7] Validating SMTP Email Infrastructure on Startup...`
   `[email_startup_validation] status=READY`

### Step 3: Admin SPA App Build & CDN Deployment
1. Build admin app bundle:
   ```bash
   cd admin-app
   npm run build
   ```
2. Upload `dist/` artifacts to production static host / Cloudflare Pages / Vercel.

### Step 4: Smoke Test Verification Suite
Run live deliverability smoke test script:
```bash
python backend/scripts/live_smtp_deliverability_test.py admin_smoke_test@lumora.design
```

---

## ↺ Immediate Rollback Runbook (Plan B)

If unexpected issues occur post-deployment:

1. **Revert Frontend**: Re-point static host CDN to previous stable commit.
2. **Revert Backend API**: Trigger Render Instant Rollback to previous deployment build.
3. **Database Schema Rollback**:
   ```sql
   DROP TABLE IF EXISTS admin_email_logs CASCADE;
   ALTER TABLE admin_invitations DROP COLUMN IF EXISTS resend_count;
   ALTER TABLE admin_invitations DROP COLUMN IF EXISTS first_sent_at;
   ALTER TABLE admin_invitations DROP COLUMN IF EXISTS last_attempt_at;
   ALTER TABLE admin_invitations DROP COLUMN IF EXISTS next_retry_at;
   ALTER TABLE admin_invitations DROP COLUMN IF EXISTS provider;
   ```
