from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from sqlalchemy import cast, String, or_
from app.db.session import get_db, SessionLocal
from app.models.product import Product
from app.models.user import User
from app.models.order import Order, OrderItem
from app.schemas.schemas import ProductCreate, ProductResponse, ProductUpdate
from app.dependencies import get_current_user_required
from admin.validators.status_checks import verify_vendor_active, check_platform_paused
from app.core.exceptions import LumoraException
from jose import jwt, JWTError
from datetime import datetime, timedelta
import os
import time
from app.core.config import settings
from app.services.product_service import ProductService
from app.services.storage_service import storage_service
from admin.firestore.admin_firestore import restore_sqlite_products_from_firestore

router = APIRouter()

import urllib.parse as urlparse
import requests

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

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def resolve_media_url(url: str, category: str = None) -> Optional[str]:
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
    import mimetypes
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
    query = db.query(Product).outerjoin(User, Product.vendor_id == cast(User.id, String)).filter(
        Product.status == "published",
        or_(User.id == None, User.is_active == True)
    )
    if affiliate_only or affiliate_enabled is True:
        query = query.filter(Product.affiliate_enabled == True)
    if category and category != "All":
        query = query.filter(Product.category == category)
    query = query.order_by(Product.id.desc())
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
    query = db.query(Product).outerjoin(User, Product.vendor_id == cast(User.id, String)).filter(
        Product.status == "published",
        or_(User.id == None, User.is_active == True)
    ).order_by(Product.id.desc())
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
        products = sorted(products, key=lambda p: p.price)
    elif sort == "price-desc":
        products = sorted(products, key=lambda p: p.price, reverse=True)
    elif sort == "rating":
        products = sorted(products, key=lambda p: (p.rating or 0), reverse=True)
    elif sort == "popular":
        products = sorted(products, key=lambda p: (p.downloads or 0), reverse=True)
    elif sort == "newest":
        products = sorted(products, key=lambda p: p.created_at, reverse=True)
    else:  # featured
        products = sorted(products, key=lambda p: (p.featured or False), reverse=True)

    results = products[skip : skip + limit]
    return resolve_products_media(results, db)


@router.get("/featured", response_model=List[ProductResponse])
def get_featured_products(limit: int = 8, db: Session = Depends(get_db)):
    """Return featured products."""
    results = db.query(Product).outerjoin(User, Product.vendor_id == cast(User.id, String)).filter(
        Product.featured == True,
        Product.status == "published",
        or_(User.id == None, User.is_active == True)
    ).limit(limit).all()
    return resolve_products_media(results, db)


@router.get("/trending", response_model=List[ProductResponse])
def get_trending_products(limit: int = 8, db: Session = Depends(get_db)):
    """Return trending products sorted by downloads."""
    results = db.query(Product).outerjoin(User, Product.vendor_id == cast(User.id, String)).filter(
        Product.trending == True,
        Product.status == "published",
        or_(User.id == None, User.is_active == True)
    ).order_by(Product.downloads.desc()).limit(limit).all()
    return resolve_products_media(results, db)


@router.get("/categories", response_model=List[str])
def get_product_categories(db: Session = Depends(get_db)):
    """Return all unique categories from published products. Public."""
    categories = db.query(Product.category).outerjoin(User, Product.vendor_id == cast(User.id, String)).filter(
        Product.status == "published",
        or_(User.id == None, User.is_active == True)
    ).distinct().all()
    return [c[0] for c in categories if c[0]]


