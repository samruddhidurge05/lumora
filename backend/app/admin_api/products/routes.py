from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy.orm import Session
from admin.validators.admin_auth import require_admin_role
from app.db.session import get_db
from app.models.product import Product
from app.models.user import User
from app.services.audit_log_service import log_admin_action
from app.shared.firebase.connection import db as firestore_db, firebase_connected
from datetime import datetime, timezone
from typing import Optional

from app.services.product_service import ProductService

router = APIRouter()


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
