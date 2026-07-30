from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from admin.validators.admin_auth import require_admin_role
from app.db.session import get_db
from app.models.product import Product
from app.models.user import User
from app.services.audit_log_service import log_admin_action
from app.shared.firebase.connection import db as firestore_db, firebase_connected
from datetime import datetime, timezone
from typing import Optional, List

from app.services.product_service import ProductService

router = APIRouter()

# Platform owner sentinel — products with this vendor_id (or NULL) are Platform-owned.
_PLATFORM_VENDOR_ID = "lumora-creator"


@router.get("/")
def list_admin_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=2000),
    status: Optional[str] = Query(None, description="Filter by status: published, draft, archived, pending_review"),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """
    Return ALL Platform-owned products for the Admin Panel.

    ISOLATION CONTRACT:
      - vendor_id == 'lumora-creator'  →  Platform product  ✓ included
      - vendor_id IS NULL              →  Legacy Platform product  ✓ included
      - vendor_id == <any other value> →  Vendor product  ✗ NEVER returned here

    All statuses are included (published, draft, archived, pending_review) so that
    Admin can see and manage products at every lifecycle stage.
    Vendor products MUST use their own /api/vendors/ or /api/products/ endpoint.
    """
    query = db.query(Product).filter(
        or_(
            Product.vendor_id == _PLATFORM_VENDOR_ID,
            Product.vendor_id.is_(None),
        )
    )

    if status:
        query = query.filter(Product.status == status.lower())
    if category and category != "All":
        query = query.filter(Product.category == category)

    total = query.count()

    products = (
        query
        .order_by(Product.created_at.desc(), Product.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    # Resolve media URLs (thumbnails, previews) via the shared ProductService helper
    try:
        ProductService.resolve_products_media(products, db)
    except Exception:
        pass  # Media resolution is best-effort; never block the listing response

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "products": [
            {
                "id":          p.id,
                "title":       p.title,
                "description": p.description or "",
                "short_desc":  p.short_desc or "",
                "category":    p.category or "General",
                "price":       float(p.price or 0),
                "thumbnail":   p.thumbnail,
                "preview":     p.preview,
                "file_url":    p.file_url,
                "vendor_id":   p.vendor_id,
                "seller":      p.seller,
                "status":      p.status or "draft",
                "featured":    bool(p.featured),
                "trending":    bool(p.trending),
                "badge":       p.badge,
                "tags":        p.tags or [],
                "highlights":  p.highlights or [],
                "features":            p.features or [],
                "what_you_get":        p.what_you_get or [],
                "system_requirements": p.system_requirements or [],
                "installation_guide":  p.installation_guide or "",
                "affiliate_enabled":   bool(p.affiliate_enabled),
                "commission_type":     p.commission_type or "percentage",
                "commission_value":    float(p.commission_value or 0),
                "downloads":   p.downloads or 0,
                "rating":      float(p.rating or 5.0),
                "reviews":     p.reviews or 0,
                "created_at":  p.created_at.isoformat() if p.created_at else None,
                "updated_at":  p.updated_at.isoformat() if getattr(p, "updated_at", None) else None,
            }
            for p in products
        ],
    }


@router.get("/pending")
def list_pending_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """Return paginated list of products awaiting approval."""
    products = (
        db.query(Product)
        .filter(Product.status == "pending_review")
        .order_by(Product.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    ProductService.resolve_products_media(products, db)
    total = db.query(Product).filter(Product.status == "pending_review").count()
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "products": [
            {
                "id": p.id,
                "title": p.title,
                "category": p.category,
                "price": float(p.price or 0),
                "thumbnail": p.thumbnail,
                "vendor_id": p.vendor_id,
                "seller": p.seller,
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in products
        ],
    }


@router.post("/{product_id}/approve")
def approve_product(
    product_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """Approve a pending product - sets status to published."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.status not in ("pending_review", "rejected"):
        raise HTTPException(
            status_code=400,
            detail=f"Product status is '{product.status}', cannot approve",
        )

    product.status = "published"
    db.commit()
    db.refresh(product)

    # Sync to Firestore
    if firebase_connected and firestore_db is not None:
        try:
            from admin.firestore.admin_firestore import sync_product_to_firestore
            sync_product_to_firestore(product)
        except Exception as e:
            print(f"[M4-M7] Firestore sync failed on approve: {e}")

    # Audit log
    try:
        log_admin_action(
            db=db,
            admin_user_id=admin_user.id,
            action="product_approved",
            target_type="product",
            target_id=str(product_id),
            metadata={"title": product.title},
        )
    except Exception:
        pass

    return {"id": product.id, "status": product.status, "title": product.title}


@router.post("/{product_id}/reject")
def reject_product(
    product_id: int,
    reason: Optional[str] = Body(None),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """Reject a pending product with optional reason."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.status = "rejected"
    db.commit()
    db.refresh(product)

    # Audit log
    try:
        log_admin_action(
            db=db,
            admin_user_id=admin_user.id,
            action="product_rejected",
            target_type="product",
            target_id=str(product_id),
            metadata={"title": product.title, "reason": reason},
        )
    except Exception:
        pass

    return {
        "id": product.id,
        "status": product.status,
        "title": product.title,
        "reason": reason,
    }
