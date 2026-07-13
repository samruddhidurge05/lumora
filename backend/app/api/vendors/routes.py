"""
Vendor API routes
-----------------
GET  /vendors/{vendor_id}/profile        → get vendor profile
PUT  /vendors/{vendor_id}/profile        → save vendor profile
PUT  /vendors/{vendor_id}/store-settings → save store settings
GET  /vendors/{vendor_id}/stats          → dashboard stats
GET  /vendors/{vendor_id}/withdrawals    → withdrawal history
POST /vendors/{vendor_id}/withdrawals    → request withdrawal
GET  /vendors/{vendor_id}/orders         → vendor order history
POST /vendors/{vendor_id}/orders/{order_id}/fulfill  → mark order fulfilled
GET  /vendors/{vendor_id}/reviews        → reviews on vendor products
GET  /vendors/{vendor_id}/products       → products listed by this vendor
"""
from fastapi import APIRouter, HTTPException, Depends
from app.dependencies import get_current_vendor
from admin.validators.status_checks import verify_vendor_active
from .services import (
    get_vendor_profile,
    get_or_create_vendor_profile,
    save_vendor_profile,
    save_store_settings,
    get_vendor_stats,
    get_withdrawal_history,
    create_withdrawal,
    get_vendor_orders,
    fulfill_vendor_order,
    update_vendor_order_status,
    get_vendor_reviews,
    get_vendor_products,
    get_vendor_dashboard,
    reply_to_vendor_review,
)
from .schemas import VendorProfileSchema, StoreSettingsSchema, WithdrawalSchema, ReviewReplySchema
from pydantic import BaseModel

class OrderStatusSchema(BaseModel):
    status: str

router = APIRouter(tags=["Vendors"])


# ── Public endpoint (no auth) for CreatorProfile page ──────────────────────

@router.get("/public/{vendor_id}/profile")
def public_vendor_profile(vendor_id: str, db_session=None):
    """
    Public vendor profile — no authentication required.
    Used by marketplace CreatorProfile.jsx page.
    """
    from app.db.session import get_db as _get_db
    from app.db.database import engine
    from sqlalchemy.orm import Session as _Session
    from app.models.user import User as UserModel
    from app.models.product import Product as ProductModel

    with _Session(engine) as db_s:
        # Try to find vendor by Firebase uid stored as vendor_id
        products = db_s.query(ProductModel).filter(
            (ProductModel.vendor_id == vendor_id) | (ProductModel.seller == vendor_id)
        ).all()

        total_downloads = sum(p.downloads or 0 for p in products)
        avg_rating = (
            sum(p.rating or 0 for p in products) / len(products)
            if products else 0.0
        )

        return {
            "vendor_id": vendor_id,
            "product_count": len(products),
            "total_downloads": total_downloads,
            "avg_rating": round(avg_rating, 1),
            "products": [
                {
                    "id": p.id,
                    "title": p.title,
                    "category": p.category,
                    "price": p.price,
                    "rating": p.rating,
                    "downloads": p.downloads,
                    "preview": p.preview,
                    "badge": p.badge,
                }
                for p in products
            ],
        }


@router.get("/{vendor_id}/dashboard")
def vendor_dashboard(
    vendor_id: str,
    vendor: dict = Depends(get_current_vendor),
    _active = Depends(verify_vendor_active)
):
    """
    Single-call dashboard summary.
    Returns stats + recent_orders + recent_products + recent_reviews + activity + monthly_chart.
    JWT required — vendor can only access their own dashboard.
    Raises 403 if the vendor account is disabled.
    """
    if vendor.get("uid") != vendor_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this dashboard")
    return get_vendor_dashboard(vendor_id)


@router.get("/{vendor_id}/profile")
def vendor_profile(vendor_id: str, vendor: dict = Depends(get_current_vendor), _active = Depends(verify_vendor_active)):
    if vendor.get("uid") != vendor_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this vendor profile")
    profile = get_vendor_profile(vendor_id)
    # Auto-create Vendor row on first access so profile is always available
    if not profile:
        profile = get_or_create_vendor_profile(vendor_id, vendor)
    return profile


@router.put("/{vendor_id}/profile")
def update_vendor_profile(vendor_id: str, body: VendorProfileSchema, vendor: dict = Depends(get_current_vendor), _active = Depends(verify_vendor_active)):
    if vendor.get("uid") != vendor_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this vendor profile")
    return save_vendor_profile(vendor_id, body.model_dump())


@router.put("/{vendor_id}/store-settings")
def update_store_settings(vendor_id: str, body: StoreSettingsSchema, vendor: dict = Depends(get_current_vendor), _active = Depends(verify_vendor_active)):
    if vendor.get("uid") != vendor_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this store settings")
    return save_store_settings(vendor_id, body.model_dump())


