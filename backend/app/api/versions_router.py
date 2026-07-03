from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.dependencies import get_current_user_required
from app.models.product_version import ProductVersion
from app.models.product import Product
from app.models.notification import Notification
from app.models.user import User
from app.schemas.schemas import ProductVersionCreate, ProductVersionResponse

router = APIRouter()

@router.get("/{product_id}", response_model=List[ProductVersionResponse])
def read_versions(product_id: str, db: Session = Depends(get_db)):
    versions = db.query(ProductVersion).filter(ProductVersion.product_id == product_id).order_by(ProductVersion.created_at.desc()).all()
    return versions

@router.post("/", response_model=ProductVersionResponse, status_code=status.HTTP_201_CREATED)
def create_version(
    version_in: ProductVersionCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    if current_user.role not in ("vendor", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors or admins can release product updates."
        )

    # Verify product exists
    product = db.query(Product).filter(Product.id == version_in.product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    # Resource ownership check
    user_uid = str(current_user.id)
    if current_user.role != "admin" and (product.vendor_id != user_uid and product.seller != current_user.name):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to release version updates for this product."
        )
        
    # Create version
    version = ProductVersion(**version_in.model_dump())
    db.add(version)
    
    # Update product's current version
    product.version = version_in.version_number
    
    # Notify all customers
    customers = db.query(User).filter(User.role == "customer").all()
    for cust in customers:
        notif = Notification(
            user_id=cust.id,
            title="Product Update Available ✦",
            message=f"Version {version_in.version_number} of '{product.title}' is now ready. Changelog: {version_in.changelog}",
            category="update",
            is_read=False
        )
        db.add(notif)
        
    db.commit()
    db.refresh(version)
    return version
