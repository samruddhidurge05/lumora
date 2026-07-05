from fastapi import APIRouter, Depends, HTTPException, Body
from app.admin_api.reviews.services import get_reviews_dashboard_data, moderate_review
from admin.validators.admin_auth import require_admin_role
from app.models.user import User

router = APIRouter()

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
    admin_user: User = Depends(require_admin_role)
):
    try:
        return moderate_review(review_id, action)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
