"""
Admin User Management API — M4-M8
===================================
Endpoints for managing the admin team (invite, activate, deactivate, role change).
All write endpoints require the super_admin role (or legacy admin).
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Body, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from admin.validators.admin_auth import require_admin_role
from app.db.session import get_db
from app.models.admin_role import AdminRole
from app.models.admin_invitation import AdminInvitation
from app.models.user import User
from app.services.audit_log_service import log_admin_action

router = APIRouter()

VALID_ROLES = ["super_admin", "admin", "moderator", "support", "finance", "marketing", "analyst"]


# ── Request schemas ────────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: str
    role_level: str = "admin"


class ChangeRoleRequest(BaseModel):
    role_level: str


# ── Helper ─────────────────────────────────────────────────────────────────────

def _is_super_admin(user: User, db: Session) -> bool:
    """Returns True if user is legacy admin or has super_admin role record."""
    if user.role == "admin":
        return True
    role = db.query(AdminRole).filter(
        AdminRole.user_id == user.id, AdminRole.is_active == True
    ).first()
    return role is not None and role.role_level == "super_admin"


def _require_super_admin(user: User, db: Session):
    if not _is_super_admin(user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super_admin can manage admin team.",
        )


# ── GET /team ─────────────────────────────────────────────────────────────────

@router.get("/team")
def list_team_members(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """List all active admin team members with their role records."""
    roles = db.query(AdminRole).filter(AdminRole.is_active == True).all()
    result = []
    for r in roles:
        user = db.query(User).filter(User.id == r.user_id).first()
        if user:
            result.append({
                "id": r.id,
                "user_id": user.id,
                "name": user.name,
                "email": user.email,
                "avatar_url": user.avatar_url,
                "role_level": r.role_level,
                "is_active": r.is_active,
                "activated_at": r.activated_at.isoformat() if r.activated_at else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })
    return result


# ── POST /team/invite ──────────────────────────────────────────────────────────

@router.post("/team/invite", status_code=status.HTTP_201_CREATED)
def invite_admin(
    body: InviteRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """Create an invitation token for a new admin team member."""
    _require_super_admin(admin_user, db)

    if body.role_level not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role_level. Must be one of: {VALID_ROLES}")

    token = str(uuid.uuid4()).replace("-", "")
    expires_at = datetime.now(timezone.utc) + timedelta(hours=48)

    invitation = AdminInvitation(
        email=body.email,
        role_level=body.role_level,
        invite_token=token,
        invited_by=admin_user.id,
        expires_at=expires_at,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    try:
        log_admin_action(
            db=db, admin_user_id=admin_user.id, action="admin_invited",
            target_type="invitation", target_id=str(invitation.id),
            metadata={"email": body.email, "role_level": body.role_level},
        )
    except Exception:
        pass

    return {
        "invitation_id": invitation.id,
        "email": invitation.email,
        "role_level": invitation.role_level,
        "invite_token": token,
        "expires_at": expires_at.isoformat(),
        "accept_url": f"/admin/accept-invite?token={token}",
    }


# ── POST /team/{user_id}/activate ─────────────────────────────────────────────

@router.post("/team/{user_id}/activate")
def activate_admin(
    user_id: int,
    token: str = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    """Accept invitation and activate admin role for a user."""
    invitation = db.query(AdminInvitation).filter(
        AdminInvitation.invite_token == token,
        AdminInvitation.accepted_at == None,
    ).first()

    if not invitation:
        raise HTTPException(status_code=400, detail="Invalid or already used invitation token.")

    now = datetime.now(timezone.utc)
    if invitation.expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=400, detail="Invitation token has expired.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Upsert AdminRole
    existing_role = db.query(AdminRole).filter(AdminRole.user_id == user_id).first()
    if existing_role:
        existing_role.role_level = invitation.role_level
        existing_role.is_active = True
        existing_role.activated_at = now
        existing_role.deactivated_at = None
    else:
        role = AdminRole(
            user_id=user_id,
            role_level=invitation.role_level,
            invited_by=invitation.invited_by,
            is_active=True,
            activated_at=now,
        )
        db.add(role)

    invitation.accepted_at = now
    db.commit()

    return {"message": "Admin role activated.", "role_level": invitation.role_level}


# ── POST /team/{user_id}/deactivate ──────────────────────────────────────────

@router.post("/team/{user_id}/deactivate")
def deactivate_admin(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """Deactivate an admin team member. Immediately revokes access."""
    _require_super_admin(admin_user, db)

    if user_id == admin_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself.")

    role = db.query(AdminRole).filter(AdminRole.user_id == user_id, AdminRole.is_active == True).first()
    if not role:
        raise HTTPException(status_code=404, detail="Active admin role not found for this user.")

    role.is_active = False
    role.deactivated_at = datetime.now(timezone.utc)
    db.commit()

    try:
        log_admin_action(
            db=db, admin_user_id=admin_user.id, action="admin_deactivated",
            target_type="user", target_id=str(user_id),
        )
    except Exception:
        pass

    return {"message": "Admin access revoked.", "user_id": user_id}


# ── PUT /team/{user_id}/role ──────────────────────────────────────────────────

@router.put("/team/{user_id}/role")
def change_admin_role(
    user_id: int,
    body: ChangeRoleRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """Change the role level of an admin team member."""
    _require_super_admin(admin_user, db)

    if body.role_level not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role_level. Must be one of: {VALID_ROLES}")

    role = db.query(AdminRole).filter(AdminRole.user_id == user_id, AdminRole.is_active == True).first()
    if not role:
        raise HTTPException(status_code=404, detail="Active admin role not found for this user.")

    old_role = role.role_level
    role.role_level = body.role_level
    db.commit()

    try:
        log_admin_action(
            db=db, admin_user_id=admin_user.id, action="admin_role_changed",
            target_type="user", target_id=str(user_id),
            metadata={"old_role": old_role, "new_role": body.role_level},
        )
    except Exception:
        pass

    return {"message": "Role updated.", "user_id": user_id, "role_level": body.role_level}


# ── GET /team/invitations ──────────────────────────────────────────────────────

@router.get("/team/invitations")
def list_invitations(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """List all pending (not yet accepted) invitations."""
    now = datetime.now(timezone.utc)
    invitations = db.query(AdminInvitation).filter(
        AdminInvitation.accepted_at == None,
        AdminInvitation.expires_at > now,
    ).order_by(AdminInvitation.created_at.desc()).all()

    return [
        {
            "id": inv.id,
            "email": inv.email,
            "role_level": inv.role_level,
            "invite_token": inv.invite_token,
            "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
        }
        for inv in invitations
    ]


# ── DELETE /team/invitations/{invitation_id} ──────────────────────────────────

@router.delete("/team/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_invitation(
    invitation_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """Cancel a pending invitation."""
    _require_super_admin(admin_user, db)

    invitation = db.query(AdminInvitation).filter(AdminInvitation.id == invitation_id).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found.")

    db.delete(invitation)
    db.commit()
    return None


# ── GET /team/invitations/verify ──────────────────────────────────────────────

@router.get("/team/invitations/verify")
def verify_invitation(
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """Verify an invitation token before the accept flow."""
    now = datetime.now(timezone.utc)
    invitation = db.query(AdminInvitation).filter(
        AdminInvitation.invite_token == token,
        AdminInvitation.accepted_at == None,
        AdminInvitation.expires_at > now,
    ).first()

    if not invitation:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation token.")

    return {
        "valid": True,
        "email": invitation.email,
        "role_level": invitation.role_level,
        "expires_at": invitation.expires_at.isoformat(),
    }
