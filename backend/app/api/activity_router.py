from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.dependencies import get_current_user_required
from app.models.user_activity import UserActivity
from app.models.user import User
from app.schemas.schemas import UserActivityResponse, UserActivityCreate

router = APIRouter()

@router.get("/", response_model=List[UserActivityResponse])
def get_user_activity(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    activities = db.query(UserActivity).filter(
        UserActivity.user_id == current_user.id
    ).order_by(UserActivity.created_at.desc()).all()
    return activities

@router.post("/", response_model=UserActivityResponse, status_code=status.HTTP_201_CREATED)
def create_user_activity(
    activity_in: UserActivityCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    if activity_in.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot record activity for another user."
        )

    # Verify user exists
    user = db.query(User).filter(User.id == activity_in.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    activity = UserActivity(**activity_in.model_dump())
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity
