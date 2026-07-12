"""
Lumora Digital Marketplace — FastAPI Application Entry Point
============================================================
Production-hardened startup with:
  • Fail-fast startup configuration validation
  • Centralized global exception handlers (no raw tracebacks exposed to client)
  • Standardized JSON error response envelope
  • Health-check endpoints  (/health  /ready  /live)
  • Structured logging configuration
"""
# Load .env variables FIRST — before any module that reads os.getenv() at import time
import os
from pathlib import Path
_env_file = Path(__file__).resolve().parent.parent / ".env"
if _env_file.exists():
    try:
        from dotenv import load_dotenv as _load_dotenv
        _load_dotenv(dotenv_path=str(_env_file), override=False)
    except ImportError:
        pass  # python-dotenv not installed — env vars must be set externally

import sys
import logging
from datetime import datetime

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from sqlalchemy.exc import SQLAlchemyError
from slowapi.errors import RateLimitExceeded

from app.db.database import engine
from app.models import Base
from app.middleware.rate_limit import limiter, _rate_limit_handler
from app.core.exceptions import LumoraException

# ── Logging Configuration ─────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
_logger = logging.getLogger("lumora.main")

# ── Import Routers ────────────────────────────────────────────────────────────
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

# ── Startup Configuration Validation ─────────────────────────────────────────
def _validate_startup_config() -> None:
    """
    Fail-fast validation: checks critical environment variables and services.
    Called once before the app starts serving requests.
    Logs clearly and exits immediately if a required dependency is missing.
    """
    errors = []

    # 1. JWT Secret Key — hard-fail if weak or default
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

    # 5. Firebase credentials (non-fatal warning — Firebase connection is optional)
    cert_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if not cert_path:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        cert_path = os.path.join(base_dir, "shared", "firebase", "serviceAccountKey.json")
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

    # Fail fast if any critical errors found
    if errors:
        for err in errors:
            _logger.critical("[startup] CONFIGURATION ERROR: %s", err)
        _logger.critical("[startup] Application cannot start. Fix the above errors.")
        sys.exit(1)

    _logger.info("[startup] Configuration validation passed OK")


# Run validation before table creation so we catch DB issues early
_validate_startup_config()

# ── Database Table Creation ───────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ── Seed Admin Users ──────────────────────────────────────────────────────────
from app.db.database import SessionLocal
from app.models.user import User

db_session = SessionLocal()
try:
    admin_email = "avikapawar4@gmail.com"
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

# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Lumora Digital Marketplace API",
    description="Backend API for Lumora digital assets marketplace.",
    version="1.0.0",
)

# ── Rate Limiting ─────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

# ═════════════════════════════════════════════════════════════════════════════
# GLOBAL EXCEPTION HANDLERS
# All errors are returned in a consistent JSON envelope:
#
#   { "success": false, "error": { "code": "...", "message": "...", "details": null } }
#
# No raw Python tracebacks, SQLAlchemy errors, or Firebase errors are exposed.
# ═════════════════════════════════════════════════════════════════════════════

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
    """Handle Pydantic validation errors — return field-level details without exposing internals."""
    field_errors = []
    for error in exc.errors():
        loc = " → ".join(str(loc) for loc in error.get("loc", []) if loc != "body")
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
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "DATABASE_ERROR",
                "message": "A database error occurred. Please try again.",
                "details": None,
            },
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch-all handler — hides raw Python tracebacks from API consumers.
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
        "[unhandled_error] %s %s → %s: %s",
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


# ── CORS ──────────────────────────────────────────────────────────────────────
# Read allowed origins from the CORS_ORIGINS env var (comma-separated).
# Falls back to local dev origins when the variable is not set.
_cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174")
origins = [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount API Routers ─────────────────────────────────────────────────────────
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

# ── Static files ──────────────────────────────────────────────────────────────
_UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(_UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_UPLOADS_DIR), name="uploads")


# ═════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK ENDPOINTS
# Designed for load-balancers, container orchestrators (K8s), and monitoring.
# ═════════════════════════════════════════════════════════════════════════════

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
        report["services"]["database"] = {"status": "ok", "provider": "SQLite"}
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
    Kubernetes readiness probe — indicates the pod is ready to receive traffic.
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
    Kubernetes liveness probe — indicates the process is alive.
    Always returns 200 as long as the Python process is running.
    """
    return {"status": "alive", "timestamp": datetime.utcnow().isoformat() + "Z"}


# ── Platform Status (existing public endpoint) ────────────────────────────────

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
