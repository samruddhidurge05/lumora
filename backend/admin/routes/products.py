import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional, Literal
from pydantic import BaseModel
from app.db.session import get_db
from app.models.product import Product
from app.schemas.schemas import ProductCreate, ProductResponse, ProductUpdate
from admin.validators.admin_auth import require_admin_role
from admin.firestore.admin_firestore import sync_product_to_firestore, delete_product_from_firestore
from app.services.audit_log_service import log_admin_action

logger = logging.getLogger(__name__)
router = APIRouter()


class StatusPatch(BaseModel):
    status: Literal["published", "draft"]


class FeaturedPatch(BaseModel):
    featured: bool

@router.get("/")
def get_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin_role)
):
    q = db.query(Product)
    if status:
        q = q.filter(Product.status.ilike(status))
    if category:
        q = q.filter(Product.category.ilike(f"%{category}%"))
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "page": page, "page_size": page_size, "items": items}

@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product_in: ProductCreate, db: Session = Depends(get_db), admin_user = Depends(require_admin_role)):
    data = product_in.model_dump(exclude_none=True)
    data["vendor_id"] = str(admin_user.id)
    if not data.get("seller"):
        data["seller"] = admin_user.name
    # Always clean the seller name: strip whitespace and ensure "Lumora" branding
    # when the admin didn't enter a specific creator/brand name.
    if data.get("seller"):
        data["seller"] = data["seller"].strip()
    if not data.get("seller"):
        data["seller"] = "Lumora"

    # ── Ensure list fields are preserved even when sent as empty lists ────────
    # model_dump(exclude_none=True) drops None values but keeps [].
    # However, if the frontend sends null for these fields they'd be excluded.
    # Force-set them from the original payload (before exclude_none) to preserve [].
    raw_data = product_in.model_dump()
    for list_field in ("features", "highlights", "what_you_get", "system_requirements",
                       "tags", "image_urls", "preview_images"):
        if list_field not in data:
            raw_val = raw_data.get(list_field)
            data[list_field] = raw_val if isinstance(raw_val, list) else []

    logger.info("[product-create] features=%s highlights=%s", data.get("features"), data.get("highlights"))

    # Auto-populate thumbnail/preview from image_urls[0] when not explicitly set
    # so the admin card and customer marketplace always show the first pCloud image.
    image_urls = data.get("image_urls") or []
    if not data.get("thumbnail") and image_urls:
        data["thumbnail"] = image_urls[0]
    if not data.get("preview") and image_urls:
        data["preview"] = image_urls[0]

    product = Product(**data)
    db.add(product)
    db.commit()
    db.refresh(product)
    sync_product_to_firestore(product)
    try:
        log_admin_action(db, admin_user_id=admin_user.id, action="product_created", target_type="product", target_id=str(product.id))
    except Exception:
        pass
    return product

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, product_in: ProductUpdate, db: Session = Depends(get_db), admin_user = Depends(require_admin_role)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    update_data = product_in.model_dump(exclude_none=True)
    # Clean seller name on update: strip whitespace
    if "seller" in update_data and update_data["seller"]:
        update_data["seller"] = update_data["seller"].strip() or "Lumora"
    # Preserve list fields even when sent as empty lists (exclude_none=True would miss nulls)
    raw_update = product_in.model_dump()
    for list_field in ("features", "highlights", "what_you_get", "system_requirements",
                       "tags", "image_urls", "preview_images"):
        if list_field not in update_data and isinstance(raw_update.get(list_field), list):
            update_data[list_field] = raw_update[list_field]
    logger.info("[product-update] id=%s features=%s highlights=%s", product_id, update_data.get("features"), update_data.get("highlights"))
    for key, val in update_data.items():
        setattr(product, key, val)

    # Auto-populate thumbnail/preview from image_urls[0] when still missing after update
    image_urls = product.image_urls or []
    if not product.thumbnail and image_urls:
        product.thumbnail = image_urls[0]
    if not product.preview and image_urls:
        product.preview = image_urls[0]

    db.commit()
    db.refresh(product)
    sync_product_to_firestore(product)
    try:
        log_admin_action(db, admin_user_id=admin_user.id, action="product_updated", target_type="product", target_id=str(product_id))
    except Exception:
        pass
    return product

@router.patch("/{product_id}/status", response_model=ProductResponse)
def patch_product_status(
    product_id: int,
    body: StatusPatch,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin_role)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.status = body.status
    db.commit()
    db.refresh(product)
    sync_product_to_firestore(product)
    try:
        log_admin_action(db, admin_user_id=admin_user.id, action="product_status_patched", target_type="product", target_id=str(product_id))
    except Exception:
        pass
    return product

@router.patch("/{product_id}/featured", response_model=ProductResponse)
def patch_product_featured(
    product_id: int,
    body: FeaturedPatch,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin_role)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.featured = body.featured
    db.commit()
    db.refresh(product)
    sync_product_to_firestore(product)
    try:
        log_admin_action(db, admin_user_id=admin_user.id, action="product_featured_patched", target_type="product", target_id=str(product_id))
    except Exception:
        pass
    return product

@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db), admin_user = Depends(require_admin_role)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # ── Delete from Firestore BEFORE removing the SQLite row ──────────────────
    # This ensures no orphan Firestore documents are left when the product has
    # cross-collection references. delete_product_from_firestore always deletes
    # and logs reference warnings — it never blocks the admin delete.
    result = delete_product_from_firestore(product_id)
    if not result.get("deleted") and result.get("reason") != "firestore_unavailable":
        logger.warning(
            "[firestore-sync] Firestore delete failed for product %s: %s",
            product_id,
            result.get("reason"),
        )

    db.delete(product)
    db.commit()
    try:
        log_admin_action(db, admin_user_id=admin_user.id, action="product_deleted", target_type="product", target_id=str(product_id))
    except Exception:
        pass
    return None
