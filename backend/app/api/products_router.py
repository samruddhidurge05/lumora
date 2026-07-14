from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from sqlalchemy import cast, String, or_
from app.db.session import get_db
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
from app.core.config import settings
from app.services.product_service import ProductService
from app.services.storage_service import storage_service

router = APIRouter()

import urllib.parse as urlparse
import requests

_PCLOUD_URL_CACHE = {}

def resolve_pcloud_direct_url(url: Optional[str]) -> Optional[str]:
    if not url or "pcloud" not in url:
        return url
    if url in _PCLOUD_URL_CACHE:
        return _PCLOUD_URL_CACHE[url]
    
    try:
        parsed = urlparse.urlparse(url)
        params = urlparse.parse_qs(parsed.query)
        code = params.get("code")
        if not code:
            return url
        code_str = code[0]
        
        # Call pCloud API
        res = requests.get(f"https://api.pcloud.com/getpublinkdownload?code={code_str}", timeout=2)
        data = res.json()
        if data.get("result") == 0 and data.get("hosts") and data.get("path"):
            host = data["hosts"][0]
            path = data["path"]
            resolved = f"https://{host}{path}"
            _PCLOUD_URL_CACHE[url] = resolved
            return resolved
    except Exception as e:
        print(f"[pCloud-Resolve] Error: {e}")
    return url

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def resolve_media_url(url: Optional[str], category: Optional[str] = None) -> Optional[str]:
    if not url:
        return url
        
    # 1. Handle pCloud / external URLs
    if "pcloud" in url or "publink" in url:
        return resolve_pcloud_direct_url(url)
        
    # 2. Check if it's a local upload URL
    url_lower = url.lower()
    if "/uploads/" in url_lower:
        try:
            path_part = url.split("/uploads/", 1)[1]
            relative_filepath = os.path.join("uploads", path_part)
            absolute_filepath = os.path.abspath(os.path.join(_BACKEND_DIR, relative_filepath))
            
            if not os.path.exists(absolute_filepath):
                # File is missing! Return a beautiful Unsplash placeholder based on category
                placeholders = {
                    "templates": "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=800&q=80",
                    "graphics & ui": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
                    "productivity tools": "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=800&q=80",
                    "notion templates": "https://images.unsplash.com/photo-1618005198143-e5283b519a7f?auto=format&fit=crop&w=800&q=80",
                    "productivity systems": "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=800&q=80",
                    "design assets": "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=800&q=80",
                }
                cat_key = (category or "").lower().strip()
                return placeholders.get(cat_key, "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80")
        except Exception:
            pass
            
    return url

def resolve_product_media(product, db):
    from sqlalchemy.orm import make_transient
    try:
        db.expunge(product)
        make_transient(product)
    except Exception:
        pass
        
    product.thumbnail = resolve_media_url(product.thumbnail, product.category)
    product.preview = resolve_media_url(product.preview, product.category)
    
    if product.image_urls:
        product.image_urls = [resolve_media_url(url, product.category) for url in product.image_urls]
    if product.preview_images:
        product.preview_images = [resolve_media_url(url, product.category) for url in product.preview_images]
        
    return product

def resolve_products_media(products, db):
    if isinstance(products, list):
        return [resolve_product_media(p, db) for p in products]
    elif products:
        return resolve_product_media(products, db)
    return products

# ── Public read endpoints (no auth) ──────────────────────────────────────────

@router.get("/", response_model=List[ProductResponse])
def read_products(
    category: Optional[str] = None,
    skip: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db)
):
    """List all published products. Public — no authentication required."""
    query = db.query(Product).outerjoin(User, Product.vendor_id == cast(User.id, String)).filter(
        Product.status == "published",
        or_(User.id == None, User.is_active == True)
    ).order_by(Product.id.desc())
    if category and category != "All":
        query = query.filter(Product.category == category)
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
    """Get a single product by ID. Public — no authentication required."""
    product = db.query(Product).outerjoin(User, Product.vendor_id == cast(User.id, String)).filter(
        Product.id == product_id,
        or_(User.id == None, User.is_active == True)
    ).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return resolve_products_media(product, db)


