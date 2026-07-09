from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional
from app.db.session import get_db
from app.models.product import Product
from app.schemas.schemas import ProductCreate, ProductResponse, ProductUpdate
from admin.validators.admin_auth import require_admin_role
from admin.firestore.admin_firestore import sync_product_to_firestore, delete_product_from_firestore

router = APIRouter()

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
    product = Product(**data)
    db.add(product)
    db.commit()
    db.refresh(product)
    sync_product_to_firestore(product)
    return product

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, product_in: ProductUpdate, db: Session = Depends(get_db), admin_user = Depends(require_admin_role)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    update_data = product_in.model_dump(exclude_none=True)
    for key, val in update_data.items():
        setattr(product, key, val)
    db.commit()
    db.refresh(product)
    sync_product_to_firestore(product)
    return product

@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db), admin_user = Depends(require_admin_role)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    delete_product_from_firestore(product_id)
    return None
