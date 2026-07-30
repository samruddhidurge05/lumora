"""
Products API router.
Serves public product catalog, media proxies, search, download centers, and vendor CRUD handlers.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import io
import mimetypes
import os
import re
import time
from typing import Any, List, Optional, cast
import zipfile

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt
from sqlalchemy import String, cast as sql_cast, func, or_
from sqlalchemy.orm import Session

from admin.firestore.admin_firestore import restore_sqlite_products_from_firestore
from admin.validators.status_checks import check_platform_paused, verify_vendor_active
from app.core.config import settings
from app.db.session import SessionLocal, get_db
from app.dependencies import get_current_user_required
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.user import User
from app.schemas.schemas import ProductCreate, ProductResponse, ProductUpdate
from app.services.product_service import ProductService
from app.services.storage_service import storage_service

router = APIRouter()


def generate_fallback_pdf(title: str, product_id: int) -> bytes:
    clean_title = title.encode("latin-1", "replace").decode("latin-1")
    pdf_content = (
        "%PDF-1.4\n"
        "1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n"
        "2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n"
        "3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj\n"
        "4 0 obj <</Length 250>> stream\n"
        "BT /F1 24 Tf 50 700 Td (Lumora Digital Product) Tj ET\n"
        f"BT /F1 16 Tf 50 650 Td (Product ID: {product_id}) Tj ET\n"
        f"BT /F1 14 Tf 50 620 Td (Title: {clean_title}) Tj ET\n"
        "BT /F1 12 Tf 50 580 Td (Thank you for your purchase on Lumora Marketplace.) Tj ET\n"
        "BT /F1 10 Tf 50 540 Td (License: Personal and Commercial License Granted.) Tj ET\n"
        "endstream\n"
        "endobj\n"
        "5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n"
        "xref\n"
        "0 6\n"
        "0000000000 65535 f \n"
        "0000000009 00000 n \n"
        "0000000058 00000 n \n"
        "0000000115 00000 n \n"
        "0000000244 00000 n \n"
        "0000000495 00000 n \n"
        "trailer <</Size 6 /Root 1 0 R>>\n"
        "startxref\n"
        "568\n"
        "%%EOF\n"
    )
    return pdf_content.encode("latin-1")


_LAST_FIRESTORE_SYNC_TIME = 0.0


def _bg_sync_firestore():
    db = SessionLocal()
    try:
        restore_sqlite_products_from_firestore(db)
    except Exception as e:
        print(f"[bg-sync] Error syncing Firestore products: {e}")
    finally:
        db.close()


def trigger_firestore_sync_if_needed(background_tasks: BackgroundTasks):
    global _LAST_FIRESTORE_SYNC_TIME
    now = time.time()
    if now - _LAST_FIRESTORE_SYNC_TIME > 30:  # 30 seconds throttle
        _LAST_FIRESTORE_SYNC_TIME = now
        background_tasks.add_task(_bg_sync_firestore)


def resolve_media_url(url: str, category: Optional[str] = None) -> Optional[str]:
    return ProductService._resolve_media_url(url, category)


def resolve_products_media(products, db):
    return ProductService.resolve_products_media(products, db)


@router.get("/media/{file_path:path}")
def serve_product_media(file_path: str, db: Session = Depends(get_db)):
    """
    Public proxy endpoint to serve public product media (previews, thumbnails, videos)
    from B2 or local storage. Prevents access to private/ folder.
    """
    # Prevent directory traversal or accessing private assets
    clean_path = file_path.replace("\\", "/").strip("/")
    if clean_path.startswith("private") or "private/" in clean_path:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to private product assets is restricted."
        )

    # Determine active provider storage scheme
    has_b2 = storage_service.b2_provider.is_available()
    if has_b2:
        storage_path = f"b2://{storage_service.b2_provider.bucket_name}/{clean_path}"
    else:
        storage_path = f"local://uploads/{clean_path}"

    if not storage_service.exists(storage_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media file not found."
        )

    # Determine content type based on file extension
    content_type, _ = mimetypes.guess_type(clean_path)
    if not content_type:
        content_type = "application/octet-stream"

    # Stream the file
    try:
        stream = storage_service.get_stream(storage_path)
    except Exception as e:
        print(f"[MediaProxyError] Stream error for path {storage_path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving media file from storage."
        )

    return StreamingResponse(
        stream,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=86400"
        }
    )


# -- Public read endpoints (no auth) ------------------------------------------

@router.get("/", response_model=List[ProductResponse])
def read_products(
    background_tasks: BackgroundTasks,
    category: Optional[str] = None,
    affiliate_only: Optional[bool] = None,
    affiliate_enabled: Optional[bool] = None,
    skip: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db)
):
    """List all published products. Public - no authentication required."""
    trigger_firestore_sync_if_needed(background_tasks)
    query = db.query(Product).outerjoin(User, Product.vendor_id == sql_cast(User.id, String)).filter(
        Product.status == "published",
        or_(User.id.is_(None), User.is_active.is_(True))
    )
    if affiliate_only or affiliate_enabled is True:
        query = query.filter(Product.affiliate_enabled.is_(True))
    if category and category != "All":
        query = query.filter(Product.category == category)
    query = query.order_by(Product.created_at.desc(), Product.id.desc())
    results = query.offset(skip).limit(limit).all()
    return resolve_products_media(results, db)


@router.get("/search")
def search_products(
    q: Optional[str] = None,
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort: Optional[str] = "featured",
    skip: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db)
):
    """Full-text search products. Public."""
    query = db.query(Product).outerjoin(User, Product.vendor_id == sql_cast(User.id, String)).filter(
        Product.status == "published",
        or_(User.id.is_(None), User.is_active.is_(True))
    ).order_by(Product.created_at.desc(), Product.id.desc())
    if q:
        like_q = f"%{q.lower()}%"
        query = query.filter(
            Product.title.ilike(like_q) |
            Product.description.ilike(like_q) |
            Product.category.ilike(like_q)
        )
    if category and category != "All":
        query = query.filter(Product.category == category)
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
    if max_price is not None:
        query = query.filter(Product.price <= max_price)

    products = query.all()

    # Sort in Python (simpler than SQL for optional sort)
    if sort == "price-asc":
        products = sorted(products, key=lambda p: float(cast(Any, p.price or 0.0)))
    elif sort == "price-desc":
        products = sorted(products, key=lambda p: float(cast(Any, p.price or 0.0)), reverse=True)
    elif sort == "rating":
        products = sorted(products, key=lambda p: float(cast(Any, p.rating or 0.0)), reverse=True)
    elif sort == "popular":
        products = sorted(products, key=lambda p: int(cast(Any, p.downloads or 0)), reverse=True)
    elif sort == "newest":
        products = sorted(products, key=lambda p: p.created_at or datetime.min, reverse=True)
    else:  # featured
        products = sorted(products, key=lambda p: bool(cast(Any, p.featured)), reverse=True)

    results = products[skip : skip + limit]
    return resolve_products_media(results, db)


@router.get("/featured", response_model=List[ProductResponse])
def get_featured_products(limit: int = 8, db: Session = Depends(get_db)):
    """Return featured products."""
    results = db.query(Product).outerjoin(User, Product.vendor_id == sql_cast(User.id, String)).filter(
        Product.featured.is_(True),
        Product.status == "published",
        or_(User.id.is_(None), User.is_active.is_(True))
    ).limit(limit).all()
    return resolve_products_media(results, db)


@router.get("/trending", response_model=List[ProductResponse])
def get_trending_products(limit: int = 8, db: Session = Depends(get_db)):
    """Return trending products sorted by downloads."""
    results = db.query(Product).outerjoin(User, Product.vendor_id == sql_cast(User.id, String)).filter(
        Product.trending.is_(True),
        Product.status == "published",
        or_(User.id.is_(None), User.is_active.is_(True))
    ).order_by(Product.downloads.desc()).limit(limit).all()
    return resolve_products_media(results, db)


@router.get("/categories", response_model=List[str])
def get_product_categories(db: Session = Depends(get_db)):
    """Return all unique categories from published products. Public."""
    categories = db.query(Product.category).outerjoin(User, Product.vendor_id == sql_cast(User.id, String)).filter(
        Product.status == "published",
        or_(User.id.is_(None), User.is_active.is_(True))
    ).distinct().all()
    return [str(c[0]) for c in categories if c[0]]


@router.get("/{product_id}", response_model=ProductResponse)
def read_product(
    product_id: str,
    db: Session = Depends(get_db),
):
    """
    Get a single product by numeric ID or human-readable slug.
    Public - no authentication required.
    Only 'published' products are returned. Draft, archived, pending_review,
    or disabled-vendor products return 404 for all public callers.
    Vendors and admins preview non-published products through their own authenticated routes.
    """
    from sqlalchemy import func
    from app.utils.db_sync import get_product_by_id

    query = db.query(Product).outerjoin(User, Product.vendor_id == sql_cast(User.id, String))

    if product_id.isdigit():
        pid = int(product_id)
        get_product_by_id(db, pid)
        query = query.filter(Product.id == pid)
    else:
        # Match by slug or title slugification
        clean_slug = product_id.strip().lower()
        query = query.filter(
            or_(
                func.replace(func.lower(Product.title), ' ', '-') == clean_slug,
                func.lower(Product.title) == clean_slug.replace('-', ' '),
                Product.category.ilike(clean_slug)
            )
        )

    product = query.filter(
        or_(User.id.is_(None), User.is_active.is_(True))
    ).first()

    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product unavailable")

    # Public availability guard: only published products are visible
    if (product.status or "published").lower() != "published":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product unavailable")

    return resolve_products_media(product, db)



@router.post("/{product_id}/qr-scan")
def track_qr_scan(product_id: str, db: Session = Depends(get_db)):
    """Record QR scan analytics event on backend."""
    try:
        query = db.query(Product)
        if product_id.isdigit():
            query = query.filter(Product.id == int(product_id))
        else:
            clean_slug = product_id.strip().lower()
            query = query.filter(
                or_(
                    func.replace(func.lower(Product.title), ' ', '-') == clean_slug,
                    func.lower(Product.title) == clean_slug.replace('-', ' ')
                )
            )
        product = query.first()

        if product:
            # Increment product views / downloads metric as proxy for QR interest
            product.views = (getattr(product, "views", 0) or 0) + 1
            db.commit()
            return {"status": "ok", "scanned_product_id": product.id}
    except Exception:
        pass
    return {"status": "ok"}



@router.get("/{product_id}/related", response_model=List[ProductResponse])
def get_related_products(product_id: int, limit: int = 4, db: Session = Depends(get_db)):
    """Return related products of the same category, excluding the product itself. Public."""
    from app.utils.db_sync import get_product_by_id
    product = get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    results = db.query(Product).filter(
        Product.category == product.category,
        Product.id != product_id,
        Product.status == "published"
    ).limit(limit).all()
    return resolve_products_media(results, db)


@router.get("/{product_id}/images", response_model=List[str])
def get_product_images(product_id: int, db: Session = Depends(get_db)):
    """Return screenshot/gallery URLs for the product. Public."""
    from app.utils.db_sync import get_product_by_id
    product = get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    # Matches the frontend gallery mapping fallbacks
    cat_gallery = {
        'UI Kits': [
            'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=85',
            'https://images.unsplash.com/photo-1587440871875-191322ee64b0?w=800&q=85',
            'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&q=85',
            'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&q=85'
        ],
        'Mobile App Designs': [
            'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&q=85',
            'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=800&q=85',
            'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&q=85',
            'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=85'
        ],
        'React Templates': [
            'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=85',
            'https://images.unsplash.com/photo-1593720213428-28a5b9e94613?w=800&q=85',
            'https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=800&q=85',
            'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=800&q=85'
        ],
        'Website Templates': [
            'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=800&q=85',
            'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&q=85',
            'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=800&q=85',
            'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=85'
        ],
        'Design Assets': [
            'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=85',
            'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800&q=85',
            'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=85',
            'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=800&q=85'
        ],
        'E-books': [
            'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=85',
            'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&q=85',
            'https://images.unsplash.com/photo-1432821596592-e2c18b78144f?w=800&q=85',
            'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=85'
        ],
        'Notion Templates': [
            'https://images.unsplash.com/photo-1517842645767-c639042777db?w=800&q=85',
            'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&q=85',
            'https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?w=800&q=85',
            'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=85'
        ],
        'Social Media Kits': [
            'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&q=85',
            'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&q=85',
            'https://images.unsplash.com/photo-1562577309-4932fdd64cd1?w=800&q=85',
            'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=800&q=85'
        ],
        'AI Tools': [
            'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&q=85',
            'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800&q=85',
            'https://images.unsplash.com/photo-1676277791608-ac54525aa94d?w=800&q=85',
            'https://images.unsplash.com/photo-1695654395926-68cefd20b6cc?w=800&q=85'
        ]
    }
    prod_category = str(getattr(product, "category", "") or "Design Assets")
    prod_preview = str(getattr(product, "preview", "") or 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=85')
    preview = resolve_media_url(prod_preview, prod_category) or prod_preview

    # Prefer explicitly stored image URLs list
    extra_images = []
    prod_image_urls = getattr(product, "image_urls", None)
    prod_preview_images = getattr(product, "preview_images", None)

    if prod_image_urls:
        extra_images = [resolve_media_url(str(url), prod_category) for url in (prod_image_urls or []) if url]
    elif prod_preview_images:
        extra_images = [resolve_media_url(str(url), prod_category) for url in (prod_preview_images or []) if url]

    if extra_images:
        all_images = [preview] + [img for img in extra_images if img and img != preview]
        return [img for img in all_images[:10]]

    cat_imgs = cat_gallery.get(prod_category) or cat_gallery.get('Design Assets') or []
    filtered_imgs = [img for img in cat_imgs if img != preview]
    return [preview] + filtered_imgs[:4]


def generate_download_token(user_id: int, product_id: int) -> str:
    # Token valid for 15 minutes
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    payload = {
        "sub": str(user_id),
        "product_id": product_id,
        "exp": expire,
        "type": "download"
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def verify_download_token(token: str, product_id: int) -> int:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "download":
            raise ValueError("Invalid token type")
        pid = payload.get("product_id")
        sub = payload.get("sub")
        if pid is None or int(pid) != product_id:
            raise ValueError("Token product mismatch")
        if sub is None:
            raise ValueError("Invalid subject in token")
        return int(sub)
    except JWTError:
        raise ValueError("Invalid or expired download token")


@router.get("/{product_id}/download")
def download_product(
    product_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Securely download a product. Returns detailed product info for popup display."""
    check_platform_paused()
    
    from app.utils.db_sync import get_product_by_id
    get_product_by_id(db, product_id)

    # Check if vendor is active and get vendor details
    product_with_vendor = db.query(Product, User.name.label("vendor_name")).outerjoin(
        User, Product.vendor_id == sql_cast(User.id, String)
    ).filter(
        Product.id == product_id,
        or_(User.id.is_(None), User.is_active.is_(True))
    ).first()
    
    if not product_with_vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found or vendor is disabled")
    
    product = product_with_vendor[0]
    vendor_name = product_with_vendor[1] or product.seller or "Unknown Vendor"

    # Check if the user has purchased this product
    owned = db.query(OrderItem).join(Order).filter(
        or_(Order.user_id == current_user.id, sql_cast(Order.user_id, String) == str(current_user.id)),
        or_(OrderItem.product_id == product_id, sql_cast(OrderItem.product_id, String) == str(product_id)),
        func.lower(Order.status).in_(["completed", "paid", "processing", "success"])
    ).first()
        
    is_owner = (str(product.vendor_id) == str(current_user.id)) or ((product.seller or "") == (current_user.name or ""))
    is_admin = (current_user.role or "") == "admin"
    
    if not owned and not is_owner and not is_admin:
        any_order = db.query(Order).filter(
            or_(Order.user_id == current_user.id, sql_cast(Order.user_id, String) == str(current_user.id)),
            func.lower(Order.status).in_(["completed", "paid", "processing", "success"])
        ).first()
        if not any_order:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must purchase this product to download it."
            )
    
    # Get user's download history for this product
    user_downloads = db.query(OrderItem).join(Order).filter(
        Order.user_id == current_user.id,
        OrderItem.product_id == product_id,
        Order.status.in_(["completed", "paid"])
    ).count()
    
    # Get last download time from downloads collection if exists
    last_downloaded = None
    if owned and hasattr(owned, "created_at"):
        created_at_val = getattr(owned, "created_at", None)
        last_downloaded = created_at_val.isoformat() if created_at_val else None
        
    token = generate_download_token(int(getattr(current_user, "id")), product_id)
    
    # Determine if the download asset is actually available
    download_available = bool(product.storage_path or product.file_url or getattr(product, "pcloud_download_link", None))
    
    response_data = {
        "download_url": f"/api/products/{product_id}/download-file?token={token}",
        "download_available": download_available,
        "product_details": {
            "id": product.id,
            "name": product.title,
            "category": product.category or "Uncategorized",
            "file_size": product.file_size or "Unknown size",
            "version": product.version or "v1.0.0",
            "thumbnail": product.thumbnail or product.preview,
            "vendor": vendor_name,
            "price": float(cast(Any, product.price or 0)),
            "description": product.description[:200] + "..." if product.description and len(product.description) > 200 else product.description
        },
        "download_stats": {
            "total_downloads": int(cast(Any, product.downloads or 0)),
            "your_downloads": user_downloads,
            "last_downloaded": last_downloaded
        },
        "token_expires_in": "15 minutes"
    }

    return response_data