@router.get("/{product_id}/related", response_model=List[ProductResponse])
def get_related_products(product_id: int, limit: int = 4, db: Session = Depends(get_db)):
    """Return related products of the same category, excluding the product itself. Public."""
    product = db.query(Product).filter(Product.id == product_id).first()
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
    product = db.query(Product).filter(Product.id == product_id).first()
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

    # Prefer explicitly stored pCloud/external image URLs list
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
    from app.services.product_service import _is_external_url
    has_pcloud = bool(product.pcloud_download_link and _is_external_url(product.pcloud_download_link))
    has_file = bool(product.storage_path or product.file_url)
    download_available = has_pcloud or has_file
    
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

    if has_pcloud:
        response_data["type"] = "external"
        response_data["redirect_url"] = product.pcloud_download_link

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
        from app.services.product_service import _is_external_url
        has_pcloud = bool(product.pcloud_download_link and _is_external_url(product.pcloud_download_link))
        has_file = bool(product.storage_path or product.file_url)
        download_available = has_pcloud or has_file
        
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
        
    product = db.query(Product).filter(Product.id == product_id).first()
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

    # ── pCloud / External URL Delivery (temporary, ~2-3 weeks) ──────────────
    # If a pCloud download link is stored, return it directly so the browser
    # can open it.  Future migration: just update the stored URL, no code change.
    from app.services.product_service import _is_external_url
    pcloud_link = product.pcloud_download_link
    if pcloud_link and _is_external_url(pcloud_link):
        if owned:
            owned.downloaded = True
        product.downloads = (product.downloads or 0) + 1
        
        # Log download activity in SQLite!
        from app.services.activity_log_service import ActivityLogService
        ActivityLogService.log_user_activity(
            db=db,
            user_id=user_id,
            activity_type="download",
            details=f"Downloaded product '{product.title}' (ID {product.id})."
        )
        db.commit()

        from fastapi.responses import JSONResponse
        return JSONResponse(content={
            "redirect_url": pcloud_link,
            "type": "external",
            "product_title": product.title,
        })

    storage_path = product.storage_path
    if not storage_path:
        # Fallback to file_url if storage_path not set
        storage_path = product.file_url
        if not storage_path:
            # ── Download Pending state ────────────────────────────────────────────
            # The customer owns this product but the creator has not yet uploaded
            # the downloadable asset.  Return a structured "pending" response so
            # the frontend can display a professional message instead of an error.
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=200,
                content={
                    "type": "pending",
                    "product_title": product.title,
                    "message": (
                        "The creator has not uploaded the downloadable asset yet. "
                        "Your purchase is secure and your ownership has been verified. "
                        "Once the creator uploads the file, it will automatically become "
                        "available in your Downloads. Thank you for your patience."
                    ),
                }
            )

    if owned:
        owned.downloaded = True

    # Increment download count on actual file download
    product.downloads = (product.downloads or 0) + 1

    # Log download activity in SQLite!
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
    
    return StreamingResponse(
        storage_service.get_stream(storage_path),
        media_type=content_type,
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


# ── Protected write endpoints (JWT required) ──────────────────────────────────

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

    # ── IDEMPOTENCY: Double-click / network-retry protection ──────────────────
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
        # ── pCloud / External URL Delivery (temporary, ~2-3 weeks) ─────────────
        pcloud_download_link=product_in.pcloud_download_link,
        image_urls=product_in.image_urls,
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
    Update an existing product (partial update — only provided fields are changed).
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
            "title": "🎉 Purchase Complete!",
            "subtitle": f"Your {len(popup_products)} product{'s' if len(popup_products) > 1 else ''} {'are' if len(popup_products) > 1 else 'is'} ready for download",
            "download_message": "Your download will start automatically. You can also access all your purchases in the Downloads section.",
            "thank_you": "Thank you for your purchase!"
        }
    }
