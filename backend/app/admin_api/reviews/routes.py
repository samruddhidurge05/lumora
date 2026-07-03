from fastapi import APIRouter, HTTPException, Body
from app.admin_api.reviews.services import get_reviews_dashboard_data, moderate_review

router = APIRouter()

@router.get("/dashboard")
def get_dashboard():
    return get_reviews_dashboard_data()

@router.get("/analytics")
def get_analytics():
    return get_reviews_dashboard_data()

@router.post("/moderate")
def post_moderate(
    review_id: str = Body(..., embed=True),
    action: str = Body(..., embed=True)
):
    try:
        return moderate_review(review_id, action)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
