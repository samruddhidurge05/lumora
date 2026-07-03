from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from sqlalchemy import cast, String
from app.db.session import get_db
from app.models.product import Product
from app.models.user import User
from app.models.order import Order, OrderItem
from app.schemas.schemas import ProductCreate, ProductResponse, ProductUpdate
from app.dependencies import get_current_user_required
from admin.validators.status_checks import verify_vendor_active, check_platform_paused
from app.core.exceptions import LumoraException

router = APIRouter()

# ── Public read endpoints (no auth) ──────────────────────────────────────────

@router.get("/", response_model=List[ProductResponse])
def read_products(
    category: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all published products. Public — no authentication required."""
    query = db.query(Product).join(User, Product.vendor_id == cast(User.id, String)).filter(
        Product.status == "published",
        User.is_active == True
    )
    if category and category != "All":
        query = query.filter(Product.category == category)
    return query.offset(skip).limit(limit).all()


@router.get("/search")
def search_products(
    q: Optional[str] = None,
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort: Optional[str] = "featured",
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Full-text search products. Public."""
    query = db.query(Product).join(User, Product.vendor_id == cast(User.id, String)).filter(
        Product.status == "published",
        User.is_active == True
    )
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

    return products[skip : skip + limit]


@router.get("/featured", response_model=List[ProductResponse])
def get_featured_products(limit: int = 8, db: Session = Depends(get_db)):
    """Return featured products."""
    return db.query(Product).join(User, Product.vendor_id == cast(User.id, String)).filter(
        Product.featured == True,
        Product.status == "published",
        User.is_active == True
    ).limit(limit).all()


@router.get("/trending", response_model=List[ProductResponse])
def get_trending_products(limit: int = 8, db: Session = Depends(get_db)):
    """Return trending products sorted by downloads."""
    return db.query(Product).join(User, Product.vendor_id == cast(User.id, String)).filter(
        Product.trending == True,
        Product.status == "published",
        User.is_active == True
    ).order_by(Product.downloads.desc()).limit(limit).all()


@router.get("/categories", response_model=List[str])
def get_product_categories(db: Session = Depends(get_db)):
    """Return all unique categories from published products. Public."""
    categories = db.query(Product.category).join(User, Product.vendor_id == cast(User.id, String)).filter(
        Product.status == "published",
        User.is_active == True
    ).distinct().all()
    return [c[0] for c in categories if c[0]]


@router.get("/{product_id}", response_model=ProductResponse)
def read_product(product_id: str, db: Session = Depends(get_db)):
    """Get a single product by ID. Public — no authentication required."""
    product = db.query(Product).join(User, Product.vendor_id == cast(User.id, String)).filter(
        Product.id == product_id,
        User.is_active == True
    ).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.get("/{product_id}/related", response_model=List[ProductResponse])
def get_related_products(product_id: int, limit: int = 4, db: Session = Depends(get_db)):
    """Return related products of the same category, excluding the product itself. Public."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return db.query(Product).filter(
        Product.category == product.category,
        Product.id != product_id,
        Product.status == "published"
    ).limit(limit).all()


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
    preview = product.preview or 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=85'
    cat_imgs = cat_gallery.get(product.category) or cat_gallery.get('Design Assets')
    filtered_imgs = [img for img in cat_imgs if img != preview]
    return [preview] + filtered_imgs[:4]


@router.get("/{product_id}/download")
def download_product(
    product_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Securely download a product. Verifies ownership first."""
    check_platform_paused()
    
    # Check if vendor is active
    product = db.query(Product).join(User, Product.vendor_id == cast(User.id, String)).filter(
        Product.id == product_id,
        User.is_active == True
    ).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found or vendor is disabled")

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
        
    return {
        "download_url": product.file_url or f"/downloads/product-{product.id}.zip",
        "file_size": product.file_size or "48 MB",
        "version": product.version or "v1.0.0"
    }


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

    data = product_in.model_dump(exclude_none=True)
    # Always link to the authenticated vendor
    data["vendor_id"] = str(current_user.id)
    if not data.get("seller"):
        data["seller"] = current_user.name
    # Remove any id key that may have slipped in
    data.pop("id", None)

    product = Product(**data)
    db.add(product)
    db.commit()
    db.refresh(product)
    from admin.firestore.admin_firestore import sync_product_to_firestore
    sync_product_to_firestore(product)
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

    # Only update fields that were actually provided
    update_data = product_in.model_dump(exclude_none=True)
    for key, val in update_data.items():
        setattr(product, key, val)
    product.last_updated = "Recently"
    db.commit()
    db.refresh(product)
    from admin.firestore.admin_firestore import sync_product_to_firestore
    sync_product_to_firestore(product)
    return product


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

    db.delete(product)
    db.commit()
    from admin.firestore.admin_firestore import delete_product_from_firestore
    delete_product_from_firestore(product_id)
    return None