@router.get("/downloads/center")
def get_download_center(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Get user's download center with all purchased products."""
    check_platform_paused()
    
    # Get all products the user has purchased
    purchased_items = db.query(
        OrderItem, Product, Order, User.name.label("vendor_name")
    ).join(
        Product, OrderItem.product_id == Product.id
    ).join(
        Order, OrderItem.order_id == Order.id
    ).outerjoin(
        User, Product.vendor_id == sql_cast(User.id, String)
    ).filter(
        Order.user_id == current_user.id,
        Order.status.in_(["completed", "paid"])
    ).order_by(Order.created_at.desc()).all()
    
    downloads = []
    for order_item, product, order, vendor_name in purchased_items:
        # Generate download token for each product
        token = generate_download_token(int(getattr(current_user, "id")), int(getattr(product, "id")))
        
        # Determine if the download asset is actually available
        download_available = bool(product.storage_path or product.file_url or getattr(product, "pcloud_download_link", None))
        
        downloads.append({
            "order_id": order.id,
            "purchase_date": order.created_at.isoformat() if order.created_at else None,
            "product_details": {
                "id": product.id,
                "name": product.title,
                "category": product.category or "Uncategorized",
                "file_size": product.file_size or "Unknown size",
                "version": product.version or "v1.0.0",
                "thumbnail": product.thumbnail or product.preview,
                "vendor": vendor_name or product.seller or "Unknown Vendor",
                "price_paid": float(cast(Any, order_item.price_paid or 0)),
                "description": product.description[:150] + "..." if product.description and len(product.description) > 150 else product.description
            },
            "download_url": f"/api/products/{product.id}/download-file?token={token}",
            "download_available": download_available,
            "can_download": True,
            "token_expires_in": "15 minutes"
        })
    
    # Get download statistics
    total_purchases = len(downloads)
    categories = list(set(d["product_details"]["category"] for d in downloads))
    total_value = sum(d["product_details"]["price_paid"] for d in downloads)
    
    return {
        "downloads": downloads,
        "statistics": {
            "total_purchases": total_purchases,
            "categories": categories,
            "total_value_purchased": total_value,
            "user_id": current_user.id,
            "user_name": current_user.name
        }
    }


@router.get("/{product_id}/download-file")
def download_product_file(
    product_id: int,
    token: str,
    db: Session = Depends(get_db)
):
    """
    Public proxy endpoint that verifies the 15-minute token query parameter.
    If valid, streams the file using FastAPI's StreamingResponse.
    """
    try:
        user_id = verify_download_token(token, product_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
        
    from app.utils.db_sync import get_product_by_id
    product = get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not found")

    owned = db.query(OrderItem).join(Order).filter(
        or_(Order.user_id == user_id, sql_cast(Order.user_id, String) == str(user_id)),
        or_(OrderItem.product_id == product_id, sql_cast(OrderItem.product_id, String) == str(product_id)),
        func.lower(Order.status).in_(["completed", "paid", "processing", "success"])
    ).first()

    is_owner = (str(product.vendor_id) == str(user_id)) or ((product.seller or "") == (user.name or ""))
    is_admin = (user.role or "") == "admin"

    if not owned and not is_owner and not is_admin:
        any_order = db.query(Order).filter(
            or_(Order.user_id == user_id, sql_cast(Order.user_id, String) == str(user_id)),
            func.lower(Order.status).in_(["completed", "paid", "processing", "success"])
        ).first()
        if not any_order:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must purchase this product to download it."
            )

    clean_title = str(product.title or f"Product-{product_id}")
    safe_title_base = re.sub(r'[^\w\s-]', '', clean_title).strip().replace(' ', '_') or f"product-{product_id}"

    storage_path = str(product.storage_path or product.file_url or getattr(product, "pcloud_download_link", "") or "")

    title_ext = os.path.splitext(clean_title)[1]
    raw_ext = os.path.splitext(storage_path)[1] if storage_path else ""

    if not raw_ext:
        if title_ext.lower() in [".zip", ".pdf", ".rar", ".7z", ".mp4", ".png", ".jpg", ".jpeg"]:
            raw_ext = title_ext.lower()

    if not raw_ext:
        raw_ext = ".zip"

    filename = f"{safe_title_base}{raw_ext}"
    guessed_type, _ = mimetypes.guess_type(filename)
    content_type = str(getattr(product, "content_type", None) or "")
    if not content_type or content_type in ["application/octet-stream", "binary/octet-stream"]:
        content_type = guessed_type or "application/octet-stream"

    stream = None
    first_chunk = None

    if storage_path:
        try:
            raw_stream = storage_service.get_stream(storage_path)
            if raw_stream:
                first_chunk = next(raw_stream, None)
                if first_chunk is not None:
                    initial_chunk: bytes = first_chunk
                    def safe_iter():
                        yield initial_chunk
                        try:
                            for chunk in raw_stream:
                                if chunk:
                                    yield chunk
                        except Exception as chunk_err:
                            print(f"[DownloadStream] Warning during chunk iteration for product {product_id}: {chunk_err}")
                    stream = safe_iter()
        except Exception as e:
            print(f"[DownloadStream] Physical file stream unavailable for path '{storage_path}': {e}")
            stream = None
            first_chunk = None

    if stream is None:
        if raw_ext == ".pdf":
            fallback_bytes = generate_fallback_pdf(clean_title, product_id)
            content_type = "application/pdf"
            filename = f"{safe_title_base}.pdf"
        else:
            zip_buf = io.BytesIO()
            readme_text = f"""===================================================================
{clean_title.upper()}
Lumora Digital Marketplace Asset Package
===================================================================

Product ID: {product_id}
Asset Title: {clean_title}
Downloaded At: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}
License: Personal & Commercial Digital License

Thank you for your purchase on Lumora!
"""
            with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:  # type: ignore
                zf.writestr("README_LICENSE.txt", readme_text)
                zf.writestr(f"{safe_title_base}_Guide.txt", f"Digital Asset Package for {clean_title}.\nVersion: 1.0.0\n")
            
            fallback_bytes = zip_buf.getvalue()
            content_type = "application/zip"
            filename = f"{safe_title_base}.zip"

        def iter_fallback_bytes():
            yield fallback_bytes

        stream = iter_fallback_bytes()

    return StreamingResponse(
        stream,
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


@router.get("/{product_id}/preview-stream")
def preview_product_stream(
    product_id: int,
    token: str,
    db: Session = Depends(get_db)
):
    """
    Secure online product preview proxy.
    Verifies ownership and stream authorization but DOES NOT write a download event,
    DOES NOT mark OrderItem as downloaded, and returns Content-Disposition: inline.
    Guarantees inline PDF/document/media streaming for online web document inspection.
    """
    try:
        user_id = verify_download_token(token, product_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
        
    from app.utils.db_sync import get_product_by_id
    product = get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not found")

    owned = db.query(OrderItem).join(Order).filter(
        Order.user_id == user_id,
        OrderItem.product_id == product_id,
        Order.status.in_(["completed", "paid"])
    ).first()

    is_owner = (str(getattr(product, "vendor_id", "")) == str(user_id)) or ((getattr(product, "seller", "") or "") == (getattr(user, "name", "") or ""))
    is_admin = (getattr(user, "role", "") or "") == "admin"

    if not owned and not is_owner and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to preview this product."
        )

    clean_title = str(getattr(product, "title", f"Product-{product_id}") or f"Product-{product_id}")
    safe_title_base = re.sub(r'[^\w\s-]', '', clean_title).strip().replace(' ', '_') or f"product-{product_id}"
    filename = f"{safe_title_base}.pdf"

    storage_path = str(product.storage_path or product.file_url or getattr(product, "pcloud_download_link", "") or "")
    storage_path_lower = storage_path.lower()
    file_url_lower = str(product.file_url or "").lower()

    is_archive = any(ext in storage_path_lower or ext in file_url_lower for ext in (".zip", ".rar", ".7z", ".tar", ".gz"))

    content_type = "application/pdf"
    if any(storage_path_lower.endswith(ext) for ext in (".png", ".jpg", ".jpeg", ".webp", ".gif")):
        ext = os.path.splitext(storage_path_lower)[1]
        content_type = f"image/{ext.replace('.', '').replace('jpg', 'jpeg')}"
        filename = f"{safe_title_base}{ext}"
    elif any(storage_path_lower.endswith(ext) for ext in (".mp4", ".webm")):
        ext = os.path.splitext(storage_path_lower)[1]
        content_type = f"video/{ext.replace('.', '')}"
        filename = f"{safe_title_base}{ext}"

    stream = None
    if storage_path and not is_archive:
        try:
            raw_stream = storage_service.get_stream(storage_path)
            if raw_stream:
                first_chunk = next(raw_stream, None)
                if first_chunk is not None:
                    initial_chunk: bytes = first_chunk
                    def safe_preview_iter():
                        yield initial_chunk
                        try:
                            for chunk in raw_stream:
                                if chunk:
                                    yield chunk
                        except Exception as chunk_err:
                            print(f"[PreviewStream] Warning during chunk iteration: {chunk_err}")
                    stream = safe_preview_iter()
        except Exception as e:
            print(f"[PreviewStream] Stream error for path '{storage_path}': {e}")
            stream = None

    if stream is None:
        fallback_bytes = generate_fallback_pdf(clean_title, product_id)
        content_type = "application/pdf"
        filename = f"{safe_title_base}.pdf"
        def iter_preview_pdf():
            yield fallback_bytes
        stream = iter_preview_pdf()

    return StreamingResponse(
        stream,
        media_type=content_type,
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "X-Frame-Options": "ALLOWALL",
            "Content-Security-Policy": "frame-ancestors 'self' https://*.vercel.app https://lumora-lemon-seven.vercel.app http://localhost:* http://127.0.0.1:*;",
        }
    )


@router.get("/{product_id}/refund-eligibility")
def get_refund_eligibility(
    product_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """
    Check if current user is eligible for refund on a given product.
    Evaluates backend PostgreSQL download events.
    """
    from app.models.product_download_event import ProductDownloadEvent
    
    owned = db.query(OrderItem).join(Order).filter(
        Order.user_id == current_user.id,
        OrderItem.product_id == product_id,
        Order.status == "completed"
    ).first()
    
    if not owned:
        return {
            "eligible": False,
            "status": "not_purchased",
            "reason": "Product has not been purchased by this user.",
            "download_count": 0,
            "first_downloaded_at": None
        }

    download_events = db.query(ProductDownloadEvent).filter(
        ProductDownloadEvent.user_id == current_user.id,
        ProductDownloadEvent.product_id == product_id
    ).order_by(ProductDownloadEvent.downloaded_at.asc()).all()

    download_count = len(download_events)
    first_downloaded_at = download_events[0].downloaded_at.isoformat() if download_events else None

    # Fallback to OrderItem.downloaded if download_events table is empty for legacy downloads
    is_downloaded = download_count > 0 or bool(owned.downloaded)

    if not is_downloaded:
        return {
            "eligible": True,
            "status": "eligible",
            "reason": "Product has been purchased and previewed, but never downloaded to device.",
            "download_count": 0,
            "first_downloaded_at": None
        }
    else:
        return {
            "eligible": False,
            "status": "ineligible_downloaded",
            "reason": "Product file has been downloaded to device. Refund requires admin review.",
            "download_count": max(download_count, 1 if owned.downloaded else 0),
            "first_downloaded_at": first_downloaded_at or (owned.order.created_at.isoformat() if owned.order else None)
        }


# -- Protected write endpoints (JWT required) ----------------------------------

@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
    _active = Depends(verify_vendor_active)
):
    """
    Create a new product.
    Requires a valid JWT. Only vendors (role='vendor') or admins may create products.
    """
    if current_user.role not in ("vendor", "affiliate", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors can create products.",
        )
    if product_in.price < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Price cannot be negative.",
        )
    if not product_in.title or not product_in.title.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Product title cannot be empty.",
        )

    if product_in.affiliate_enabled:
        comm_val = float(cast(Any, product_in.commission_value) or 0.0)
        prod_price = float(cast(Any, product_in.price) or 0.0)
        if comm_val < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Commission value cannot be negative."
            )
        if product_in.commission_type == "percentage":
            if comm_val > 100:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Commission percentage must be between 0 and 100."
                )
        elif product_in.commission_type == "fixed":
            if comm_val > prod_price:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Fixed commission cannot exceed the product price."
                )

    # -- IDEMPOTENCY: Double-click / network-retry protection ------------------
    # Guard applies to all products including free ones (price=0)
    # For admin users: use the platform sentinel as vendor_id so products are
    # correctly identified as Platform-owned by the admin products endpoint.
    # For vendor users: use their numeric user ID as vendor_id.
    role = (current_user.role or "").lower()
    if role == "admin":
        vendor_id = "lumora-creator"  # Platform sentinel — ensures admin products are retrievable
    else:
        vendor_id = str(current_user.id)

    window_start = datetime.now(timezone.utc) - timedelta(seconds=10)
    recent_duplicate = db.query(Product).filter(
        Product.vendor_id == vendor_id,
        Product.title == product_in.title.strip(),
        Product.price == product_in.price,
        Product.created_at >= window_start,
    ).first()
    if recent_duplicate:
        return recent_duplicate

    submitted_status = (product_in.status or "published").lower()
    if role == "admin":
        # Admin can set any valid status
        initial_status = submitted_status if submitted_status in ("published", "draft") else "published"
    else:
        # Vendors publish directly — respect submitted status (published/draft).
        # Only unknown/invalid status values fall back to pending_review.
        initial_status = submitted_status if submitted_status in ("published", "draft") else "pending_review"

    product = ProductService.create_product(
        db=db,
        vendor_id=vendor_id,
        owner_type="PLATFORM" if role == "admin" else "VENDOR",
        created_by_role="ADMIN" if role == "admin" else "VENDOR",
        is_platform_product=(role == "admin"),
        title=product_in.title,
        description=product_in.description or "",
        category=product_in.category or "General",
        price=product_in.price,
        temp_file_url=product_in.file_url,
        temp_preview_url=product_in.preview,
        temp_thumbnail_url=product_in.thumbnail,
        tags=product_in.tags,
        highlights=product_in.highlights,
        badge=product_in.badge,
        seller=str(product_in.seller or current_user.name),  # type: ignore
        affiliate_enabled=bool(product_in.affiliate_enabled) if product_in.affiliate_enabled is not None else False,  # type: ignore
        commission_type=product_in.commission_type or "percentage",
        commission_value=product_in.commission_value or 0.0,
        short_desc=product_in.short_desc,
        features=product_in.features,
        system_requirements=product_in.system_requirements,
        what_you_get=product_in.what_you_get,
        installation_guide=product_in.installation_guide,
        subcategory=product_in.subcategory,
        discount=product_in.discount,
        preview_images=product_in.preview_images,
        preview_video=product_in.preview_video,
        seo_title=product_in.seo_title,
        seo_description=product_in.seo_description,
        visibility=product_in.visibility or "public",
        status=initial_status,
        image_urls=[],
    )

    # Structured log
    from app.utils.logger import log_structured_event
    log_structured_event(
        user_id=int(getattr(current_user, "id")),
        role=str(getattr(current_user, "role")),
        action="product_created",
        module="products",
        status="success",
        details=f"Product '{product.title}' (ID {product.id}) created by vendor {vendor_id} with status '{initial_status}'",
    )

    return product


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_in: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
    _active = Depends(verify_vendor_active)
):
    """
    Update an existing product (partial update - only provided fields are changed).
    Requires a valid JWT. Only product owner (vendor) or admin may update products.
    """
    if current_user.role not in ("vendor", "affiliate", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors can update products.",
        )

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    # Resource ownership check
    user_uid = str(current_user.id)
    if (current_user.role or "") != "admin" and (str(product.vendor_id) != user_uid and (product.seller or "") != (current_user.name or "")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this product.",
        )

    if product_in.price is not None and product_in.price < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Price cannot be negative.",
        )

    aff_enabled = product_in.affiliate_enabled if product_in.affiliate_enabled is not None else bool(getattr(product, "affiliate_enabled", False))
    comm_type = product_in.commission_type if product_in.commission_type is not None else str(getattr(product, "commission_type", "percentage"))
    comm_value = float(cast(Any, product_in.commission_value) or getattr(product, "commission_value", 0.0) or 0.0)
    prod_price = float(cast(Any, product_in.price) or getattr(product, "price", 0.0) or 0.0)

    if aff_enabled:
        if comm_value < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Commission value cannot be negative."
            )
        if comm_type == "percentage":
            if comm_value > 100:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Commission percentage must be between 0 and 100."
                )
        elif comm_type == "fixed":
            if comm_value > prod_price:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Fixed commission cannot exceed the product price."
                )

    update_data = product_in.model_dump(exclude_none=True)
    return ProductService.update_product(
        db=db,
        product_id=product_id,
        vendor_id=user_uid,
        update_data=update_data
    )


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
    _active = Depends(verify_vendor_active)
):
    """
    Delete a product.
    Requires a valid JWT. Only product owner (vendor) or admin may delete products.
    """
    if current_user.role not in ("vendor", "affiliate", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors can delete products.",
        )

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    # Resource ownership check
    user_uid = str(current_user.id)
    if (current_user.role or "") != "admin" and (str(product.vendor_id) != user_uid and (product.seller or "") != (current_user.name or "")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this product.",
        )

    ProductService.archive_product(
        db=db,
        product_id=product_id,
        vendor_id=user_uid
    )
    return None


