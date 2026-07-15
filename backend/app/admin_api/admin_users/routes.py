"""
Admin User Management API
==========================
Endpoints for managing the admin team, invitations, and RBAC.
All write endpoints require the super_admin role (or legacy admin).

Routes:
  GET    /team                               List active team members
  POST   /team/invite                        Create invitation (Req 1, 8)
  POST   /team/accept-invite                 Accept via regular JWT (production flow)
  POST   /team/{user_id}/activate            Accept via user_id (legacy)
  POST   /team/{user_id}/deactivate          Revoke access
  PUT    /team/{user_id}/role                Change role (Req 10)
  GET    /team/invitations                   List invitations (Req 3, 8)
  DELETE /team/invitations/{id}              Soft-revoke (Req 3)
  POST   /team/invitations/{id}/resend       Resend / renew (Req 2)
  GET    /team/invitations/verify            Token verification (public)
  GET    /team/audit-log                     Team-scoped audit log (Req 6)
  GET    /me                                 Authenticated admin profile + permissions (Req 4)
"""
import uuid
import threading
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Body, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from admin.validators.admin_auth import require_admin_role
from app.db.session import get_db
from app.dependencies import get_current_user_required
from app.models.admin_role import AdminRole
from app.models.admin_invitation import AdminInvitation
from app.models.user import User
from app.models.audit_log import AuditLog
from app.services.audit_log_service import log_admin_action
from app.core.config import settings
from app.core.permissions import ROLE_PERMISSIONS

router = APIRouter()

VALID_ROLES = ["super_admin", "admin", "moderator", "support", "finance", "marketing", "analyst"]

# Team-management actions shown in the audit log section
TEAM_AUDIT_ACTIONS = {
    "admin_invited", "admin_invite_accepted",
    "admin_invitation_resent", "admin_invitation_revoked",
    "admin_deactivated", "admin_role_changed",
}


# ── Request schemas ────────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: str
    role_level: str = "admin"
    invited_name: Optional[str] = None   # Req 8 — optional display name (max 150)
    message: Optional[str] = None        # Req 8 — optional personal message (max 300)


class ChangeRoleRequest(BaseModel):
    role_level: str


# ── Helpers ────────────────────────────────────────────────────────────────────

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


def _invitation_status(inv, now: datetime) -> str:
    """Compute canonical invitation status. Revoked supersedes all."""
    if getattr(inv, "revoked_at", None):
        return "revoked"
    if inv.accepted_at:
        return "accepted"
    exp = inv.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now:
        return "expired"
    return "pending"


def _send_email_async(to_email, invited_name, role_level, accept_url, expires_at, message=None):
    """Fire email delivery in a background thread so it never blocks the response."""
    def _do():
        try:
            from app.services.email_service import send_invitation_email
            ok = send_invitation_email(
                to_email=to_email,
                invited_name=invited_name,
                role_level=role_level,
                accept_url=accept_url,
                expires_at=expires_at,
                message=message,
            )
            if not ok:
                import logging
                logging.getLogger(__name__).warning(
                    "[team] Email delivery failed for %s — invitation still valid", to_email
                )
        except Exception as exc:
            import logging
            logging.getLogger(__name__).error("[team] Email thread error: %s", exc)
    threading.Thread(target=_do, daemon=True).start()


def _invitation_payload(inv, now: datetime) -> dict:
    """Serialise an AdminInvitation to the standard response shape."""
    return {
        "id":           inv.id,
        "email":        inv.email,
        "invited_name": getattr(inv, "invited_name", None),
        "role_level":   inv.role_level,
        "invite_token": inv.invite_token,
        "status":       _invitation_status(inv, now),
        "accepted_at":  inv.accepted_at.isoformat() if inv.accepted_at else None,
        "revoked_at":   inv.revoked_at.isoformat() if getattr(inv, "revoked_at", None) else None,
        "expires_at":   inv.expires_at.isoformat() if inv.expires_at else None,
        "created_at":   inv.created_at.isoformat() if inv.created_at else None,
    }


# ── GET /me ───────────────────────────────────────────────────────────────────
# Req 4 — exposes role_level + permissions for RBAC-gated sidebar

