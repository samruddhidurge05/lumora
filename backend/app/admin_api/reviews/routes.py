from fastapi import APIRouter, Depends, HTTPException, Body, Query
from app.admin_api.reviews.services import get_reviews_dashboard_data, moderate_review, get_paginated_reviews
from admin.validators.admin_auth import require_admin_role
from app.db.session import get_db
from app.models.user import User
from app.services.audit_log_service import log_admin_action
from sqlalchemy.orm import Session

router = APIRouter()

@router.get("/")
def get_reviews_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sentiment: str | None = Query(None),
    search: str | None = Query(None),
    admin_user: User = Depends(require_admin_role),
):
    """Paginated reviews list with optional sentiment + search filters."""
    return get_paginated_reviews(page=page, page_size=page_size, sentiment=sentiment, search=search)

@router.get("/dashboard")
def get_dashboard(admin_user: User = Depends(require_admin_role)):
    return get_reviews_dashboard_data()

@router.get("/analytics")
def get_analytics(admin_user: User = Depends(require_admin_role)):
    return get_reviews_dashboard_data()

@router.post("/moderate")
def post_moderate(
    review_id: str = Body(..., embed=True),
    action: str = Body(..., embed=True),
    admin_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    try:
        result = moderate_review(review_id, action)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    try:
        log_admin_action(
            db=db,
            admin_user_id=admin_user.id,
            action="review_moderated",
            target_type="review",
            target_id=str(review_id),
            metadata={"moderation_action": action},
        )
    except Exception:
        pass  # Non-blocking - audit log failure never breaks the main operation
    return result
