"""
Lumora Digital Marketplace - FastAPI Application Entry Point
============================================================
Production-hardened startup with:
  ? Fail-fast startup configuration validation
  ? Centralized global exception handlers (no raw tracebacks exposed to client)
  ? Standardized JSON error response envelope
  ? Health-check endpoints  (/health  /ready  /live)
  ? Structured logging configuration
"""
# Load .env variables FIRST - before any module that reads os.getenv() at import time
import os
from pathlib import Path
_env_file = Path(__file__).resolve().parent.parent / ".env"
if _env_file.exists():
    try:
        from dotenv import load_dotenv as _load_dotenv
        _load_dotenv(dotenv_path=str(_env_file), override=True)
    except ImportError:
        pass  # python-dotenv not installed - env vars must be set externally

import sys
import logging
from datetime import datetime

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError, ResponseValidationError

from sqlalchemy.exc import SQLAlchemyError
from slowapi.errors import RateLimitExceeded

from app.db.database import engine
from app.models import Base
from app.middleware.rate_limit import limiter, _rate_limit_handler
from app.core.exceptions import LumoraException

# -- Logging Configuration -----------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
_logger = logging.getLogger("lumora.main")

# -- Import Routers ------------------------------------------------------------
from app.api.auth_router import router as auth_router
from app.api.products_router import router as products_router
from app.api.orders import router as orders_router
from app.api.reviews import router as reviews_router
from app.api.vendors import router as vendors_router
from app.api.wishlist_router import router as wishlist_router
from app.api.cart_router import router as cart_router
from app.api.messages_router import router as messages_router
from app.api.notifications_router import router as notifications_router
from app.api.price_alerts_router import router as price_alerts_router
from app.api.search_router import router as search_router
from app.api.activity_router import router as activity_router
from app.api.history_router import router as history_router
from app.api.versions_router import router as versions_router
from app.api.upload_router import router as upload_router
from app.api.affiliate.routes import router as affiliate_router
from app.admin_api.routes import router as admin_router
from app.admin_api.support.routes import router as admin_support_router
from app.api.payments.routes import router as payments_router
from app.api.reports.routes import router as reports_router
from app.api.support.routes import router as support_router
from app.api.contact_router import router as contact_router
from app.admin_api.notifications.routes import router as admin_notifications_router
from app.admin_api.products.routes import router as admin_products_router
from app.admin_api.admin_users.routes import router as admin_users_router
from app.api.refunds_router import router as refunds_router
from app.api.payout_webhook_router import router as payout_webhook_router

# -- Startup Configuration Validation -----------------------------------------
def _validate_startup_config() -> None:
    """
    Fail-fast validation: checks critical environment variables and services.
    Called once before the app starts serving requests.
    Logs clearly and exits immediately if a required dependency is missing.
    """
    errors = []

    # 1. JWT Secret Key - hard-fail if weak or default
    # The project uses JWT_SECRET_KEY (from app/core/config.py).
    # Exit immediately if the secret is the insecure default or shorter than 32 chars.
    jwt_secret = os.getenv("JWT_SECRET_KEY", "secret")
    if not jwt_secret or jwt_secret == "secret" or len(jwt_secret) < 32:
        errors.append(
            "JWT_SECRET_KEY is too weak. Must be at least 32 random characters "
            "(current length: %d). Set a strong value before starting the server." % (len(jwt_secret) if jwt_secret else 0)
        )

    # 2. Firebase Project ID
    firebase_project = os.getenv("FIREBASE_PROJECT_ID")
    if not firebase_project:
        errors.append("FIREBASE_PROJECT_ID environment variable is missing or empty.")

    # 3. Payment Gateway Configuration
    payment_gateway = os.getenv("PAYMENT_GATEWAY", "mock").lower()
    if payment_gateway == "razorpay":
        rzp_key = os.getenv("RAZORPAY_KEY_ID")
        rzp_secret = os.getenv("RAZORPAY_KEY_SECRET")
        if not rzp_key or not rzp_secret:
            errors.append(
                "PAYMENT_GATEWAY is set to 'razorpay' but RAZORPAY_KEY_ID or "
                "RAZORPAY_KEY_SECRET is missing."
            )

    # 4. Database connection
    try:
        from app.db.database import engine as _engine
        with _engine.connect() as conn:
            conn.execute(__import__("sqlalchemy").text("SELECT 1"))
    except Exception as db_err:
        errors.append(f"Database connection failed: {db_err}")

    # 5. Firebase credentials (non-fatal warning - Firebase connection is optional)
    cert_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if not cert_path:
        base_dir = os.path.dirname(os.path.abspath(__file__)) # backend/app
        path1 = os.path.join(base_dir, "shared", "firebase", "serviceAccountKey.json")
        path2 = os.path.join(os.path.dirname(base_dir), "shared", "firebase", "serviceAccountKey.json")
        if os.path.exists(path1):
            cert_path = path1
        elif os.path.exists(path2):
            cert_path = path2
        else:
            cert_path = path1
    if not os.path.exists(cert_path):
        _logger.warning(
            "[startup] Firebase service account key not found at '%s'. "
            "Firebase-dependent features will be disabled.",
            cert_path,
        )
    else:
        _logger.info("[startup] Firebase credentials file found: %s", cert_path)

    # 6. Storage configuration
    storage_provider = os.getenv("STORAGE_PROVIDER", "local").lower()
    _logger.info("[startup] Storage provider: %s", storage_provider)
    if storage_provider == "firebase":
        from app.services.storage_service import storage_service
        if not storage_service.firebase_provider.is_available():
            errors.append(
                "STORAGE_PROVIDER is set to 'firebase' but Firebase Storage could not "
                "be initialized. Check your credentials and FIREBASE_PROJECT_ID."
            )

    # Fail fast if any critical errors found
    if errors:
        for err in errors:
            _logger.critical("[startup] CONFIGURATION ERROR: %s", err)
        _logger.critical("[startup] Application cannot start. Fix the above errors.")
        sys.exit(1)

    _logger.info("[startup] Configuration validation passed OK")