@router.get("/purchase-complete/{order_id}")
def get_purchase_complete_popup(
    order_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """
    Get post-purchase download popup data for navigation to downloads section.
    Called after successful payment to show download popup with product details.
    """
    check_platform_paused()
    
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id,
        Order.status.in_(["completed", "paid"])
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found or not accessible"
        )
    
    order_items_with_details = db.query(
        OrderItem, Product, User.name.label("vendor_name")
    ).join(
        Product, OrderItem.product_id == Product.id
    ).outerjoin(
        User, Product.vendor_id == sql_cast(User.id, String)
    ).filter(
        OrderItem.order_id == order_id
    ).all()
    
    popup_products = []
    total_value = 0.0
    
    for order_item, product, vendor_name in order_items_with_details:
        token = generate_download_token(int(getattr(current_user, "id")), int(getattr(product, "id")))
        download_url = f"/api/products/{product.id}/download-file?token={token}"
        
        popup_products.append({
            "product_id": product.id,
            "name": product.title or "Untitled",
            "category": product.category or "Uncategorized",
            "file_size": product.file_size or "Unknown size",
            "version": product.version or "v1.0.0",
            "thumbnail": product.thumbnail or product.preview,
            "vendor": vendor_name or product.seller or "Unknown Vendor",
            "price_paid": float(cast(Any, order_item.price_paid or 0)),
            "description": product.description[:100] + "..." if product.description and len(product.description) > 100 else product.description,
            "download_url": download_url,
            "auto_download": False,  # Automatic device downloads disabled per project policy
            "token_expires_in": "15 minutes"
        })
        total_value += float(cast(Any, order_item.price_paid or 0))
    
    return {
        "success": True,
        "popup_type": "post_purchase_download",
        "order_details": {
            "order_id": order.id,
            "order_reference": f"ORD-{order.id}",
            "purchase_date": order.created_at.isoformat() if order.created_at else None,
            "total_items": len(popup_products),
            "total_value": total_value,
            "customer_name": current_user.name
        },
        "products": popup_products,
        "popup_actions": {
            "download_all": True,
            "go_to_downloads": "/downloads",
            "continue_shopping": "/products"
        },
        "messages": {
            "title": "Purchase Complete!",
            "subtitle": f"Your {len(popup_products)} product{'s' if len(popup_products) > 1 else ''} {'are' if len(popup_products) > 1 else 'is'} ready for download",
            "download_message": "You can access and download all your purchases in the Downloads section of your dashboard.",
            "thank_you": "Thank you for your purchase!"
        }
    }


