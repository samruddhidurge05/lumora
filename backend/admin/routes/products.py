import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional, Literal
from pydantic import BaseModel
from app.db.session import get_db
from app.models.product import Product
from app.schemas.schemas import ProductCreate, ProductResponse, ProductUpdate
from admin.validators.admin_auth import require_admin_role
from admin.firestore.admin_firestore import sync_product_to_firestore, delete_product_from_firestore
from app.services.audit_log_service import log_admin_action
from app.api.products_router import trigger_firestore_sync_if_needed

from app.services.product_service import ProductService
from app.services.storage_service import storage_service

logger = logging.getLogger(__name__)
router = APIRouter()


class StatusPatch(BaseModel):
    status: Literal["published", "draft"]


class FeaturedPatch(BaseModel):
    featured: bool


@router.get("/")
def get_products(
    background_tasks: BackgroundTasks,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin_role)
):
    trigger_firestore_sync_if_needed(background_tasks)
    q = db.query(Product)
    if status:
        q = q.filter(Product.status.ilike(status))
    if category:
        q = q.filter(Product.category.ilike(f"%{category}%"))
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    ProductService.resolve_products_media(items, db)
    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product_in: ProductCreate, db: Session = Depends(get_db), admin_user = Depends(require_admin_role)):
    # Prevent duplicate product submissions (e.g. double-click, network retries)
    from datetime import datetime, timedelta
    recent_product = db.query(Product).filter(
        Product.title == product_in.title,
        Product.vendor_id == str(admin_user.id),
        Product.created_at >= datetime.utcnow() - timedelta(seconds=5)
    ).first()
    if recent_product:
        logger.warning("[product-create] Duplicate product creation rejected for title: %s", product_in.title)
        return recent_product

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

    # Auto-populate thumbnail/preview from image_urls[0] when not explicitly set
    # so the admin card and customer marketplace always show the first pCloud image.
    image_urls = product_in.image_urls or []
    thumbnail_url = product_in.thumbnail
    if not thumbnail_url and image_urls:
        thumbnail_url = image_urls[0]
    preview_url = product_in.preview
    if not preview_url and image_urls:
        preview_url = image_urls[0]

    product = ProductService.create_product(
        db=db,
        vendor_id=str(admin_user.id),
        title=product_in.title,
        description=product_in.description or product_in.short_desc or "",
        category=product_in.category or "General",
        price=product_in.price,
        temp_file_url=product_in.file_url,
        temp_preview_url=preview_url,
        temp_thumbnail_url=thumbnail_url,
        tags=product_in.tags or [],
        highlights=product_in.highlights or [],
        badge=product_in.badge,
        seller=data["seller"],
        affiliate_enabled=product_in.affiliate_enabled or False,
        commission_type=product_in.commission_type or "percentage",
        commission_value=product_in.commission_value or 0.0,
        short_desc=product_in.short_desc,
        features=product_in.features or [],
        system_requirements=product_in.system_requirements or [],
        what_you_get=product_in.what_you_get or [],
        installation_guide=product_in.installation_guide or "",
        subcategory=product_in.subcategory,
        discount=product_in.discount or 0.0,
        preview_images=product_in.preview_images or [],
        preview_video=product_in.preview_video,
        seo_title=product_in.seo_title,
        seo_description=product_in.seo_description,
        visibility=product_in.visibility or "public",
        status=data.get("status") or "published",
        pcloud_download_link=product_in.pcloud_download_link,
        image_urls=image_urls,
    )

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

    # Auto-populate thumbnail/preview from image_urls[0] when still missing after update
    image_urls = update_data.get("image_urls") if "image_urls" in update_data else product.image_urls or []
    thumbnail_val = update_data.get("thumbnail") if "thumbnail" in update_data else product.thumbnail
    preview_val = update_data.get("preview") if "preview" in update_data else product.preview

    if not thumbnail_val and image_urls:
        update_data["thumbnail"] = image_urls[0]
    if not preview_val and image_urls:
        update_data["preview"] = image_urls[0]

    product = ProductService.update_product(
        db=db,
        product_id=product_id,
        vendor_id=product.vendor_id,  # Bypass vendor ownership check by passing product's own vendor_id
        update_data=update_data
    )

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

    # Associated storage objects to clean up
    storage_objects = [
        product.storage_path,
        product.thumbnail_path,
        product.preview_path
    ]

    # -- Delete from Firestore BEFORE removing the SQLite row ------------------
    # This ensures no orphan Firestore documents are left when the product has
    # cross-collection references. delete_product_from_firestore always deletes
    # and logs reference warnings - it never blocks the admin delete.
    result = delete_product_from_firestore(product_id)
    if not result.get("deleted") and result.get("reason") != "firestore_unavailable":
        logger.warning(
            "[firestore-sync] Firestore delete failed for product %s: %s",
            product_id,
            result.get("reason"),
        )

    db.delete(product)
    db.commit()

    # Clean up storage objects only after successful database commit
    for path in storage_objects:
        if path:
            try:
                storage_service.delete(path)
            except Exception as e:
                logger.warning("[storage-cleanup] Failed to delete path %s: %s", path, e)

    try:
        log_admin_action(db, admin_user_id=admin_user.id, action="product_deleted", target_type="product", target_id=str(product_id))
    except Exception:
        pass
    return None
