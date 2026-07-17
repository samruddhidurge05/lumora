from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.dependencies import get_current_user_required
from app.models.user import User
from app.models.wishlist import WishlistItem
from app.models.product import Product

router = APIRouter()

@router.post("/", status_code=status.HTTP_201_CREATED)
def add_to_wishlist(
    product_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    from app.utils.db_sync import get_product_by_id
    prod = get_product_by_id(db, product_id)
    if not prod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    existing = db.query(WishlistItem).filter(
        WishlistItem.user_id == current_user.id,
        WishlistItem.product_id == product_id
    ).first()
    if existing:
        return {"message": "Product already in wishlist"}

    item = WishlistItem(user_id=current_user.id, product_id=product_id)
    db.add(item)

    # Log user activity
    from app.services.activity_log_service import ActivityLogService
    ActivityLogService.log_user_activity(
        db=db,
        user_id=current_user.id,
        activity_type="wishlist_add",
        details=f"Added product '{prod.title}' (ID {prod.id}) to wishlist."
    )

    db.commit()
    return {"message": "Product added to wishlist"}

@router.delete("/{product_id}")
def remove_from_wishlist(
    product_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    item = db.query(WishlistItem).filter(
        WishlistItem.user_id == current_user.id,
        WishlistItem.product_id == product_id
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wishlist item not found")
    
    from app.utils.db_sync import get_product_by_id
    prod = get_product_by_id(db, product_id)
    prod_title = prod.title if prod else f"Product ID {product_id}"

    db.delete(item)

    # Log user activity
    from app.services.activity_log_service import ActivityLogService
    ActivityLogService.log_user_activity(
        db=db,
        user_id=current_user.id,
        activity_type="wishlist_remove",
        details=f"Removed '{prod_title}' from wishlist."
    )

    db.commit()
    return {"message": "Product removed from wishlist"}

@router.get("/me", response_model=List[int])
def get_my_wishlist(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    items = db.query(WishlistItem).filter(WishlistItem.user_id == current_user.id).all()
    return [item.product_id for item in items]
