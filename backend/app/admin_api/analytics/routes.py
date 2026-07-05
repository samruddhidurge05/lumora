from fastapi import APIRouter, Depends, HTTPException
from app.admin_api.analytics.services import get_analytics_dashboard_data, get_full_dashboard_data
from admin.validators.admin_auth import require_admin_role
from app.models.user import User

router = APIRouter()

@router.get("/dashboard-full")
def get_dashboard_full(admin_user: User = Depends(require_admin_role)):
    return get_full_dashboard_data()

@router.get("/dashboard")
def get_dashboard(admin_user: User = Depends(require_admin_role)):
    return get_analytics_dashboard_data()

@router.get("/revenue")
def get_revenue(admin_user: User = Depends(require_admin_role)):
    data = get_analytics_dashboard_data()
    return {
        "revenueTrend": data.get("revenueTrend", {}),
        "kpis": {
            "totalRevenue": data.get("kpis", {}).get("totalRevenue", 0.0),
            "aov": data.get("kpis", {}).get("aov", 0.0)
        }
    }

@router.get("/products")
def get_products_performance(admin_user: User = Depends(require_admin_role)):
    data = get_analytics_dashboard_data()
    return {
        "productPerformance": data.get("productPerformance", [])
    }

@router.get("/customers")
def get_customers_analytics(admin_user: User = Depends(require_admin_role)):
    data = get_analytics_dashboard_data()
    return {
        "customerAnalytics": data.get("customerAnalytics", {})
    }

@router.get("/forecast")
def get_forecast(admin_user: User = Depends(require_admin_role)):
    data = get_analytics_dashboard_data()
    return {
        "forecast": data.get("forecast", {})
    }
