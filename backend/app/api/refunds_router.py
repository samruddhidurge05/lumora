from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

from app.db.session import get_db
from app.dependencies import get_current_user_required
from app.models.user import User
from app.services.refund_service import refund_service

router = APIRouter()

class RefundRequestCreate(BaseModel):
    order_id: int
    reason_category: str = Field(..., description="broken_file | wrong_file | duplicate_charge | other")
    details: Optional[str] = Field(None, max_length=500)

class RefundRequestResponse(BaseModel):
    id: int
    order_id: int
    user_id: int
    reason_category: str
    details: Optional[str]
    status: str
    requested_amount: float
    currency: str
    payment_id: str
    gateway_refund_id: Optional[str]
    admin_notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    admin_decision_at: Optional[str] = None
    reviewed_by: Optional[int] = None
    decision_reason: Optional[str] = None
    last_updated_by: Optional[int] = None
    last_updated_at: datetime

    # Snapshot
    product_name: str
    order_total: float
    payment_method: str
    purchase_date: datetime

    # Diagnostic Metrics
    is_downloaded: bool = False
    download_count: int = 0
    first_download_at: Optional[datetime] = None
    last_download_at: Optional[datetime] = None
    ip_address: Optional[str] = None
    device_details: Optional[str] = None
    previous_refund_count: int = 0

    class Config:
        from_attributes = True

@router.post("/request", response_model=RefundRequestResponse, status_code=status.HTTP_201_CREATED)
def request_refund(
    body: RefundRequestCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    try:
        return refund_service.submit_request(
            db=db,
            user_id=current_user.id,
            order_id=body.order_id,
            reason_category=body.reason_category,
            details=body.details
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit refund request: {str(e)}"
        )

@router.get("/me", response_model=List[RefundRequestResponse])
def get_my_refund_requests(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    try:
        return refund_service.get_user_requests(db=db, user_id=current_user.id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/{request_id}/cancel", response_model=RefundRequestResponse)
def cancel_refund_request(
    request_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    try:
        return refund_service.cancel_request(
            db=db,
            request_id=request_id,
            user_id=current_user.id
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel refund request: {str(e)}"
        )

