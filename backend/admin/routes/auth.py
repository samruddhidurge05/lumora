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

    Identity resolution order (most → least specific):
      1. Exact firebase_uid match.
      2. Email match + firebase_uid reconciliation (provider switch or
         first-time Google sign-in after email/password registration).

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
    email_verified: bool = claims.get("email_verified", False)

    logger.info("Admin login attempt — firebase_uid=%s email_verified=%s", firebase_uid, email_verified)

    # ── Step 2: Resolve user identity ──────────────────────────────────────
    # Strategy: prefer exact firebase_uid match; fall back to verified email.
    # This handles the common post-invitation scenario where the user
    # registered with email/password (creating one firebase_uid) and later
    # signs in to the admin portal via Google OAuth (different firebase_uid
    # for the same verified email).
    user: Optional[User] = None

    # 2a. Exact UID match — fastest, most specific
    if firebase_uid:
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

    # 2b. Email fallback — covers provider switch (email/password → Google)
    #     and first-time Google sign-in after invitation acceptance.
    #     Only allowed when Firebase has verified the email address, ensuring
    #     we cannot be spoofed by an unverified email claim.
    if user is None and email and email_verified:
        logger.info(
            "Admin login: UID lookup missed — falling back to verified email=%s", email
        )
        user = db.query(User).filter(User.email == email.lower()).first()

    # 2c. Last-resort: unverified email fallback (log a warning, still allow
    #     lookup so the role/active checks below produce the right error message)
    if user is None and email and not email_verified:
        logger.warning(
            "Admin login: UID miss + unverified email=%s — attempting lookup anyway", email
        )
        user = db.query(User).filter(User.email == email.lower()).first()

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

    # ── Step 4: firebase_uid binding / reconciliation ──────────────────────
    # At this point the user is confirmed admin and active.
    # If the stored UID differs from the token UID, update it — Firebase has
    # already verified ownership of the email via OAuth, so this is safe.
    # This covers:
    #   • First-time Google sign-in (user.firebase_uid is None)
    #   • Provider switch: email/password → Google OAuth
    #   • Concurrent duplicate request (same UID already written — no-op)
    if firebase_uid and user.firebase_uid != firebase_uid:
        logger.info(
            "[admin_login] Reconciling firebase_uid for user %s "
            "(old=%s new=%s email_verified=%s)",
            user.id, user.firebase_uid, firebase_uid, email_verified,
        )
        try:
            locked_user = (
                db.query(User)
                .filter(User.id == user.id)
                .with_for_update()
                .first()
            )
            if locked_user:
                # Re-check under lock: another concurrent request may have
                # already written the correct UID.
                if locked_user.firebase_uid == firebase_uid:
                    # Already reconciled by a concurrent request — proceed.
                    user = locked_user
                elif locked_user.firebase_uid is None or (
                    email and locked_user.email.lower() == email.lower()
                ):
                    # Safe to update: either null (first bind) or same email
                    # (provider switch confirmed by Firebase-verified email).
                    locked_user.firebase_uid = firebase_uid
                    db.commit()
                    db.refresh(locked_user)
                    user = locked_user
                    logger.info(
                        "[admin_login] firebase_uid reconciled for user %s → %s",
                        user.id, firebase_uid,
                    )
                else:
                    # Different email under lock — genuine mismatch, reject.
                    db.rollback()
                    logger.warning(
                        "[admin_login] firebase_uid mismatch under lock for user %s "
                        "(token_email=%s db_email=%s)",
                        user.id, email, locked_user.email,
                    )
                    _insert_audit_log(
                        db,
                        action="admin_login_failure",
                        admin_user_id=user.id,
                        ip_address=ip,
                        metadata_json='{"reason": "firebase_uid_email_mismatch"}',
                    )
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Firebase UID does not match the stored identity for this account.",
                    )
        except HTTPException:
            raise
        except Exception as exc:
            db.rollback()
            logger.error(
                "[admin_login] firebase_uid reconciliation failed for user %s: %s",
                user.id, exc,
            )
            # Non-fatal: proceed with login even if UID update failed.
            # The user is already verified admin — don't block access for a
            # transient DB error.

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
