"""
backend/scripts/phase_c_staging_config_check.py
------------------------------------------------
Phase C Staging Pre-Flight Environment & Database Validation Script.
Validates environment variables, database schema readiness, and service account configs.
"""
import logging
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("staging_check")


def run_staging_preflight():
    from app.core.config import settings

    logger.info("=== LUMORA PHASE C STAGING PRE-FLIGHT VALIDATION ===")

    checks = {
        "DATABASE_URL": getattr(settings, "DATABASE_URL", None),
        "JWT_SECRET_KEY": getattr(settings, "JWT_SECRET_KEY", None),
        "ADMIN_FRONTEND_URL": getattr(settings, "ADMIN_FRONTEND_URL", None),
        "EMAIL_PROVIDER": getattr(settings, "EMAIL_PROVIDER", None),
        "SMTP_HOST": getattr(settings, "SMTP_HOST", None),
        "SMTP_PORT": getattr(settings, "SMTP_PORT", None),
    }

    all_ok = True
    for key, val in checks.items():
        if val:
            logger.info("  ✓ %s = %s", key, val if "SECRET" not in key and "PASSWORD" not in key else "******")
        else:
            logger.warning("  ❌ %s is missing or empty!", key)
            all_ok = False

    # Check Database Connection & Table Schema Readiness
    try:
        from app.db.database import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            res = conn.execute(text("SELECT 1")).scalar()
            logger.info("  ✓ PostgreSQL/Database Connection Verified (scalar result = %s)", res)

            # Table existence check
            tables = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table';") if "sqlite" in str(engine.url) else text("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")).fetchall()
            table_names = [t[0] for t in tables]
            logger.info("  ✓ Database Tables Found: %s", ", ".join(table_names))

            required_tables = ["users", "admin_roles", "admin_invitations", "admin_email_logs"]
            for req in required_tables:
                if req in table_names:
                    logger.info("    ✓ Required table '%s' exists", req)
                else:
                    logger.warning("    ❌ Required table '%s' is missing!", req)
                    all_ok = False
    except Exception as db_err:
        logger.error("  ❌ Database connection/schema error: %s", db_err)
        all_ok = False

    if all_ok:
        logger.info("=== STAGING PRE-FLIGHT CHECK PASSED: READY FOR DEPLOYMENT VALIDATION ===")
        return 0
    else:
        logger.warning("=== STAGING PRE-FLIGHT CHECK WARNED: REVIEW MISSING CONFIGS ===")
        return 1


if __name__ == "__main__":
    sys.exit(run_staging_preflight())