@router.get("/{product_id}", response_model=ProductResponse)
def read_product(product_id: str, db: Session = Depends(get_db)):
    """Get a single product by ID. Public - no authentication required."""
    try:
        pid = int(product_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    from app.utils.db_sync import get_product_by_id
    get_product_by_id(db, pid)

    product = db.query(Product).outerjoin(User, Product.vendor_id == cast(User.id, String)).filter(
        Product.id == pid,
        or_(User.id == None, User.is_active == True)
    ).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return resolve_products_media(product, db)


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
    preview = resolve_media_url(product.preview or 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=85', product.category)

    # Prefer explicitly stored image URLs list
    extra_images = []
    if product.image_urls:
        extra_images = [resolve_media_url(url, product.category) for url in product.image_urls if url]
    elif product.preview_images:
        extra_images = [resolve_media_url(url, product.category) for url in product.preview_images if url]

    if extra_images:
        all_images = [preview] + [img for img in extra_images if img != preview]
        return all_images[:10]

    cat_imgs = cat_gallery.get(product.category) or cat_gallery.get('Design Assets')
    filtered_imgs = [img for img in cat_imgs if img != preview]
    return [preview] + filtered_imgs[:4]


def generate_download_token(user_id: int, product_id: int) -> str:
    # Token valid for 15 minutes
    expire = datetime.utcnow() + timedelta(minutes=15)
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
        if int(payload.get("product_id")) != product_id:
            raise ValueError("Token product mismatch")
        return int(payload.get("sub"))
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
        User, Product.vendor_id == cast(User.id, String)
    ).filter(
        Product.id == product_id,
        or_(User.id == None, User.is_active == True)
    ).first()
    
    if not product_with_vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found or vendor is disabled")
    
    product = product_with_vendor[0]
    vendor_name = product_with_vendor[1] or product.seller or "Unknown Vendor"

    # Check if the user has purchased this product
    owned = db.query(OrderItem).join(Order).filter(
        Order.user_id == current_user.id,
        OrderItem.product_id == product_id,
        Order.status == "completed"
    ).first()
        
    is_owner = (str(product.vendor_id) == str(current_user.id)) or (product.seller == current_user.name)
    is_admin = (current_user.role == "admin")
    
    if not owned and not is_owner and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must purchase this product to download it."
        )
    
    # Get user's download history for this product
    user_downloads = db.query(OrderItem).join(Order).filter(
        Order.user_id == current_user.id,
        OrderItem.product_id == product_id,
        Order.status == "completed"
    ).count()
    
    # Get last download time from downloads collection if exists
    from datetime import datetime
    last_downloaded = None
    if owned:
        last_downloaded = owned.created_at.isoformat() if owned.created_at else None
        
    token = generate_download_token(current_user.id, product_id)
    
    # Determine if the download asset is actually available
    has_b2 = bool((product.storage_path and "b2://" in product.storage_path) or (product.file_url and "backblazeb2.com" in product.file_url))
    has_local = bool((product.storage_path and "local://" in product.storage_path) or (product.file_url and "/uploads/" in product.file_url))
    download_available = has_b2 or has_local
    
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
            "price": float(product.price or 0),
            "description": product.description[:200] + "..." if product.description and len(product.description) > 200 else product.description
        },
        "download_stats": {
            "total_downloads": product.downloads or 0,
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
        User, Product.vendor_id == cast(User.id, String)
    ).filter(
        Order.user_id == current_user.id,
        Order.status == "completed"
    ).order_by(Order.created_at.desc()).all()
    
    downloads = []
    for order_item, product, order, vendor_name in purchased_items:
        # Generate download token for each product
        token = generate_download_token(current_user.id, product.id)
        
        # Determine if the download asset is actually available
        has_b2 = bool((product.storage_path and "b2://" in product.storage_path) or (product.file_url and "backblazeb2.com" in product.file_url))
        has_local = bool((product.storage_path and "local://" in product.storage_path) or (product.file_url and "/uploads/" in product.file_url))
        download_available = has_b2 or has_local
        
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
                "price_paid": float(order_item.price_paid or 0),
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
        Order.user_id == user_id,
        OrderItem.product_id == product_id,
        Order.status == "completed"
    ).first()

    is_owner = (str(product.vendor_id) == str(user_id)) or (product.seller == user.name)
    is_admin = (user.role == "admin")

    if not owned and not is_owner and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to download this product."
        )

    storage_path = product.storage_path or product.file_url
    has_b2 = bool((product.storage_path and "b2://" in product.storage_path) or (product.file_url and "backblazeb2.com" in product.file_url))
    has_local = bool((product.storage_path and "local://" in product.storage_path) or (product.file_url and "/uploads/" in product.file_url))
    
    if not storage_path or not (has_b2 or has_local):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product file is currently unavailable."
        )

    if owned:
        owned.downloaded = True

    # Increment download count on actual file download
    product.downloads = (product.downloads or 0) + 1

    # Record permanent ProductDownloadEvent in PostgreSQL
    try:
        from app.models.product_download_event import ProductDownloadEvent
        order_id_val = owned.order_id if owned else 0
        if not order_id_val:
            first_item = db.query(OrderItem).filter(OrderItem.product_id == product_id).first()
            if first_item:
                order_id_val = first_item.order_id
        download_event = ProductDownloadEvent(
            user_id=user_id,
            order_id=order_id_val or 0,
            product_id=product_id,
            downloaded_at=datetime.utcnow(),
            created_at=datetime.utcnow()
        )
        db.add(download_event)
    except Exception as dl_evt_err:
        print(f"[DownloadEvent] Warning: Failed to record download event for product {product_id}: {dl_evt_err}")

    # Log download activity
    from app.services.activity_log_service import ActivityLogService
    ActivityLogService.log_user_activity(
        db=db,
        user_id=user_id,
        activity_type="download",
        details=f"Downloaded product '{product.title}' (ID {product.id})."
    )
    db.commit()

    # Stream the file bytes using our StorageService!
    from fastapi.responses import StreamingResponse
    filename = f"product-{product_id}.zip"
    if product.file_url:
        import os
        filename = os.path.basename(product.file_url.split("?")[0])
        if not filename or not os.path.splitext(filename)[1]:
            filename = f"product-{product_id}.zip"
            
    content_type = product.content_type or "application/octet-stream"
    
    try:
        stream = storage_service.get_stream(storage_path)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DownloadError] Stream error for path {storage_path}: {e}")
        raise HTTPException(status_code=404, detail="Product file is currently missing or unavailable from storage.")

    return StreamingResponse(
        stream,
        media_type=content_type,
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
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
        Order.status == "completed"
    ).first()

    is_owner = (str(product.vendor_id) == str(user_id)) or (product.seller == user.name)
    is_admin = (user.role == "admin")

    if not owned and not is_owner and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to preview this product."
        )

    storage_path = product.storage_path or product.file_url
    has_b2 = bool((product.storage_path and "b2://" in product.storage_path) or (product.file_url and "backblazeb2.com" in product.file_url))
    has_local = bool((product.storage_path and "local://" in product.storage_path) or (product.file_url and "/uploads/" in product.file_url))
    
    if not storage_path or not (has_b2 or has_local):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product file is currently unavailable for preview."
        )

    import os
    filename = f"preview-{product_id}"
    if product.file_url:
        filename = os.path.basename(product.file_url.split("?")[0])

    content_type = product.content_type
    if not content_type:
        ext = os.path.splitext(filename)[1].lower()
        if ext == ".pdf":
            content_type = "application/pdf"
        elif ext in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
            content_type = f"image/{ext.replace('.', '').replace('jpg', 'jpeg')}"
        elif ext in (".mp4", ".webm"):
            content_type = f"video/{ext.replace('.', '')}"
        elif ext in (".mp3", ".wav", ".ogg"):
            content_type = f"audio/{ext.replace('.', '')}"
        elif ext in (".txt", ".html", ".css", ".js", ".json"):
            content_type = "text/plain"
        else:
            content_type = "application/octet-stream"

    try:
        stream = storage_service.get_stream(storage_path)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[PreviewError] Stream error for path {storage_path}: {e}")
        raise HTTPException(status_code=404, detail="Product file is currently missing or unavailable from storage.")

    return StreamingResponse(
        stream,
        media_type=content_type,
        headers={
            "Content-Disposition": f"inline; filename={filename}"
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
    is_downloaded = download_count > 0 or owned.downloaded

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
    if current_user.role not in ("vendor", "admin"):
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
        if product_in.commission_value < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Commission value cannot be negative."
            )
        if product_in.commission_type == "percentage":
            if product_in.commission_value > 100:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Commission percentage must be between 0 and 100."
                )
        elif product_in.commission_type == "fixed":
            if product_in.commission_value > product_in.price:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Fixed commission cannot exceed the product price."
                )

    # -- IDEMPOTENCY: Double-click / network-retry protection ------------------
    # Only deduplicate if same vendor, title, AND price > 0 within 10 seconds.
    # Zero-price products are excluded to avoid blocking legitimate re-submissions
    # after a failed form save.
    vendor_id = str(current_user.id)
    from datetime import datetime, timedelta
    window_start = datetime.utcnow() - timedelta(seconds=10)
    recent_duplicate = None
    if product_in.price > 0:
        recent_duplicate = db.query(Product).filter(
            Product.vendor_id == vendor_id,
            Product.title == product_in.title.strip(),
            Product.price == product_in.price,
            Product.created_at >= window_start,
        ).first()
    if recent_duplicate:
        return recent_duplicate

    role = (current_user.role or "").lower()
    # For admins: respect the submitted status (published / draft).
    # For vendors: always start at pending_review regardless of submitted value.
    if role == "admin":
        submitted_status = (product_in.status or "published").lower()
        initial_status = submitted_status if submitted_status in ("published", "draft") else "published"
    else:
        initial_status = "pending_review"

    product = ProductService.create_product(
        db=db,
        vendor_id=vendor_id,
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
        seller=product_in.seller or current_user.name,
        affiliate_enabled=product_in.affiliate_enabled,
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
        user_id=current_user.id,
        role=current_user.role,
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
    if current_user.role not in ("vendor", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors can update products.",
        )

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    # Resource ownership check
    user_uid = str(current_user.id)
    if current_user.role != "admin" and (product.vendor_id != user_uid and product.seller != current_user.name):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this product.",
        )

    if product_in.price is not None and product_in.price < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Price cannot be negative.",
        )

    aff_enabled = product_in.affiliate_enabled if product_in.affiliate_enabled is not None else product.affiliate_enabled
    comm_type = product_in.commission_type if product_in.commission_type is not None else product.commission_type
    comm_value = product_in.commission_value if product_in.commission_value is not None else product.commission_value
    prod_price = product_in.price if product_in.price is not None else product.price

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
    if current_user.role not in ("vendor", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors can delete products.",
        )

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    # Resource ownership check
    user_uid = str(current_user.id)
    if current_user.role != "admin" and (product.vendor_id != user_uid and product.seller != current_user.name):
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
    Get post-purchase download popup data for immediate download and navigation to downloads section.
    Called after successful payment to show download popup with product details.
    """
    check_platform_paused()
    
    # Verify the order belongs to the current user
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id,
        Order.status == "completed"
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found or not accessible"
        )
    
    # Get all order items with product and vendor details
    order_items_with_details = db.query(
        OrderItem, Product, User.name.label("vendor_name")
    ).join(
        Product, OrderItem.product_id == Product.id
    ).outerjoin(
        User, Product.vendor_id == cast(User.id, String)
    ).filter(
        OrderItem.order_id == order_id
    ).all()
    
    popup_products = []
    total_value = 0
    
    for order_item, product, vendor_name in order_items_with_details:
        # Generate download token for immediate download
        token = generate_download_token(current_user.id, product.id)
        download_url = f"/api/products/{product.id}/download-file?token={token}"
        
        popup_products.append({
            "product_id": product.id,
            "name": product.name or product.title,
            "category": product.category or "Uncategorized",
            "file_size": product.file_size or "Unknown size",
            "version": product.version or "v1.0.0",
            "thumbnail": product.thumbnail or product.preview,
            "vendor": vendor_name or product.seller or "Unknown Vendor",
            "price_paid": float(order_item.price_paid or 0),
            "description": product.description[:100] + "..." if product.description and len(product.description) > 100 else product.description,
            "download_url": download_url,
            "auto_download": True,  # Trigger automatic download
            "token_expires_in": "15 minutes"
        })
        total_value += float(order_item.price_paid or 0)
    
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
            "download_all": True,  # Enable bulk download
            "go_to_downloads": "/downloads",  # Navigation URL
            "continue_shopping": "/products"  # Continue shopping URL
        },
        "messages": {
            "title": "Purchase Complete!",
            "subtitle": f"Your {len(popup_products)} product{'s' if len(popup_products) > 1 else ''} {'are' if len(popup_products) > 1 else 'is'} ready for download",
            "download_message": "Your download will start automatically. You can also access all your purchases in the Downloads section.",
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
    Payload:
      {
        "product_ids": [1, 2, 3],
        "affiliate_enabled": bool,
        "commission_mode": "percentage" | "fixed",
        "commission_value": float,
        "cookie_days": int,
        "status": "active" | "paused"
      }
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
            p.affiliate_enabled = enabled
            p.commission_mode = mode
            p.commission_type = mode
            p.commission_value = value
            p.affiliate_cookie_days = cookie_days
            p.affiliate_program_status = status_val
            updated_count += 1
        db.commit()

        from app.services.activity_log_service import ActivityLogService
        ActivityLogService.log_admin_audit(
            db=db,
            admin_user_id=current_user.id,
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
