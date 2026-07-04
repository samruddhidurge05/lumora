from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from app.db.database import engine
from app.models import Base
from app.middleware.rate_limit import limiter, _rate_limit_handler
from slowapi.errors import RateLimitExceeded

# Import Routers
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

# Create Database tables
Base.metadata.create_all(bind=engine)

# Seed Admin Users
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
        print(f"[seed] Admin user created: {admin_email}")
except Exception as e:
    print(f"[seed] Error seeding admin user: {e}")
finally:
    db_session.close()

app = FastAPI(
    title="Lumora Digital Marketplace API",
    description="Backend API for Lumora digital assets store",
    version="1.0.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

from fastapi.responses import JSONResponse
from app.core.exceptions import LumoraException

@app.exception_handler(LumoraException)
async def lumora_exception_handler(request, exc: LumoraException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "code": exc.code,
            "message": exc.message
        }
    )

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev simplicity, allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(products_router, prefix="/api/products", tags=["Products"])
app.include_router(orders_router, prefix="/api/orders", tags=["Orders"])
app.include_router(reviews_router, prefix="/api/reviews", tags=["Reviews"])
app.include_router(vendors_router, prefix="/api/vendors", tags=["Vendors"])
app.include_router(wishlist_router, prefix="/api/wishlist", tags=["Wishlist"])
app.include_router(cart_router, prefix="/api/cart", tags=["Cart"])
app.include_router(messages_router, prefix="/api/messages", tags=["Messages"])
app.include_router(notifications_router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(price_alerts_router, prefix="/api/price-alerts", tags=["Price Alerts"])
app.include_router(search_router, prefix="/api/search", tags=["Search"])
app.include_router(activity_router, prefix="/api/activity", tags=["User Activity"])
app.include_router(history_router, prefix="/api/history", tags=["Search History"])
app.include_router(versions_router, prefix="/api/versions", tags=["Product Versions"])
app.include_router(upload_router, prefix="/api/uploads", tags=["File Uploads"])
app.include_router(affiliate_router, prefix="/api/affiliate", tags=["Affiliate"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])

# ── Static file serving for uploaded product assets ──────────────────────────
# Files uploaded via POST /api/uploads/ are stored at backend/uploads/
# and served publicly at  http://localhost:8000/uploads/<filename>
_UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(_UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_UPLOADS_DIR), name="uploads")

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
                "updatedAt": settings.get("lastUpdated") or ""
            }
        except Exception:
            pass
            
    try:
        from admin.routes.settings import _local_platform_state
        return {
            "isPlatformPaused": _local_platform_state.get("isPlatformPaused", False),
            "maintenanceMessage": _local_platform_state.get("pauseMessage") or "Platform maintenance is currently active.",
            "updatedAt": _local_platform_state.get("lastUpdated") or ""
        }
    except Exception:
        return {
            "isPlatformPaused": False,
            "maintenanceMessage": "Platform maintenance is currently active.",
            "updatedAt": ""
        }


@app.get("/")
def read_root():
    return {"message": "Welcome to Lumora Digital Marketplace API. Visit /docs for Swagger documentation."}
