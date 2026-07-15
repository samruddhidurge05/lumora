"""
backend/admin/routes/auth.py
----------------------------
Admin authentication endpoints:

  POST /login        — Firebase ID token → JWT (rate-limited to 10/minute)
  GET  /audit-logs   — Paginated audit log retrieval (admin-only)
"""

import logging
from datetime import timedelta, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.firebase import verify_firebase_id_token
from app.core.security import create_access_token
from app.db.session import get_db
from app.middleware.rate_limit import limiter
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.auth import TokenResponse, UserResponse
from admin.validators.admin_auth import require_admin_role

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Request / Response schemas ─────────────────────────────────────────────


class AdminLoginRequest(BaseModel):
    idToken: str


# ── Helpers ────────────────────────────────────────────────────────────────


def _insert_audit_log(
    db: Session,
    *,
    action: str,
    admin_user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    metadata_json: Optional[str] = None,
) -> None:
    """Insert an audit log row and commit it immediately."""
    log = AuditLog(
        admin_user_id=admin_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        metadata_json=metadata_json,
        ip_address=ip_address,
    )
    db.add(log)
    db.commit()


# ── POST /login ────────────────────────────────────────────────────────────


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def admin_login(
    request: Request,
    body: AdminLoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Exchange a Firebase ID token for a Lumora admin JWT.

    The full idToken is never logged at INFO level or below.
    """
    ip = request.client.host if request.client else None

    # ── Step 1: Verify Firebase token ──────────────────────────────────────
    try:
        claims = verify_firebase_id_token(body.idToken, settings.FIREBASE_PROJECT_ID)
    except ValueError as exc:
        logger.warning("Admin login: Firebase token verification failed — %s", exc)
        _insert_audit_log(
            db,
            action="admin_login_failure",
            admin_user_id=None,
            ip_address=ip,
            metadata_json='{"reason": "invalid_firebase_token"}',
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase token verification failed.",
        )

    firebase_uid: Optional[str] = claims.get("uid")
    email: Optional[str] = claims.get("email")

    logger.info("Admin login attempt — firebase_uid=%s", firebase_uid)

    # ── Step 2: Look up user in SQLite ─────────────────────────────────────
    user: Optional[User] = None

    if firebase_uid:
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

    if user is None and email:
        logger.info("Querying by email=%s (firebase_uid lookup found nothing)", email)
        user = db.query(User).filter(User.email == email).first()

    if user is None:
        _insert_audit_log(
            db,
            action="admin_login_failure",
            admin_user_id=None,
            ip_address=ip,
            metadata_json='{"reason": "user_not_found"}',
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No account found for this Google identity.",
        )

    # ── Step 3: Authorisation checks ──────────────────────────────────────
    if user.role != "admin":
        _insert_audit_log(
            db,
            action="admin_login_failure",
            admin_user_id=user.id,
            ip_address=ip,
            metadata_json='{"reason": "insufficient_role"}',
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators are authorized to perform this operation.",
        )

    if not user.is_active:
        _insert_audit_log(
            db,
            action="admin_login_failure",
            admin_user_id=user.id,
            ip_address=ip,
            metadata_json='{"reason": "account_disabled"}',
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin account is disabled.",
        )

    # ── Step 4: firebase_uid binding / validation ──────────────────────────
    # Admin accounts may have been created via email/password (customer flow first,
    # then promoted via invitation). When such a user later signs into the admin
    # portal via Google OAuth, Firebase issues a different UID than the one stored
    # from the email/password registration. We resolve this by email — if the
    # Firebase token's email matches the admin's email and the user is confirmed
    # admin, we update the stored firebase_uid to the new Google UID. This is safe
    # because Firebase has already verified email ownership via OAuth.
    if user.firebase_uid is not None:
        if firebase_uid and user.firebase_uid != firebase_uid:
            # UID mismatch — check if it's a provider switch (email/password → Google)
            # by verifying the email matches. If so, update the stored UID.
            if email and user.email.lower() == email.lower():
                logger.info(
                    "[admin_login] firebase_uid updated for user %s — "
                    "provider switch detected (old=%s new=%s)",
                    user.id, user.firebase_uid, firebase_uid,
                )
                try:
                    locked_user = (
                        db.query(User)
                        .filter(User.id == user.id)
                        .with_for_update()
                        .first()
                    )
                    if locked_user:
                        locked_user.firebase_uid = firebase_uid
                        db.commit()
                        db.refresh(locked_user)
                        user = locked_user
                except Exception as exc:
                    db.rollback()
                    logger.error("Failed to update firebase_uid for user %s: %s", user.id, exc)
                    # Non-fatal for the login — proceed with the existing UID
            else:
                logger.warning(
                    "[admin_login] firebase_uid mismatch — token uid=%s | db uid=%s | email mismatch",
                    firebase_uid, user.firebase_uid,
                )
                _insert_audit_log(
                    db,
                    action="admin_login_failure",
                    admin_user_id=user.id,
                    ip_address=ip,
                    metadata_json='{"reason": "firebase_uid_mismatch"}',
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Firebase UID does not match the stored identity for this account.",
                )
    else:
        # First login — bind the firebase_uid atomically.
        # SQLite serialises all writes, but we follow the SELECT-FOR-UPDATE
        # pattern so this is correct under a concurrent RDBMS too.
        if firebase_uid:
            try:
                # Re-fetch inside the same transaction to get the latest row.
                # SQLAlchemy's with_for_update() issues SELECT … FOR UPDATE on
                # databases that support it; on SQLite it degrades gracefully to
                # a plain SELECT because SQLite's write serialisation already
                # prevents concurrent writes.
                locked_user = (
                    db.query(User)
                    .filter(User.id == user.id)
                    .with_for_update()
                    .first()
                )
                if locked_user is None:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="User record disappeared unexpectedly.",
                    )
                # Only write if still null (another concurrent request may have
                # won the race on a non-SQLite backend)
                if locked_user.firebase_uid is None:
                    locked_user.firebase_uid = firebase_uid
                    db.commit()
                    db.refresh(locked_user)
                    user = locked_user
                elif locked_user.firebase_uid != firebase_uid:
                    db.rollback()
                    _insert_audit_log(
                        db,
                        action="admin_login_failure",
                        admin_user_id=user.id,
                        ip_address=ip,
                        metadata_json='{"reason": "firebase_uid_race_mismatch"}',
                    )
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Firebase UID does not match the stored identity for this account.",
                    )
                else:
                    # Another request already wrote the same uid — that's fine
                    user = locked_user
            except HTTPException:
                raise
            except Exception as exc:
                db.rollback()
                logger.error("Failed to bind firebase_uid for user %s: %s", user.id, exc)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to bind Firebase identity.",
                )

    # ── Step 5: Issue JWT ──────────────────────────────────────────────────
    access_token = create_access_token(
        {"sub": str(user.id)},
        expires_delta=timedelta(hours=24),
    )

    # ── Step 5a: Record last login timestamp (Req 9) ───────────────────────
    try:
        user.last_login_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        db.rollback()  # non-fatal — proceed with login

    # ── Step 6: Write success audit log ───────────────────────────────────
    _insert_audit_log(
        db,
        action="admin_login_success",
        admin_user_id=user.id,
        ip_address=ip,
    )

    logger.info("Admin login success — user_id=%s", user.id)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


# ── GET /audit-logs ────────────────────────────────────────────────────────


@router.get("/audit-logs")
def get_audit_logs(
    page: int = 1,
    page_size: int = 50,
    action: Optional[str] = None,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_admin_role),
):
    """
    Return paginated audit logs ordered by created_at descending.

    page      — minimum 1 (clamped)
    page_size — range [1, 200] (clamped)
    action    — optional exact-match filter on AuditLog.action
    """
    # Clamp parameters
    page = max(1, page)
    page_size = max(1, min(200, page_size))

    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)

    total: int = query.count()
    offset: int = (page - 1) * page_size

    rows = (
        query
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    items = [
        {
            "id": row.id,
            "admin_user_id": row.admin_user_id,
            "action": row.action,
            "target_type": row.target_type,
            "target_id": row.target_id,
            "metadata": row.metadata_json,
            "ip_address": row.ip_address,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items,
    }
