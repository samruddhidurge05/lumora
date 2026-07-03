from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from admin_controls.affiliate.services import update_affiliate_status
from app.dependencies import get_current_user_required
from app.models.user import User as UserModel

router = APIRouter(tags=["Admin Controls - Affiliate"])

class AffiliateStatusUpdateSchema(BaseModel):
    status: str

@router.put("/{uid}/status")
def change_affiliate_status(
    uid: str,
    payload: AffiliateStatusUpdateSchema,
    current_user: UserModel = Depends(get_current_user_required)
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can change affiliate status."
        )
        
    try:
        update_affiliate_status(uid, payload.status)
        return {"success": True, "message": f"Affiliate status updated to {payload.status}."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
