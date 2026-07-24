from fastapi import APIRouter
from admin.routes.auth import router as admin_auth_router
from admin.routes.analytics import router as analytics_router
from admin.routes.reports import router as reports_router
from admin.routes.reviews import router as reviews_router
from admin.routes.referral_links import router as referral_links_router
from app.admin_api.payments.routes import router as payments_router
from admin.routes.customers import router as customers_router
from admin.routes.orders import router as orders_router
from admin.routes.vendors import router as vendors_router
from admin.routes.affiliates import router as affiliates_router
from admin.routes.settings import router as settings_router
from admin.routes.products import router as products_router
from app.admin_api.refunds.routes import router as admin_refunds_router

router = APIRouter()

router.include_router(admin_auth_router, prefix="/auth", tags=["Admin Auth"])
router.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])
router.include_router(reports_router, prefix="/reports", tags=["Reports"])
router.include_router(reviews_router, prefix="/reviews", tags=["Reviews"])
router.include_router(referral_links_router, prefix="/referral-links", tags=["Admin Referral Links"])
router.include_router(payments_router, prefix="/payments", tags=["Payments"])
router.include_router(customers_router, prefix="/customers", tags=["Customers"])
router.include_router(orders_router, prefix="/orders", tags=["Orders"])
router.include_router(vendors_router, prefix="/vendors", tags=["Vendors"])
router.include_router(affiliates_router, prefix="/affiliates", tags=["Affiliates"])
router.include_router(settings_router, prefix="/settings", tags=["Settings"])
router.include_router(products_router, prefix="/products", tags=["Products"])
router.include_router(admin_refunds_router, prefix="/refunds", tags=["Refund Requests"])


@router.get("/system/config", tags=["System Config"])
def get_system_config():
    import os
    provider = os.getenv("AFFILIATE_PAYOUT_PROVIDER", os.getenv("AFFILIATE_PAYOUT_MODE", "mock")).strip().lower()
    return {
        "payout_provider": provider,
        "payout_mode": provider,
        "currency": os.getenv("PAYMENT_CURRENCY", "INR")
    }

