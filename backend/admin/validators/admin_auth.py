from fastapi import Depends, HTTPException, status
from app.dependencies import get_current_user_required
from app.models.user import User

ADMIN_ROLES = {"admin", "super_admin", "moderator", "support", "finance", "marketing", "analyst"}

def require_admin_role(current_user: User = Depends(get_current_user_required)) -> User:
    user_role = (getattr(current_user, "role", "") or "").lower()
    if user_role not in ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators are authorized to perform this operation."
        )
    return current_user