# Run validation before table creation so we catch DB issues early
_validate_startup_config()

# -- Database Table Creation ---------------------------------------------------
Base.metadata.create_all(bind=engine)

# -- Schema Migrations (idempotent ALTER TABLE for SQLite AND PostgreSQL) --------
def _run_schema_migrations() -> None:
    """
    Safe, idempotent column additions.
    - SQLite : uses PRAGMA table_info() to check before adding
    - PostgreSQL: uses ADD COLUMN IF NOT EXISTS (supported since PG 9.1)
    Never fails if the column already exists.
    """
    from sqlalchemy import text as _text
    dialect = engine.dialect.name

    # -- PostgreSQL migrations (Render production) -----------------------------
    if dialect == "postgresql":
        _logger.info("[startup] Running PostgreSQL schema migrations?")
        pg_migrations = [
            # products - extended metadata columns added after initial deploy
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS pcloud_download_link VARCHAR(512)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls           JSON",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS storage_path         VARCHAR(512)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS thumbnail_path       VARCHAR(512)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS preview_path         VARCHAR(512)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS content_type         VARCHAR(100)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS hash                 VARCHAR(128)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS short_desc           VARCHAR(255)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS features             JSON",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS system_requirements  JSON",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS what_you_get         JSON",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS installation_guide   TEXT",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory          VARCHAR(100)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS discount             FLOAT DEFAULT 0.0",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS preview_images       JSON",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS preview_video        VARCHAR(512)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_title            VARCHAR(150)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_description      TEXT",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS visibility           VARCHAR(50) DEFAULT 'public'",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS affiliate_enabled    BOOLEAN DEFAULT FALSE",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_type      VARCHAR(20) DEFAULT 'percentage'",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_mode      VARCHAR(20) DEFAULT 'percentage'",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_value     FLOAT DEFAULT 0.0",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS affiliate_cookie_days INTEGER DEFAULT 30",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS affiliate_visibility VARCHAR(20) DEFAULT 'public'",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS affiliate_program_status VARCHAR(20) DEFAULT 'active'",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS trending             BOOLEAN DEFAULT FALSE",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS new_arrival          BOOLEAN DEFAULT FALSE",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS badge                VARCHAR(50)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS highlights           JSON",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS license              VARCHAR(50)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS version              VARCHAR(20) DEFAULT 'v1.0.0'",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS file_size            VARCHAR(30)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS last_updated         VARCHAR(50)",
            # admin_invitations
            "ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS revoked_at   TIMESTAMP",
            "ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS invited_name VARCHAR(150)",
            "ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS message      TEXT",
            # users
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP",
            # affiliate_profiles — Phase 2 earnings breakdown
            "ALTER TABLE affiliate_profiles ADD COLUMN IF NOT EXISTS pending_earnings   FLOAT DEFAULT 0.0",
            "ALTER TABLE affiliate_profiles ADD COLUMN IF NOT EXISTS paid_earnings      FLOAT DEFAULT 0.0",
            "ALTER TABLE affiliate_profiles ADD COLUMN IF NOT EXISTS rejected_earnings  FLOAT DEFAULT 0.0",
            "ALTER TABLE affiliate_profiles ADD COLUMN IF NOT EXISTS unique_clicks      INTEGER DEFAULT 0",
            "ALTER TABLE affiliate_profiles ADD COLUMN IF NOT EXISTS avg_order_value    FLOAT DEFAULT 0.0",
            "ALTER TABLE affiliate_profiles ADD COLUMN IF NOT EXISTS last_active_at     TIMESTAMP",
            # affiliate_commissions — Phase 2 full lifecycle fields
            "ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS commission_type  VARCHAR(20) DEFAULT 'percentage'",
            "ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS commission_rate  FLOAT DEFAULT 0.0",
            "ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS customer_name    VARCHAR(255)",
            "ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS customer_email   VARCHAR(255)",
            "ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS cookie_attr_date TIMESTAMP",
            "ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS last_click_at    TIMESTAMP",
            "ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS gateway_tx_id    VARCHAR(255)",
            "ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS commission_status VARCHAR(30) DEFAULT 'pending'",
            "ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS purchase_status  VARCHAR(20) DEFAULT 'completed'",
            "ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS refund_status    VARCHAR(20) DEFAULT 'none'",
            "ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS admin_notes      TEXT",
            "ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS reversed_at      TIMESTAMP",
            "ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS refund_deduction FLOAT DEFAULT 0.0",
            "ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMP",
            "ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS paid_at          TIMESTAMP",
            # product_download_events table creation for PostgreSQL
            "CREATE TABLE IF NOT EXISTS product_download_events (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id), downloaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, ip_address VARCHAR(64), user_agent VARCHAR(512), created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)",
            # affiliate_referrals table creation for PostgreSQL
            "CREATE TABLE IF NOT EXISTS affiliate_referrals (id SERIAL PRIMARY KEY, affiliate_id INTEGER NOT NULL REFERENCES affiliate_profiles(id), referral_code VARCHAR(50) NOT NULL, product_id INTEGER NOT NULL REFERENCES products(id), customer_id INTEGER REFERENCES users(id), session_id VARCHAR(100) NOT NULL UNIQUE, order_id INTEGER REFERENCES orders(id), status VARCHAR(30) NOT NULL DEFAULT 'CLICKED', ip_address VARCHAR(45), user_agent TEXT, clicked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, authenticated_at TIMESTAMP, converted_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        ]

        
        # PostgreSQL primary key sequence resynchronization
        # Fixes duplicate key value violates unique constraint "products_pkey" (Key id=X already exists)
        # when records were previously inserted with explicit IDs during database seeding or migrations.
        pg_sequence_syncs = [
            "SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE((SELECT MAX(id) FROM products), 1))",
            "SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))",
            "SELECT setval(pg_get_serial_sequence('orders', 'id'), COALESCE((SELECT MAX(id) FROM orders), 1))",
            "SELECT setval(pg_get_serial_sequence('order_items', 'id'), COALESCE((SELECT MAX(id) FROM order_items), 1))",
            "SELECT setval(pg_get_serial_sequence('reviews', 'id'), COALESCE((SELECT MAX(id) FROM reviews), 1))",
            "SELECT setval(pg_get_serial_sequence('coupons', 'id'), COALESCE((SELECT MAX(id) FROM coupons), 1))",
            "SELECT setval(pg_get_serial_sequence('payments', 'id'), COALESCE((SELECT MAX(id) FROM payments), 1))",
            "SELECT setval(pg_get_serial_sequence('vendors', 'id'), COALESCE((SELECT MAX(id) FROM vendors), 1))",
            "SELECT setval(pg_get_serial_sequence('wishlist_items', 'id'), COALESCE((SELECT MAX(id) FROM wishlist_items), 1))",
            "SELECT setval(pg_get_serial_sequence('cart_items', 'id'), COALESCE((SELECT MAX(id) FROM cart_items), 1))",
            "SELECT setval(pg_get_serial_sequence('audit_logs', 'id'), COALESCE((SELECT MAX(id) FROM audit_logs), 1))",
            "SELECT setval(pg_get_serial_sequence('product_versions', 'id'), COALESCE((SELECT MAX(id) FROM product_versions), 1))",
            "SELECT setval(pg_get_serial_sequence('product_download_events', 'id'), COALESCE((SELECT MAX(id) FROM product_download_events), 1))",
        ]

        try:
            # Run each DDL statement in its own isolated transaction.
            # PostgreSQL aborts the *entire* transaction on any error, so running
            # all statements in a single connection means one failure (e.g. column
            # already exists in a different form) silently discards ALL subsequent
            # migrations.  Using autocommit=True per statement avoids this.
            failed_migrations = []
            for sql in pg_migrations:
                try:
                    with engine.connect() as conn:
                        conn.execute(_text("COMMIT"))   # ensure no open txn
                        conn.execute(_text(sql))
                        conn.execute(_text("COMMIT"))
                except Exception as col_err:
                    failed_migrations.append((sql.strip()[:60], str(col_err)[:80]))
                    _logger.debug("[startup] PG migration skipped: %s | %s", sql.strip()[:60], col_err)

            # Sequence syncs (SELECT setval — read-only, safe in one txn)
            try:
                with engine.connect() as conn:
                    for seq_sql in pg_sequence_syncs:
                        try:
                            conn.execute(_text(seq_sql))
                        except Exception as seq_err:
                            _logger.debug("[startup] PG sequence sync skipped: %s | %s", seq_sql[:60], seq_err)
                    conn.commit()
            except Exception as seq_exc:
                _logger.debug("[startup] PG sequence sync block failed: %s", seq_exc)

            if failed_migrations:
                _logger.debug("[startup] %d PG migration(s) were skipped (already exist or unsupported): %s",
                              len(failed_migrations), failed_migrations[:3])
            _logger.info("[startup] PostgreSQL schema migrations and sequence sync applied OK")
        except Exception as _mig_err:
            _logger.warning("[startup] PostgreSQL migration warning (non-fatal): %s", _mig_err)
        return

    # -- SQLite migrations (local dev) -----------------------------------------
    if dialect == "sqlite":
        try:
            with engine.connect() as conn:
                # admin_invitations - add revoked_at, invited_name, message
                inv_cols = {row[1] for row in conn.execute(_text("PRAGMA table_info(admin_invitations)"))}
                if "revoked_at"   not in inv_cols: conn.execute(_text("ALTER TABLE admin_invitations ADD COLUMN revoked_at DATETIME"))
                if "invited_name" not in inv_cols: conn.execute(_text("ALTER TABLE admin_invitations ADD COLUMN invited_name VARCHAR(150)"))
                if "message"      not in inv_cols: conn.execute(_text("ALTER TABLE admin_invitations ADD COLUMN message TEXT"))

                # users - add last_login_at
                user_cols = {row[1] for row in conn.execute(_text("PRAGMA table_info(users)"))}
                if "last_login_at" not in user_cols: conn.execute(_text("ALTER TABLE users ADD COLUMN last_login_at DATETIME"))

                # products - extended metadata + affiliate columns
                prod_cols = {row[1] for row in conn.execute(_text("PRAGMA table_info(products)"))}
                prod_additions = [
                    ("pcloud_download_link",   "VARCHAR(512)"),
                    ("image_urls",             "JSON"),
                    ("storage_path",           "VARCHAR(512)"),
                    ("thumbnail_path",         "VARCHAR(512)"),
                    ("preview_path",           "VARCHAR(512)"),
                    ("content_type",           "VARCHAR(100)"),
                    ("hash",                   "VARCHAR(128)"),
                    ("short_desc",             "VARCHAR(255)"),
                    ("features",               "JSON"),
                    ("system_requirements",    "JSON"),
                    ("what_you_get",           "JSON"),
                    ("installation_guide",     "TEXT"),
                    ("subcategory",            "VARCHAR(100)"),
                    ("discount",               "FLOAT DEFAULT 0.0"),
                    ("preview_images",         "JSON"),
                    ("preview_video",          "VARCHAR(512)"),
                    ("seo_title",              "VARCHAR(150)"),
                    ("seo_description",        "TEXT"),
                    ("visibility",             "VARCHAR(50) DEFAULT 'public'"),
                    ("affiliate_enabled",      "BOOLEAN DEFAULT 0"),
                    ("commission_type",        "VARCHAR(20) DEFAULT 'percentage'"),
                    ("commission_mode",        "VARCHAR(20) DEFAULT 'percentage'"),
                    ("commission_value",       "FLOAT DEFAULT 0.0"),
                    ("affiliate_cookie_days",  "INTEGER DEFAULT 30"),
                    ("affiliate_visibility",   "VARCHAR(20) DEFAULT 'public'"),
                    ("affiliate_program_status", "VARCHAR(20) DEFAULT 'active'"),
                    ("trending",               "BOOLEAN DEFAULT 0"),
                    ("new_arrival",            "BOOLEAN DEFAULT 0"),
                    ("badge",                  "VARCHAR(50)"),
                    ("highlights",             "JSON"),
                    ("license",                "VARCHAR(50)"),
                    ("version",                "VARCHAR(20) DEFAULT 'v1.0.0'"),
                    ("file_size",              "VARCHAR(30)"),
                    ("last_updated",           "VARCHAR(50)"),
                ]
                for col_name, col_def in prod_additions:
                    if col_name not in prod_cols:
                        try:
                            conn.execute(_text(f"ALTER TABLE products ADD COLUMN {col_name} {col_def}"))
                            _logger.debug("[startup] SQLite products.%s added OK", col_name)
                        except Exception as _col_err:
                            _logger.debug("[startup] SQLite products.%s skipped: %s", col_name, _col_err)

                # affiliate_profiles — Phase 2 earnings breakdown
                aff_prof_cols = {row[1] for row in conn.execute(_text("PRAGMA table_info(affiliate_profiles)"))}
                aff_prof_additions = [
                    ("display_name",         "VARCHAR(150)"),
                    ("short_bio",            "TEXT"),
                    ("country",              "VARCHAR(100)"),
                    ("youtube",              "VARCHAR(255)"),
                    ("instagram",            "VARCHAR(255)"),
                    ("linkedin",             "VARCHAR(255)"),
                    ("preferred_categories", "JSON"),
                    ("promotion_methods",    "JSON"),
                    ("primary_audience",     "VARCHAR(100)"),
                    ("audience_size",        "VARCHAR(50)"),
                    ("preferred_language",   "VARCHAR(50)"),
                    ("preferred_currency",   "VARCHAR(10)"),
                    ("timezone",             "VARCHAR(50)"),
                    ("email_notifications",  "BOOLEAN DEFAULT 1"),
                    ("pending_earnings",   "FLOAT DEFAULT 0.0"),
                    ("paid_earnings",      "FLOAT DEFAULT 0.0"),
                    ("rejected_earnings",  "FLOAT DEFAULT 0.0"),
                    ("unique_clicks",      "INTEGER DEFAULT 0"),
                    ("avg_order_value",    "FLOAT DEFAULT 0.0"),
                    ("last_active_at",     "DATETIME"),
                ]
                for col_name, col_def in aff_prof_additions:
                    if col_name not in aff_prof_cols:
                        try:
                            conn.execute(_text(f"ALTER TABLE affiliate_profiles ADD COLUMN {col_name} {col_def}"))
                            _logger.debug("[startup] SQLite affiliate_profiles.%s added OK", col_name)
                        except Exception as _col_err:
                            _logger.debug("[startup] SQLite affiliate_profiles.%s skipped: %s", col_name, _col_err)

                # affiliate_commissions — Phase 2 lifecycle fields
                aff_comm_cols = {row[1] for row in conn.execute(_text("PRAGMA table_info(affiliate_commissions)"))}
                aff_comm_additions = [
                    ("commission_type",   "VARCHAR(20) DEFAULT 'percentage'"),
                    ("commission_rate",   "FLOAT DEFAULT 0.0"),
                    ("customer_name",     "VARCHAR(255)"),
                    ("customer_email",    "VARCHAR(255)"),
                    ("cookie_attr_date",  "DATETIME"),
                    ("last_click_at",     "DATETIME"),
                    ("gateway_tx_id",     "VARCHAR(255)"),
                    ("commission_status", "VARCHAR(30) DEFAULT 'pending'"),
                    ("purchase_status",   "VARCHAR(20) DEFAULT 'completed'"),
                    ("refund_status",     "VARCHAR(20) DEFAULT 'none'"),
                    ("admin_notes",       "TEXT"),
                    ("reversed_at",       "DATETIME"),
                    ("refund_deduction",  "FLOAT DEFAULT 0.0"),
                    ("approved_at",       "DATETIME"),
                    ("paid_at",           "DATETIME"),
                ]
                for col_name, col_def in aff_comm_additions:
                    if col_name not in aff_comm_cols:
                        try:
                            conn.execute(_text(f"ALTER TABLE affiliate_commissions ADD COLUMN {col_name} {col_def}"))
                            _logger.debug("[startup] SQLite affiliate_commissions.%s added OK", col_name)
                        except Exception as _col_err:
                            _logger.debug("[startup] SQLite affiliate_commissions.%s skipped: %s", col_name, _col_err)

                conn.commit()
            _logger.info("[startup] SQLite schema migrations applied OK")
        except Exception as _mig_err:
            _logger.warning("[startup] SQLite migration warning (non-fatal): %s", _mig_err)
        return

    _logger.info("[startup] Dialect '%s' - no custom migrations defined, skipping.", dialect)

_run_schema_migrations()



# -- Seed Admin Users ----------------------------------------------------------
from app.db.database import SessionLocal
from app.models.user import User

db_session = SessionLocal()
try:
    admin_email = "avikapawar08@gmail.com"
    admin_user = db_session.query(User).filter(User.email == admin_email).first()
    if not admin_user:
        admin_user = User(
            name="Platform Admin",
            email=admin_email,
            password_hash="firebase_managed",
            role="admin",
            is_active=True,
            is_verified=True,
        )
        db_session.add(admin_user)
        db_session.commit()
        _logger.info("[seed] Admin user created: %s", admin_email)
except Exception as seed_err:
    _logger.error("[seed] Error seeding admin user: %s", seed_err)
finally:
    db_session.close()

# -- FastAPI App ---------------------------------------------------------------
# Re-read DEBUG from .env directly to ensure it's picked up regardless of
# environment variable inheritance order in the uvicorn worker process.
_debug_raw = os.getenv("DEBUG", "False")
if not _debug_raw or _debug_raw == "False":
    # Fall back to reading directly from .env file
    try:
        _env_content = _env_file.read_text(encoding="utf-8") if _env_file.exists() else ""
        for _line in _env_content.splitlines():
            _line = _line.strip()
            if _line.startswith("DEBUG="):
                _debug_raw = _line.split("=", 1)[1].strip()
                break
    except Exception:
        pass
_is_debug = _debug_raw.lower() in ("true", "1")
app = FastAPI(
    title="Lumora Digital Marketplace API",
    description="Backend API for Lumora digital assets marketplace.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

@app.on_event("startup")
def restore_products():
    try:
        from scripts.migrate_affiliate_attribution import run_migration
        run_migration()
    except Exception as mig_err:
        print(f"[startup] Migration hook notice: {mig_err}")

    from app.db.database import SessionLocal
    from app.models.product import Product as ProductModel
    from admin.firestore.admin_firestore import (
        restore_sqlite_products_from_firestore,
        sync_product_to_firestore,
    )
    from app.shared.firebase.connection import db as _fs_db, firebase_connected as _fs_ok

    # Quick Fast Storage Probe
    try:
        from app.services.storage_service import storage_service
        _logger.info("[startup] Fast Storage Health Probe: Backblaze B2 Status = %s (Available: %s)", storage_service.b2_provider.b2_status, storage_service.b2_provider.is_available())
    except Exception as st_err:
        _logger.warning("[startup] Storage health probe notice: %s", st_err)

    db = SessionLocal()
    try:
        # ── Seed guard: only seed if the database is completely empty ──────────
        # On Render (PostgreSQL) the database is never empty after the first deploy.
        # Running seed on a populated database would INSERT placeholder file_urls
        # (e.g. /products/product-{id}.zip) for any product ID that doesn't exist
        # in PostgreSQL yet, which permanently corrupts the file reference.
        #
        # We deliberately count ALL statuses (published + draft + archived) so
        # a product soft-deleted via "archive" doesn't re-trigger seeding.
        existing_count = db.query(ProductModel).count()
        if existing_count == 0:
            try:
                from scripts.seed_products import seed as seed_db_products
                _logger.info("[startup] Empty database detected — running one-time seed from products.json...")
                seed_db_products()
                _logger.info("[startup] One-time seed completed.")
            except Exception as _seed_err:
                _logger.error("[startup] Failed to seed empty database: %s", _seed_err)
        else:
            _logger.info(
                "[startup] Database has %d existing product(s) — skipping seed to protect real data.",
                existing_count,
            )

        # ── Restore: INSERT any Firestore products completely absent from PG ───
        # NOTE: As of 2026-07, this function is safety-hardened to NEVER overwrite
        # existing PostgreSQL records. It only inserts products missing from PG.
        _logger.info("[startup] Checking for products in Firestore missing from PostgreSQL...")
        restore_sqlite_products_from_firestore(db)

        # ── Forward-sync: push any PG products missing from Firestore ──────────
        # This catches products created while Firebase was temporarily offline.
        if _fs_ok and _fs_db is not None:
            try:
                existing_ids = {doc.id for doc in _fs_db.collection("products").stream()}
                all_active = db.query(ProductModel).filter(
                    ProductModel.status.in_(["published", "draft"])
                ).all()
                missing = [p for p in all_active if str(p.id) not in existing_ids]
                if missing:
                    _logger.info(
                        "[startup] Found %d product(s) in PostgreSQL not yet in Firestore — syncing now: %s",
                        len(missing), [p.id for p in missing],
                    )
                    for p in missing:
                        try:
                            sync_product_to_firestore(p)
                        except Exception as _sync_err:
                            _logger.error("[startup] Failed to sync product %s: %s", p.id, _sync_err)
                    _logger.info("[startup] Missing-product forward-sync complete.")
                else:
                    _logger.info("[startup] All PostgreSQL products are already in Firestore.")
            except Exception as _fwd_err:
                _logger.warning("[startup] Forward-sync check failed (non-fatal): %s", _fwd_err)

    except Exception as e:
        _logger.error("[startup] Error running startup products recovery: %s", e)
    finally:
        db.close()


# -- Rate Limiting -------------------------------------------------------------
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

# ?????????????????????????????????????????????????????????????????????????????
# GLOBAL EXCEPTION HANDLERS
# All errors are returned in a consistent JSON envelope:
#
#   { "success": false, "error": { "code": "...", "message": "...", "details": null } }
#
# No raw Python tracebacks, SQLAlchemy errors, or Firebase errors are exposed.
# ?????????????????????????????????????????????????????????????????????????????

@app.exception_handler(LumoraException)
async def lumora_exception_handler(request: Request, exc: LumoraException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": None,
            },
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle Pydantic validation errors - return field-level details without exposing internals."""
    field_errors = []
    for error in exc.errors():
        loc = " -> ".join(str(loc) for loc in error.get("loc", []) if loc != "body")
        field_errors.append(f"{loc}: {error.get('msg', 'Invalid value')}" if loc else error.get("msg", "Validation error"))

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "One or more fields failed validation.",
                "details": field_errors or None,
            },
        },
    )


@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Catch any unhandled SQLAlchemy database error and hide internals from the client."""
    _logger.error("[db_error] Unhandled database error on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    from app.core.config import settings
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "DATABASE_ERROR",
                "message": "A database error occurred. Please try again.",
                "details": str(exc) if getattr(settings, 'DEBUG', False) else str(exc),
            },
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch-all handler - hides raw Python tracebacks from API consumers.
    Logs the full traceback internally for debugging.
    Does NOT intercept HTTPException (FastAPI handles those natively).
    """
    from fastapi import HTTPException as _HTTPEx
    if isinstance(exc, _HTTPEx):
        # Let FastAPI's own HTTPException handler deal with these
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "code": f"HTTP_{exc.status_code}",
                    "message": exc.detail if isinstance(exc.detail, str) else "Request error.",
                    "details": None,
                },
            },
        )

    _logger.error(
        "[unhandled_error] %s %s ? %s: %s",
        request.method, request.url.path, type(exc).__name__, exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred. Please try again later.",
                "details": None,
            },
        },
    )


# -- Exception Handlers --------------------------------------------------------

@app.exception_handler(ResponseValidationError)
async def response_validation_exception_handler(request: Request, exc: ResponseValidationError) -> JSONResponse:
    """Handle response serialization mismatches cleanly with structured error response."""
    _logger.error(
        "[response_validation_error] Response schema mismatch on %s %s: %s",
        request.method, request.url.path, exc, exc_info=True
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "RESPONSE_VALIDATION_ERROR",
                "message": "Response serialization failed due to data schema mismatch.",
                "details": str(exc),
            },
        },
    )


# -- Duplicate API Prefix Fix --------------------------------------------------
@app.middleware("http")
async def fix_duplicate_api_prefix(request: Request, call_next):
    if request.url.path.startswith("/api/api/"):
        request.scope["path"] = request.url.path.replace("/api/api/", "/api/", 1)
    try:
        return await call_next(request)
    except Exception as exc:
        _logger.error("[middleware_error] Exception in fix_duplicate_api_prefix: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred.",
                    "details": str(exc),
                },
            },
        )


# -- Security Headers ----------------------------------------------------------
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    try:
        response = await call_next(request)
    except Exception as exc:
        _logger.error("[middleware_error] Exception in add_security_headers: %s", exc)
        response = JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred.",
                    "details": str(exc),
                },
            },
        )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

    # Allow iframe framing for preview-stream and online inspection endpoints across Lumora Vercel deployments & localhost
    path = request.url.path.lower()
    if "preview" in path or "stream" in path or "download" in path:
        response.headers.pop("X-Frame-Options", None)
        response.headers["Content-Security-Policy"] = "frame-ancestors 'self' https://*.vercel.app https://lumora-lemon-seven.vercel.app http://localhost:* http://127.0.0.1:*;"
    else:
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'self' https://*.vercel.app https://lumora-lemon-seven.vercel.app http://localhost:*;"
    return response


# -- CORS ---------------------------------------------------------------------------
# IMPORTANT: The Vercel production origins below are ALWAYS included as a
# guaranteed baseline - even if the CORS_ORIGINS env var on Render is set to
# an older value that omits them. This prevents stale env vars from silently
# blocking the admin portal.
_GUARANTEED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:3000",
    "https://lumora-admin-nine.vercel.app",
    "https://lumora.vercel.app",
]
_cors_origins_raw = os.getenv("CORS_ORIGINS", "")
_env_origins = [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]
# Merge: guaranteed baseline + any extra origins from env var (deduplicated)
origins = list(dict.fromkeys(_GUARANTEED_ORIGINS + _env_origins))
_cors_regex_raw = os.getenv("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=_cors_regex_raw if _cors_regex_raw else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -- Mount API Routers ---------------------------------------------------------
app.include_router(auth_router,          prefix="/api/auth",         tags=["Auth"])
app.include_router(products_router,      prefix="/api/products",     tags=["Products"])
app.include_router(orders_router,        prefix="/api/orders",       tags=["Orders"])
app.include_router(reviews_router,       prefix="/api/reviews",      tags=["Reviews"])
app.include_router(vendors_router,       prefix="/api/vendors",      tags=["Vendors"])
app.include_router(wishlist_router,      prefix="/api/wishlist",     tags=["Wishlist"])
app.include_router(cart_router,          prefix="/api/cart",         tags=["Cart"])
app.include_router(messages_router,      prefix="/api/messages",     tags=["Messages"])
app.include_router(notifications_router, prefix="/api/notifications",tags=["Notifications"])
app.include_router(price_alerts_router,  prefix="/api/price-alerts", tags=["Price Alerts"])
app.include_router(search_router,        prefix="/api/search",       tags=["Search"])
app.include_router(activity_router,      prefix="/api/activity",     tags=["User Activity"])
app.include_router(history_router,       prefix="/api/history",      tags=["Search History"])
app.include_router(versions_router,      prefix="/api/versions",     tags=["Product Versions"])
app.include_router(upload_router,        prefix="/api/uploads",      tags=["File Uploads"])
app.include_router(affiliate_router,     prefix="/api/affiliate",    tags=["Affiliate"])
app.include_router(admin_router,         prefix="/api/admin",        tags=["Admin"])
app.include_router(admin_support_router, prefix="/api/admin/support",    tags=["Admin Support"])
app.include_router(payments_router,      prefix="/api/payments",     tags=["Payments"])
app.include_router(reports_router,       prefix="/api/reports",      tags=["Reports"])
app.include_router(support_router,       prefix="/api/support",      tags=["Support"])
app.include_router(contact_router,       prefix="/api/contact",      tags=["Contact"])
app.include_router(admin_notifications_router, prefix="/api/admin/notifications", tags=["Admin Notifications"])
app.include_router(admin_products_router,      prefix="/api/admin/products",       tags=["Admin Products"])
app.include_router(admin_users_router,         prefix="/api/admin",                tags=["Admin Team"])
app.include_router(refunds_router,             prefix="/api/refunds",              tags=["Refund Requests"])
app.include_router(payout_webhook_router,      prefix="/api/webhooks",             tags=["Webhooks"])


# -- Static files --------------------------------------------------------------
_UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(_UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_UPLOADS_DIR), name="uploads")


# ?????????????????????????????????????????????????????????????????????????????
# HEALTH CHECK ENDPOINTS
# Designed for load-balancers, container orchestrators (K8s), and monitoring.
# ?????????????????????????????????????????????????????????????????????????????

@app.get("/health", tags=["Health"], summary="Full health check")
def health_check():
    """
    Comprehensive health check.
    Returns status of: database, firebase, storage, and application.
    HTTP 200 = healthy.  HTTP 503 = unhealthy.
    """
    report = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "services": {},
    }
    overall_ok = True

    # Database ping
    try:
        from app.db.database import engine as _engine
        import sqlalchemy
        with _engine.connect() as conn:
            conn.execute(sqlalchemy.text("SELECT 1"))
        db_provider = "PostgreSQL" if _engine.dialect.name == "postgresql" else "SQLite"
        report["services"]["database"] = {"status": "ok", "provider": db_provider}
    except Exception:
        report["services"]["database"] = {"status": "error", "detail": "Database connection verification failed"}
        overall_ok = False

    # Firebase connection
    try:
        from app.shared.firebase.connection import firebase_connected
        report["services"]["firebase"] = {
            "status": "ok" if firebase_connected else "unavailable",
            "connected": firebase_connected,
        }
    except Exception:
        report["services"]["firebase"] = {"status": "unavailable", "connected": False}

    # Storage availability
    try:
        from app.services.storage_service import storage_service
        provider_name = type(storage_service.provider).__name__
        report["services"]["storage"] = {"status": "ok", "provider": provider_name}
    except Exception:
        report["services"]["storage"] = {"status": "error", "detail": "Storage connectivity check failed"}
        overall_ok = False

    if not overall_ok:
        report["status"] = "unhealthy"
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=report)

    return report


@app.get("/ready", tags=["Health"], summary="Readiness probe")
def readiness_probe():
    """
    Kubernetes readiness probe - indicates the pod is ready to receive traffic.
    Checks that the database is reachable.
    """
    try:
        from app.db.database import engine as _engine
        import sqlalchemy
        with _engine.connect() as conn:
            conn.execute(sqlalchemy.text("SELECT 1"))
        return {"status": "ready", "timestamp": datetime.utcnow().isoformat() + "Z"}
    except Exception as err:
        _logger.error("[readiness] Database not reachable: %s", err)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "reason": "Database unavailable"},
        )


@app.get("/live", tags=["Health"], summary="Liveness probe")
def liveness_probe():
    """
    Kubernetes liveness probe - indicates the process is alive.
    Always returns 200 as long as the Python process is running.
    """
    return {"status": "alive", "timestamp": datetime.utcnow().isoformat() + "Z"}


# -- Platform Status (existing public endpoint) --------------------------------

@app.get("/api/public/platform/status")
def get_public_platform_status():
    from app.shared.firebase.connection import db, firebase_connected

    if firebase_connected and db is not None:
        try:
            from admin.firestore.admin_firestore import get_platform_settings
            settings = get_platform_settings()
            return {
                "isPlatformPaused": settings.get("isPlatformPaused", False),
                "maintenanceMessage": settings.get("pauseMessage") or "Platform maintenance is currently active.",
                "updatedAt": settings.get("lastUpdated") or "",
            }
        except Exception:
            pass

    try:
        from admin.routes.settings import _local_platform_state
        return {
            "isPlatformPaused": _local_platform_state.get("isPlatformPaused", False),
            "maintenanceMessage": _local_platform_state.get("pauseMessage") or "Platform maintenance is currently active.",
            "updatedAt": _local_platform_state.get("lastUpdated") or "",
        }
    except Exception:
        return {
            "isPlatformPaused": False,
            "maintenanceMessage": "Platform maintenance is currently active.",
            "updatedAt": "",
        }


@app.get("/")
def read_root():
    return {"message": "Welcome to Lumora Digital Marketplace API. Visit /docs for Swagger documentation."}