@router.post("/bulk-affiliate")
def bulk_update_affiliate_settings(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_required)
):
    """
    Bulk update product affiliate settings.
    Requires Admin privileges.
    """
    if current_user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin permissions required")

    product_ids = payload.get("product_ids", [])
    if not product_ids:
        raise HTTPException(status_code=400, detail="No product_ids provided")

    enabled = payload.get("affiliate_enabled", True)
    mode = payload.get("commission_mode", "percentage")
    value = float(payload.get("commission_value", 0.0))
    cookie_days = int(payload.get("cookie_days", 30))
    status_val = payload.get("status", "active")

    if enabled:
        if value <= 0:
            raise HTTPException(status_code=422, detail="Commission value must be greater than 0 when enabling affiliate program.")
        if mode == "percentage" and value > 100:
            raise HTTPException(status_code=422, detail="Percentage commission cannot exceed 100%.")

    updated_count = 0
    try:
        products = db.query(Product).filter(Product.id.in_(product_ids)).all()
        for p in products:
            setattr(p, "affiliate_enabled", enabled)
            setattr(p, "commission_mode", mode)
            setattr(p, "commission_type", mode)
            setattr(p, "commission_value", value)
            setattr(p, "affiliate_cookie_days", cookie_days)
            setattr(p, "affiliate_program_status", status_val)
            updated_count += 1
        db.commit()

        from app.services.activity_log_service import ActivityLogService
        ActivityLogService.log_admin_audit(
            db=db,
            admin_user_id=int(getattr(current_user, "id")),
            action="bulk_affiliate_update",
            target_type="products",
            target_id=str(product_ids),
            metadata_dict={
                "enabled": enabled,
                "mode": mode,
                "value": value,
                "count": updated_count
            }
        )

        return {"success": True, "updated_count": updated_count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Bulk update failed: {str(e)}")
