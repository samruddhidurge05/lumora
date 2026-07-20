from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.db.session import get_db
from admin.validators.admin_auth import require_admin_role
from app.models.user import User
from app.services.refund_service import refund_service
from app.api.refunds_router import RefundRequestResponse

router = APIRouter()

@router.get("/", response_model=List[RefundRequestResponse])
def get_all_refund_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_admin: User = Depends(require_admin_role),
    db: Session = Depends(get_db)
):
    try:
        return refund_service.get_all_requests(
            db=db,
            status=status_filter,
            page=page,
            page_size=page_size
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.put("/{request_id}/status", response_model=RefundRequestResponse)
def update_refund_request_status(
    request_id: int,
    status_val: str = Body(..., embed=True),
    current_admin: User = Depends(require_admin_role),
    db: Session = Depends(get_db)
):
    try:
        return refund_service.update_request_status(
            db=db,
            request_id=request_id,
            new_status=status_val,
            admin_id=current_admin.id
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/{request_id}/approve", response_model=RefundRequestResponse)
def approve_refund_request(
    request_id: int,
    notes: Optional[str] = Body(None, embed=True),
    current_admin: User = Depends(require_admin_role),
    db: Session = Depends(get_db)
):
    try:
        return refund_service.approve_refund(
            db=db,
            request_id=request_id,
            admin_id=current_admin.id,
            notes=notes
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/{request_id}/reject", response_model=RefundRequestResponse)
def reject_refund_request(
    request_id: int,
    notes: Optional[str] = Body(None, embed=True),
    current_admin: User = Depends(require_admin_role),
    db: Session = Depends(get_db)
):
    try:
        return refund_service.reject_refund(
            db=db,
            request_id=request_id,
            admin_id=current_admin.id,
            notes=notes
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
