from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy import or_, cast, String as SqlString
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

# ─── Platform ownership sentinel ─────────────────────────────────────────────
# Forensic investigation (2026-07-30) confirmed THREE vendor_id formats exist
# in the production PostgreSQL database for Platform-owned products:
#
#   Format 1: vendor_id = 'lumora-creator'
#             Products seeded by the platform setup script.
#
#   Format 2: vendor_id IS NULL  OR  vendor_id = ''
#             Legacy products created before the vendor_id field was enforced.
#             NOTE: Empty string ('') is NOT the same as NULL in SQL — both
#             must be explicitly matched.
#
#   Format 3: vendor_id = str(admin_user.id)  e.g. '1', '5', '8'
#             Products created by logged-in admin accounts. The product
#             creation endpoint assigns vendor_id = str(current_user.id),
#             so admin users get their numeric DB user ID stored as vendor_id.
#             These are detected via LEFT JOIN on users WHERE role = 'admin'.
#
# Vendor products are products whose vendor_id refers to a user with
# role = 'vendor' (or any unknown handle that matches no admin user).
# ─────────────────────────────────────────────────────────────────────────────
_PLATFORM_SENTINEL = "lumora-creator"


@router.get("")
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

    ISOLATION CONTRACT — a product is Platform-owned if ANY of the following:
      1. vendor_id == 'lumora-creator'         (named platform sentinel)
      2. vendor_id IS NULL                     (legacy — NULL means platform)
      3. vendor_id == ''                       (legacy — empty string means platform)
      4. vendor_id refers to a user with       (admin created products store
         role = 'admin' in the users table)     str(user.id) as vendor_id)

    A product is Vendor-owned (EXCLUDED) if its vendor_id refers to a user
    with role = 'vendor', or is any non-empty string that is not a known
    admin user ID and is not the platform sentinel.

    All statuses are returned (published, draft, archived, pending_review)
    so the Admin Panel sees the complete platform inventory at all lifecycle stages.
    """
    # Identify admin user IDs to include products created by admins as Platform products
    admin_user_ids = [str(u.id) for u in db.query(User.id).filter(User.role == "admin").all()]

    platform_filters = [
        Product.owner_type == "PLATFORM",
        Product.is_platform_product == True,
        Product.vendor_id == "lumora-creator",
        Product.vendor_id.is_(None),
        Product.vendor_id == "",
    ]
    if admin_user_ids:
        platform_filters.append(Product.vendor_id.in_(admin_user_ids))

    query = db.query(Product).filter(or_(*platform_filters))

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
        admin_id = getattr(admin_user, "id", None) or (admin_user.get("id") if isinstance(admin_user, dict) else None)
        log_admin_action(
            db=db,
            admin_user_id=admin_id,
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
        admin_id = getattr(admin_user, "id", None) or (admin_user.get("id") if isinstance(admin_user, dict) else None)
        log_admin_action(
            db=db,
            admin_user_id=admin_id,
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


@router.post("")
@router.post("/")
def create_admin_product(
    data: dict = Body(...),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """
    Create a new product from Admin Panel.
    Assigns vendor_id = "lumora-creator" (platform sentinel) to ensure Platform ownership.
    """
    title = data.get("title") or data.get("name")
    if not title or not str(title).strip():
        raise HTTPException(status_code=422, detail="Product title cannot be empty.")

    try:
        price = float(data.get("price") or 0.0)
    except (ValueError, TypeError):
        price = 0.0

    if price < 0:
        raise HTTPException(status_code=400, detail="Price cannot be negative.")

    admin_id = getattr(admin_user, "id", None) or (admin_user.get("id") if isinstance(admin_user, dict) else None)
    vendor_id = _PLATFORM_SENTINEL

    new_product = Product(
        title=str(title).strip(),
        description=data.get("description", ""),
        short_desc=data.get("short_desc", ""),
        category=data.get("category", "General"),
        subcategory=data.get("subcategory"),
        price=price,
        thumbnail=data.get("thumbnail") or data.get("image"),
        preview=data.get("preview") or data.get("preview_url") or data.get("thumbnail"),
        file_url=data.get("file_url") or data.get("download_url") or f"/products/product-new.zip",
        file_size=data.get("file_size", "48 MB"),
        seller=data.get("seller", "Lumora Official"),
        vendor_id=vendor_id,
        status=data.get("status", "published"),
        featured=bool(data.get("featured", False)),
        trending=bool(data.get("trending", False)),
        badge=data.get("badge"),
        tags=data.get("tags") if isinstance(data.get("tags"), list) else [],
        highlights=data.get("highlights") if isinstance(data.get("highlights"), list) else [],
        features=data.get("features") if isinstance(data.get("features"), list) else [],
        what_you_get=data.get("what_you_get") if isinstance(data.get("what_you_get"), list) else [],
        system_requirements=data.get("system_requirements") if isinstance(data.get("system_requirements"), list) else [],
        installation_guide=data.get("installation_guide", ""),
        affiliate_enabled=bool(data.get("affiliate_enabled", True)),
        commission_type=data.get("commission_type", "percentage"),
        commission_value=float(data.get("commission_value") or 15.0),
        rating=float(data.get("rating") or 5.0),
        reviews=int(data.get("reviews") or 0),
        downloads=int(data.get("downloads") or 0),
        is_platform_product=True,
        owner_type="PLATFORM",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    db.add(new_product)
    db.commit()
    db.refresh(new_product)

    # Sync to Firestore
    if firebase_connected and firestore_db is not None:
        try:
            from admin.firestore.admin_firestore import sync_product_to_firestore
            sync_product_to_firestore(new_product)
        except Exception as e:
            print(f"[AdminProductCreate] Firestore sync warning: {e}")

    # Audit log
    try:
        log_admin_action(
            db=db,
            admin_user_id=admin_id,
            action="product_created",
            target_type="product",
            target_id=str(new_product.id),
            metadata={"title": new_product.title, "price": new_product.price},
        )
    except Exception:
        pass

    return {
        "id": new_product.id,
        "title": new_product.title,
        "description": new_product.description,
        "short_desc": new_product.short_desc,
        "category": new_product.category,
        "price": float(new_product.price or 0),
        "thumbnail": new_product.thumbnail,
        "preview": new_product.preview,
        "file_url": new_product.file_url,
        "vendor_id": new_product.vendor_id,
        "seller": new_product.seller,
        "status": new_product.status,
        "featured": new_product.featured,
        "badge": new_product.badge,
        "created_at": new_product.created_at.isoformat() if new_product.created_at else None,
    }


@router.put("/{product_id}")
def update_admin_product(
    product_id: int,
    data: dict = Body(...),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """Update existing product from Admin Panel."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    updatable_fields = [
        "title", "description", "short_desc", "category", "subcategory",
        "price", "thumbnail", "preview", "file_url", "file_size", "seller",
        "status", "featured", "trending", "badge", "tags", "highlights",
        "features", "what_you_get", "system_requirements", "installation_guide",
        "affiliate_enabled", "commission_type", "commission_value"
    ]
    for field in updatable_fields:
        if field in data:
            setattr(product, field, data[field])

    product.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(product)

    # Sync to Firestore
    if firebase_connected and firestore_db is not None:
        try:
            from admin.firestore.admin_firestore import sync_product_to_firestore
            sync_product_to_firestore(product)
        except Exception as e:
            print(f"[AdminProductUpdate] Firestore sync warning: {e}")

    return {"id": product.id, "title": product.title, "status": product.status}


@router.delete("/{product_id}")
def delete_admin_product(
    product_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """Delete product from Admin Panel."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    title = product.title
    db.delete(product)
    db.commit()

    # Firestore deletion
    if firebase_connected and firestore_db is not None:
        try:
            firestore_db.collection("products").document(str(product_id)).delete()
        except Exception as e:
            print(f"[AdminProductDelete] Firestore delete warning: {e}")

    return {"id": product_id, "message": f"Product '{title}' deleted successfully."}