@router.get("/{vendor_id}/stats")
def vendor_stats(
    vendor_id: str,
    vendor: dict = Depends(get_current_vendor),
    _active = Depends(verify_vendor_active)
):
    if vendor.get("uid") != vendor_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this vendor statistics")
    return get_vendor_stats(vendor_id)


@router.get("/{vendor_id}/withdrawals")
def list_withdrawals(
    vendor_id: str,
    vendor: dict = Depends(get_current_vendor),
    _active = Depends(verify_vendor_active)
):
    if vendor.get("uid") != vendor_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this withdrawal history")
    return get_withdrawal_history(vendor_id)


@router.post("/{vendor_id}/withdrawals")
def request_withdrawal(vendor_id: str, body: WithdrawalSchema, vendor: dict = Depends(get_current_vendor), _active = Depends(verify_vendor_active)):
    if vendor.get("uid") != vendor_id:
        raise HTTPException(status_code=403, detail="Not authorized to request withdrawal")
    if body.amount < 500:
        raise HTTPException(status_code=400, detail="Minimum withdrawal amount is ₹500")
    return create_withdrawal({**body.model_dump(), "vendor_id": vendor_id})


@router.get("/{vendor_id}/orders")
def vendor_orders(
    vendor_id: str,
    vendor: dict = Depends(get_current_vendor),
    _active = Depends(verify_vendor_active)
):
    if vendor.get("uid") != vendor_id:
        raise HTTPException(status_code=403, detail="Not authorized to view these orders")
    return get_vendor_orders(vendor_id)


@router.post("/{vendor_id}/orders/{order_id}/fulfill")
def fulfill_order(vendor_id: str, order_id: int, vendor: dict = Depends(get_current_vendor), _active = Depends(verify_vendor_active)):
    if vendor.get("uid") != vendor_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    res = fulfill_vendor_order(vendor_id, order_id)
    if not res.get("success"):
        detail = res.get("detail", "Failed to fulfill order")
        status_code = 404 if "not found" in detail.lower() else 403
        raise HTTPException(status_code=status_code, detail=detail)
    return res


@router.patch("/{vendor_id}/orders/{order_id}/status")
def update_order_status(
    vendor_id: str,
    order_id: int,
    body: OrderStatusSchema,
    vendor: dict = Depends(get_current_vendor),
    _active = Depends(verify_vendor_active)
):
    """Update order status to any valid value (pending/processing/completed/refunded/cancelled).
    JWT required — vendor must own a product in the order."""
    if vendor.get("uid") != vendor_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    res = update_vendor_order_status(vendor_id, order_id, body.status)
    if not res.get("success"):
        detail = res.get("detail", "Failed to update order status")
        status_code = 404 if "not found" in detail.lower() else (
            400 if "invalid" in detail.lower() else 403
        )
        raise HTTPException(status_code=status_code, detail=detail)
    return res


@router.get("/{vendor_id}/reviews")
def vendor_reviews(
    vendor_id: str,
    vendor: dict = Depends(get_current_vendor),
    _active = Depends(verify_vendor_active)
):
    if vendor.get("uid") != vendor_id:
        raise HTTPException(status_code=403, detail="Not authorized to view these reviews")
    return get_vendor_reviews(vendor_id)


@router.get("/{vendor_id}/products")
def vendor_products(
    vendor_id: str,
    search:   str = "",
    category: str = "",
    status:   str = "",
    sort:     str = "newest",
    page:     int = 1,
    limit:    int = 20,
    vendor: dict = Depends(get_current_vendor),
    _active = Depends(verify_vendor_active)
):
    if vendor.get("uid") != vendor_id:
        raise HTTPException(status_code=403, detail="Not authorized to view these products")
    return get_vendor_products(
        vendor_id,
        search=search,
        category=category,
        status_filter=status,
        sort=sort,
        page=page,
        limit=limit,
    )


@router.post("/{vendor_id}/reviews/{review_id}/reply")
def reply_to_review_route(
    vendor_id: str,
    review_id: int,
    body: ReviewReplySchema,
    vendor: dict = Depends(get_current_vendor),
    _active = Depends(verify_vendor_active)
):
    """Submit a reply to a product review as the vendor."""
    if vendor.get("uid") != vendor_id:
        raise HTTPException(status_code=403, detail="Not authorized to reply to reviews for this vendor")
    res = reply_to_vendor_review(vendor_id, review_id, body.reply)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("detail", "Failed to submit reply"))
    return res
