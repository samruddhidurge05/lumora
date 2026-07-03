from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from admin_controls.vendor.services import update_vendor_status
from app.dependencies import get_current_user_required
from app.models.user import User as UserModel

router = APIRouter(tags=["Admin Controls - Vendor"])

class VendorStatusUpdateSchema(BaseModel):
    status: str

@router.put("/{uid}/status")
def change_vendor_status(
    uid: str,
    payload: VendorStatusUpdateSchema,
    current_user: UserModel = Depends(get_current_user_required)
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can change vendor status."
        )
        
    try:
        update_vendor_status(uid, payload.status)
        return {"success": True, "message": f"Vendor status updated to {payload.status}."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
