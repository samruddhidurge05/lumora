from fastapi import Depends, HTTPException, status
from app.dependencies import get_current_user_required
from app.models.user import User

def require_admin_role(current_user: User = Depends(get_current_user_required)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators are authorized to perform this operation."
        )
    return current_user