@router.get("/me")
def get_admin_me(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """Return the authenticated admin's profile and resolved permissions."""
    role_record = db.query(AdminRole).filter(
        AdminRole.user_id == admin_user.id, AdminRole.is_active == True
    ).first()
    role_level = role_record.role_level if role_record else "admin"
    permissions = ROLE_PERMISSIONS.get(role_level, [])
    return {
        "user_id":    admin_user.id,
        "email":      admin_user.email,
        "name":       admin_user.name,
        "role_level": role_level,
        "permissions": permissions,
    }


# ── GET /team ─────────────────────────────────────────────────────────────────

@router.get("/team")
def list_team_members(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """List all active admin team members sorted by last_login_at descending."""
    roles = db.query(AdminRole).filter(AdminRole.is_active == True).all()
    result = []
    for r in roles:
        user = db.query(User).filter(User.id == r.user_id).first()
        if user:
            result.append({
                "id":           r.id,
                "user_id":      user.id,
                "name":         user.name,
                "email":        user.email,
                "avatar_url":   user.avatar_url,
                "role_level":   r.role_level,
                "is_active":    r.is_active,
                "activated_at": r.activated_at.isoformat() if r.activated_at else None,
                "created_at":   r.created_at.isoformat() if r.created_at else None,
                # Req 9 — last login timestamp
                "last_login_at": user.last_login_at.isoformat() if getattr(user, "last_login_at", None) else None,
            })
    # Sort: last_login_at desc, nulls last
    result.sort(key=lambda m: m["last_login_at"] or "", reverse=True)
    return result


# ── POST /team/invite ──────────────────────────────────────────────────────────

@router.post("/team/invite", status_code=status.HTTP_201_CREATED)
def invite_admin(
    body: InviteRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """Create a secure invitation token and optionally send an email. (Req 1, 8)"""
    _require_super_admin(admin_user, db)

    if body.role_level not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role_level. Must be one of: {VALID_ROLES}")

    token      = str(uuid.uuid4()).replace("-", "")
    expires_at = datetime.now(timezone.utc) + timedelta(hours=48)
    accept_url = f"{settings.FRONTEND_URL}/admin/accept-invite?token={token}"

    invitation = AdminInvitation(
        email=body.email,
        role_level=body.role_level,
        invite_token=token,
        invited_by=admin_user.id,
        expires_at=expires_at,
        invited_name=body.invited_name,
        message=body.message,
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

    # Req 1 — send email in background thread (non-blocking)
    _send_email_async(
        to_email=body.email,
        invited_name=body.invited_name,
        role_level=body.role_level,
        accept_url=accept_url,
        expires_at=expires_at,
        message=body.message,
    )

    # Req 5 — sync to Firestore
    try:
        from admin.firestore.admin_firestore import sync_invitation_to_firestore
        sync_invitation_to_firestore(invitation)
    except Exception:
        pass

    return {
        "invitation_id": invitation.id,
        "email":         invitation.email,
        "invited_name":  invitation.invited_name,
        "role_level":    invitation.role_level,
        "invite_token":  token,
        "expires_at":    expires_at.isoformat(),
        "accept_url":    accept_url,
    }


# ── POST /team/invitations/{invitation_id}/resend ─────────────────────────────

@router.post("/team/invitations/{invitation_id}/resend")
def resend_invitation(
    invitation_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """Renew an expired or pending invitation with a fresh token. (Req 2)"""
    _require_super_admin(admin_user, db)

    invitation = db.query(AdminInvitation).filter(AdminInvitation.id == invitation_id).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found.")

    now    = datetime.now(timezone.utc)
    status_ = _invitation_status(invitation, now)
    if status_ in ("accepted", "revoked"):
        raise HTTPException(
            status_code=400,
            detail="Cannot resend an accepted or revoked invitation.",
        )

    # Regenerate token + expiry
    invitation.invite_token = str(uuid.uuid4()).replace("-", "")
    invitation.expires_at   = now + timedelta(hours=48)
    db.commit()
    db.refresh(invitation)

    accept_url = f"{settings.FRONTEND_URL}/admin/accept-invite?token={invitation.invite_token}"

    try:
        log_admin_action(
            db=db, admin_user_id=admin_user.id, action="admin_invitation_resent",
            target_type="invitation", target_id=str(invitation.id),
            metadata={"email": invitation.email, "new_expires_at": invitation.expires_at.isoformat()},
        )
    except Exception:
        pass

    _send_email_async(
        to_email=invitation.email,
        invited_name=getattr(invitation, "invited_name", None),
        role_level=invitation.role_level,
        accept_url=accept_url,
        expires_at=invitation.expires_at,
        message=getattr(invitation, "message", None),
    )

    try:
        from admin.firestore.admin_firestore import sync_invitation_to_firestore
        sync_invitation_to_firestore(invitation)
    except Exception:
        pass

    return {
        "message":    f"Invitation resent to {invitation.email}",
        "accept_url": accept_url,
        "expires_at": invitation.expires_at.isoformat(),
    }


# ── POST /team/{user_id}/activate ─────────────────────────────────────────────

@router.post("/team/{user_id}/activate")
def activate_admin(
    user_id: int,
    token: str = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    """Legacy activate endpoint — kept for backward compatibility."""
    now = datetime.now(timezone.utc)
    invitation = db.query(AdminInvitation).filter(
        AdminInvitation.invite_token == token,
        AdminInvitation.accepted_at == None,
    ).first()

    if not invitation:
        raise HTTPException(status_code=400, detail="Invalid or already used invitation token.")
    if getattr(invitation, "revoked_at", None):
        raise HTTPException(status_code=400, detail="This invitation has been revoked.")

    exp = invitation.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now:
        raise HTTPException(status_code=400, detail="Invitation token has expired.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    existing_role = db.query(AdminRole).filter(AdminRole.user_id == user_id).first()
    if existing_role:
        existing_role.role_level   = invitation.role_level
        existing_role.is_active    = True
        existing_role.activated_at = now
        existing_role.deactivated_at = None
    else:
        db.add(AdminRole(user_id=user_id, role_level=invitation.role_level,
                         invited_by=invitation.invited_by, is_active=True, activated_at=now))

    user.role = "admin"
    db.add(user)
    invitation.accepted_at = now
    db.commit()

    try:
        from admin.firestore.admin_firestore import sync_team_member_to_firestore, sync_invitation_to_firestore
        role_rec = db.query(AdminRole).filter(AdminRole.user_id == user_id).first()
        sync_team_member_to_firestore(user, role_rec)
        sync_invitation_to_firestore(invitation)
    except Exception:
        pass

    return {"message": "Admin role activated.", "role_level": invitation.role_level}


# ── POST /team/accept-invite ──────────────────────────────────────────────────

@router.post("/team/accept-invite")
def accept_invite(
    token: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
):
    """
    Production accept-invite flow.
    Auth: regular customer JWT — invitation token is the security credential.
    (Req 3 — checks revoked_at; Req 5, 7 — Firestore writes)
    """
    now = datetime.now(timezone.utc)

    invitation = db.query(AdminInvitation).filter(
        AdminInvitation.invite_token == token,
        AdminInvitation.accepted_at == None,
    ).first()

    if not invitation:
        raise HTTPException(status_code=400, detail="Invalid or already used invitation token.")

    if getattr(invitation, "revoked_at", None):
        raise HTTPException(status_code=400, detail="This invitation has been revoked.")

    exp = invitation.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now:
        raise HTTPException(status_code=400, detail="Invitation token has expired.")

    if current_user.email.lower() != invitation.email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"This invitation was sent to {invitation.email}. "
                "Please sign in with that email address."
            ),
        )

    existing_role = db.query(AdminRole).filter(AdminRole.user_id == current_user.id).first()
    if existing_role:
        existing_role.role_level     = invitation.role_level
        existing_role.is_active      = True
        existing_role.activated_at   = now
        existing_role.deactivated_at = None
    else:
        db.add(AdminRole(user_id=current_user.id, role_level=invitation.role_level,
                         invited_by=invitation.invited_by, is_active=True, activated_at=now))

    current_user.role = "admin"
    db.add(current_user)
    invitation.accepted_at = now
    db.commit()

    try:
        log_admin_action(
            db=db, admin_user_id=current_user.id, action="admin_invite_accepted",
            target_type="invitation", target_id=str(invitation.id),
            metadata={"role_level": invitation.role_level, "email": current_user.email},
        )
    except Exception:
        pass

    # Req 5 — real-time Firestore updates
    try:
        from admin.firestore.admin_firestore import (
            sync_team_member_to_firestore,
            sync_invitation_to_firestore,
            write_admin_notification_to_firestore,
        )
        role_rec = db.query(AdminRole).filter(AdminRole.user_id == current_user.id).first()
        sync_team_member_to_firestore(current_user, role_rec)
        sync_invitation_to_firestore(invitation)
        # Req 7 — in-app notification for super_admin
        write_admin_notification_to_firestore(current_user, invitation)
    except Exception:
        pass

    return {
        "message":    "Admin role activated successfully.",
        "role_level": invitation.role_level,
        "email":      current_user.email,
    }


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

    role.is_active       = False
    role.deactivated_at  = datetime.now(timezone.utc)
    db.commit()

    try:
        log_admin_action(db=db, admin_user_id=admin_user.id, action="admin_deactivated",
                         target_type="user", target_id=str(user_id))
    except Exception:
        pass

    # Req 5 — sync to Firestore
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            from admin.firestore.admin_firestore import sync_team_member_to_firestore
            sync_team_member_to_firestore(user, role)
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
    """Change the role level of a team member. (Req 10)"""
    _require_super_admin(admin_user, db)
    if body.role_level not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role_level. Must be one of: {VALID_ROLES}")

    role = db.query(AdminRole).filter(AdminRole.user_id == user_id, AdminRole.is_active == True).first()
    if not role:
        raise HTTPException(status_code=404, detail="Active admin role not found for this user.")

    old_role       = role.role_level
    role.role_level = body.role_level
    db.commit()

    try:
        log_admin_action(db=db, admin_user_id=admin_user.id, action="admin_role_changed",
                         target_type="user", target_id=str(user_id),
                         metadata={"old_role": old_role, "new_role": body.role_level})
    except Exception:
        pass

    # Req 5 — sync to Firestore
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            from admin.firestore.admin_firestore import sync_team_member_to_firestore
            sync_team_member_to_firestore(user, role)
    except Exception:
        pass

    return {"message": "Role updated.", "user_id": user_id, "role_level": body.role_level}


# ── GET /team/invitations ─────────────────────────────────────────────────────

@router.get("/team/invitations")
def list_invitations(
    include_history: bool = Query(False),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """List invitations — includes revoked status. (Req 3)"""
    now = datetime.now(timezone.utc)

    if include_history:
        invitations = (db.query(AdminInvitation)
                       .order_by(AdminInvitation.created_at.desc()).limit(200).all())
    else:
        invitations = (db.query(AdminInvitation)
                       .filter(AdminInvitation.accepted_at == None,
                               AdminInvitation.expires_at > now)
                       .order_by(AdminInvitation.created_at.desc()).all())

    return [_invitation_payload(inv, now) for inv in invitations]


# ── DELETE /team/invitations/{invitation_id} ──────────────────────────────────

@router.delete("/team/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_invitation(
    invitation_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """Soft-revoke a pending invitation (preserves audit trail). (Req 3)"""
    _require_super_admin(admin_user, db)

    invitation = db.query(AdminInvitation).filter(AdminInvitation.id == invitation_id).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found.")
    if invitation.accepted_at:
        raise HTTPException(status_code=400, detail="Cannot revoke an already accepted invitation.")

    invitation.revoked_at = datetime.now(timezone.utc)
    db.commit()

    try:
        log_admin_action(db=db, admin_user_id=admin_user.id, action="admin_invitation_revoked",
                         target_type="invitation", target_id=str(invitation.id),
                         metadata={"email": invitation.email})
    except Exception:
        pass

    try:
        from admin.firestore.admin_firestore import sync_invitation_to_firestore
        sync_invitation_to_firestore(invitation)
    except Exception:
        pass

    return None


# ── GET /team/invitations/verify ──────────────────────────────────────────────

@router.get("/team/invitations/verify")
def verify_invitation(
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """Public endpoint — verify a token before showing the accept UI. (Req 3)"""
    now = datetime.now(timezone.utc)
    invitation = db.query(AdminInvitation).filter(
        AdminInvitation.invite_token == token,
        AdminInvitation.accepted_at == None,
        AdminInvitation.expires_at > now,
    ).first()

    if not invitation:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation token.")

    if getattr(invitation, "revoked_at", None):
        raise HTTPException(status_code=400, detail="This invitation has been revoked.")

    return {
        "valid":         True,
        "email":         invitation.email,
        "invited_name":  getattr(invitation, "invited_name", None),
        "role_level":    invitation.role_level,
        "expires_at":    invitation.expires_at.isoformat(),
    }


# ── GET /team/audit-log ───────────────────────────────────────────────────────

@router.get("/team/audit-log")
def get_team_audit_log(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """Paginated team-scoped audit log. (Req 6)"""
    query = (db.query(AuditLog)
             .filter(AuditLog.action.in_(TEAM_AUDIT_ACTIONS))
             .order_by(AuditLog.created_at.desc()))

    total = query.count()
    rows  = query.offset(offset).limit(limit).all()

    items = []
    for row in rows:
        actor = db.query(User).filter(User.id == row.admin_user_id).first() if row.admin_user_id else None
        items.append({
            "id":             row.id,
            "action":         row.action,
            "admin_user_id":  row.admin_user_id,
            "admin_email":    actor.email if actor else None,
            "admin_name":     actor.name  if actor else None,
            "target_type":    row.target_type,
            "target_id":      row.target_id,
            "metadata":       row.metadata_json,
            "ip_address":     row.ip_address,
            "created_at":     row.created_at.isoformat() if row.created_at else None,
        })

    return {"items": items, "total": total, "limit": limit, "offset": offset}
