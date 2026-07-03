from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime
from app.db.session import get_db
from app.dependencies import get_current_user_optional, get_current_user_required
from app.models.search_history import SearchHistory
from app.models.product import Product
from app.models.user import User
from app.schemas.schemas import SearchHistoryResponse, SearchHistoryCreate

router = APIRouter()

@router.get("/history", response_model=List[SearchHistoryResponse])
def read_search_history(
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    if not current_user:
        return []
    history = db.query(SearchHistory).filter(
        SearchHistory.user_id == current_user.id
    ).order_by(SearchHistory.searched_at.desc()).limit(8).all()
    return history

@router.post("/history", response_model=SearchHistoryResponse, status_code=status.HTTP_201_CREATED)
def create_search_entry(
    entry_in: SearchHistoryCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    user_id = current_user.id if current_user else None
    
    # Check if this query already exists in history for user
    if user_id:
        existing = db.query(SearchHistory).filter(
            SearchHistory.user_id == user_id,
            SearchHistory.query == entry_in.query
        ).first()
        if existing:
            existing.searched_at = datetime.datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return existing
            
    entry = SearchHistory(user_id=user_id, query=entry_in.query)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
def clear_search_history(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    db.query(SearchHistory).filter(
        SearchHistory.user_id == current_user.id
    ).delete(synchronize_session=False)
    db.commit()
    return None

@router.get("/suggestions")
def get_search_suggestions(query_str: str, db: Session = Depends(get_db)):
    if not query_str:
        return {"products": [], "categories": [], "creators": []}
        
    q = f"%{query_str.lower().strip()}%"
    
    # Matching products
    products = db.query(Product).filter(
        Product.title.ilike(q) | Product.description.ilike(q)
    ).limit(4).all()
    
    # Matching categories
    categories = db.query(Product.category).filter(
        Product.category.ilike(q)
    ).distinct().limit(3).all()
    categories = [cat[0] for cat in categories if cat[0]]
    
    # Matching creators (Sophia Vance / Marcus Kane / etc)
    creators = db.query(Product.seller).filter(
        Product.seller.ilike(q)
    ).distinct().limit(2).all()
    creators = [c[0] for c in creators if c[0]]
    
    return {
        "products": [{"id": p.id, "title": p.title, "preview": p.preview} for p in products],
        "categories": categories,
        "creators": creators
    }
