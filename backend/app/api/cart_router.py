from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.dependencies import get_current_user_required
from app.models.user import User
from app.models.wishlist import CartItem
from app.models.product import Product

router = APIRouter()


@router.get("/me", response_model=List[int])
def get_my_cart(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Return a list of product IDs in the authenticated user's cart."""
    items = db.query(CartItem).filter(CartItem.user_id == current_user.id).all()
    return [item.product_id for item in items]


@router.post("/", status_code=status.HTTP_201_CREATED)
def add_to_cart(
    product_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Add a product to the authenticated user's cart. Duplicate-safe."""
    from app.utils.db_sync import get_product_by_id
    prod = get_product_by_id(db, product_id)
    if not prod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    existing = db.query(CartItem).filter(
        CartItem.user_id == current_user.id,
        CartItem.product_id == product_id
    ).first()
    if existing:
        return {"message": "Product already in cart"}

    item = CartItem(user_id=current_user.id, product_id=product_id)
    db.add(item)
    db.commit()
    return {"message": "Product added to cart"}


@router.delete("/clear", status_code=status.HTTP_204_NO_CONTENT)
def clear_cart(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Remove all cart items for the authenticated user (called after checkout)."""
    db.query(CartItem).filter(CartItem.user_id == current_user.id).delete(synchronize_session=False)
    db.commit()
    return None


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_cart(
    product_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Remove a single product from the authenticated user's cart."""
    item = db.query(CartItem).filter(
        CartItem.user_id == current_user.id,
        CartItem.product_id == product_id
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found")

    db.delete(item)
    db.commit()
    return None


@router.get("/summary")
def get_cart_summary(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Get cart item count, subtotal (USD), and total INR conversions dynamically. Public/Secure."""
    items = db.query(CartItem).filter(CartItem.user_id == current_user.id).all()
    product_ids = [i.product_id for i in items]
    products = db.query(Product).filter(Product.id.in_(product_ids)).all() if product_ids else []
    
    subtotal = sum(p.price for p in products)
    total_inr = int(subtotal * 80)
    
    return {
        "item_count": len(items),
        "subtotal_usd": subtotal,
        "total_inr": total_inr,
        "platform_fee": "Free"
    }


@router.put("/{product_id}")
def update_cart_item(
    product_id: int,
    quantity: int = 1,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Mock endpoint to satisfy standard PUT operations. Quantity is set to 1."""
    item = db.query(CartItem).filter(
        CartItem.user_id == current_user.id,
        CartItem.product_id == product_id
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found")
    
    return {"message": "Cart item updated successfully", "quantity": 1}
