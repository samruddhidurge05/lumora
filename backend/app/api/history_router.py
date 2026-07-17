from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import datetime
from app.db.session import get_db
from app.dependencies import get_current_user_required
from app.models.recently_viewed import RecentlyViewed
from app.models.product import Product
from app.models.user import User
from app.schemas.schemas import RecentlyViewedResponse, RecentlyViewedCreate

router = APIRouter()

@router.get("/", response_model=List[RecentlyViewedResponse])
def read_history(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    history = db.query(RecentlyViewed).filter(
        RecentlyViewed.user_id == current_user.id
    ).order_by(RecentlyViewed.viewed_at.desc()).all()
    return history

@router.post("/", response_model=RecentlyViewedResponse, status_code=status.HTTP_201_CREATED)
def create_history_entry(
    entry_in: RecentlyViewedCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    if entry_in.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot record viewing history for another user."
        )

    # Verify product and user exist
    from app.utils.db_sync import get_product_by_id
    product = get_product_by_id(db, entry_in.product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    user = db.query(User).filter(User.id == entry_in.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    # Check if entry already exists (upsert)
    existing = db.query(RecentlyViewed).filter(
        RecentlyViewed.user_id == entry_in.user_id,
        RecentlyViewed.product_id == entry_in.product_id
    ).first()
    if existing:
        existing.viewed_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
        
    entry = RecentlyViewed(**entry_in.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
def clear_history(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    db.query(RecentlyViewed).filter(
        RecentlyViewed.user_id == current_user.id
    ).delete(synchronize_session=False)
    db.commit()
    return None
