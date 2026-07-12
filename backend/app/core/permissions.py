"""
RBAC Permission System for Admin Team Management (M4-M8)
=========================================================
Role-based access control for Lumora admin team.
"""
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies import get_current_user_required
from app.models.user import User
from app.models.admin_role import AdminRole

# ── Role → Permission Mapping ─────────────────────────────────────────────────
ROLE_PERMISSIONS: dict[str, list[str]] = {
    "super_admin": ["*"],  # all permissions
    "admin": [
        "read:*",
        "write:products", "write:orders", "write:reviews",
        "write:reports", "write:support", "write:vendors", "write:affiliates",
        "write:referral_links", "write:platform_settings",
        "read:analytics", "read:audit_logs",
    ],
    "moderator": ["read:*", "write:reviews", "write:reports", "write:support"],
    "support":   ["read:support", "write:support", "read:customers"],
    "finance":   ["read:orders", "read:payments", "read:analytics", "read:reports"],
    "marketing": ["read:products", "write:products_limited", "read:analytics", "write:referral_links"],
    "analyst":   ["read:analytics", "read:reports", "read:audit_logs"],
}


def _has_permission(role_level: str, permission: str) -> bool:
    perms = ROLE_PERMISSIONS.get(role_level, [])
    if "*" in perms:
        return True
    if permission in perms:
        return True
    # Wildcard match e.g. "read:*" covers "read:orders"
    prefix = permission.split(":")[0]
    if f"{prefix}:*" in perms:
        return True
    return False


def require_permission(permission: str):
    """FastAPI dependency factory for fine-grained permission checks."""
    def checker(
        current_user: User = Depends(get_current_user_required),
        db: Session = Depends(get_db),
    ) -> User:
        # Super admin shortcut via user.role
        if current_user.role == "admin":
            return current_user  # legacy admin — always has all perms

        role_record = (
            db.query(AdminRole)
            .filter(AdminRole.user_id == current_user.id, AdminRole.is_active == True)
            .first()
        )
        if not role_record:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin role not found or account is inactive.",
            )
        if not _has_permission(role_record.role_level, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required.",
            )
        return current_user

    return checker
