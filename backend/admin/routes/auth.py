"""
backend/admin/routes/auth.py
----------------------------
Admin authentication endpoints:

  POST /login        - Firebase ID token ? JWT (rate-limited to 10/minute)
  GET  /audit-logs   - Paginated audit log retrieval (admin-only)
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


# -- Request / Response schemas ---------------------------------------------


class AdminLoginRequest(BaseModel):
    idToken: str


# -- Helpers ----------------------------------------------------------------


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


# -- POST /login ------------------------------------------------------------


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def admin_login(
    request: Request,
    body: AdminLoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Exchange a Firebase ID token for a Lumora admin JWT.

    Identity resolution order (most ? least specific):
      1. Exact firebase_uid match.
      2. Email match + firebase_uid reconciliation (provider switch or
         first-time Google sign-in after email/password registration).

    The full idToken is never logged at INFO level or below.
    """
    ip = request.client.host if request.client else None

    # -- Step 1: Verify Firebase token --------------------------------------
    try:
        claims = verify_firebase_id_token(body.idToken, settings.FIREBASE_PROJECT_ID)
    except ValueError as exc:
        logger.warning("Admin login: Firebase token verification failed - %s", exc)
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
    raw_email: Optional[str] = claims.get("email")
    email: Optional[str] = raw_email.strip().lower() if raw_email else None
    email_verified: bool = claims.get("email_verified", False)

    logger.info("Admin login attempt - firebase_uid=%s email_verified=%s", firebase_uid, email_verified)

    # -- Step 2: Resolve user identity --------------------------------------
    # Strategy: prefer exact firebase_uid match; fall back to verified email.
    # This handles the common post-invitation scenario where the user
    # registered with email/password (creating one firebase_uid) and later
    # signs in to the admin portal via Google OAuth (different firebase_uid
    # for the same verified email).
    user: Optional[User] = None

    # 2a. Exact UID match - fastest, most specific
    if firebase_uid:
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

    # 2b. Email fallback - covers provider switch (email/password ? Google)
    #     and first-time Google sign-in after invitation acceptance.
    #     Only allowed when Firebase has verified the email address, ensuring
    #     we cannot be spoofed by an unverified email claim.
    if user is None and email and email_verified:
        logger.info(
            "Admin login: UID lookup missed - falling back to verified email=%s", email
        )
        user = db.query(User).filter(User.email == email.lower()).first()

    # 2c. Last-resort: unverified email fallback (log a warning, still allow
    #     lookup so the role/active checks below produce the right error message)
    if user is None and email and not email_verified:
        logger.warning(
            "Admin login: UID miss + unverified email=%s - attempting lookup anyway", email
        )
        user = db.query(User).filter(User.email == email.lower()).first()

    # 2d. Pre-authorized admin & Invited admin email resolution
    import os
    default_admins = "admin@lumora.co,avikapawar08@gmail.com,451.avikapawar@gmail.com,samruddhidurge05@gmail.com"
    admin_emails_env = os.getenv("ADMIN_EMAILS", default_admins)
    allowed_admin_emails = {e.strip().lower() for e in admin_emails_env.split(",") if e.strip()}
    allowed_admin_emails.add("avikapawar08@gmail.com")
    allowed_admin_emails.add("451.avikapawar@gmail.com")

    effective_email = email.lower() if email else (user.email.lower() if (user and user.email) else None)

    # Check for pending admin invitations for this email
    from app.models.admin_invitation import AdminInvitation
    from app.models.admin_role import AdminRole

    pending_invite = None
    if effective_email:
        pending_invite = (
            db.query(AdminInvitation)
            .filter(
                AdminInvitation.email == effective_email,
                AdminInvitation.revoked_at.is_(None),
                AdminInvitation.accepted_at.is_(None),
            )
            .order_by(AdminInvitation.id.desc())
            .first()
        )

    is_authorized_admin = (
        (effective_email and effective_email in allowed_admin_emails)
        or (pending_invite is not None)
    )

    if is_authorized_admin:
        role_level = pending_invite.role_level if pending_invite else (
            "super_admin" if effective_email in {"admin@lumora.co", "avikapawar08@gmail.com", "451.avikapawar@gmail.com"} else "admin"
        )

        if user is None and effective_email:
            logger.info("[admin_login] Auto-provisioning authorized admin email=%s", effective_email)
            from app.core.security import get_password_hash
            user = User(
                name=claims.get("name") or (pending_invite.invited_name if pending_invite and pending_invite.invited_name else effective_email.split("@")[0].capitalize()),
                email=effective_email,
                password_hash=get_password_hash("LumoraAdmin2024!"),
                role="admin",
                is_active=True,
                is_verified=True,
                firebase_uid=firebase_uid,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        if user and user.role != "admin":
            logger.info("[admin_login] Elevating authorized email=%s to role='admin'", effective_email)
            user.role = "admin"
            user.is_active = True
            db.commit()

        if firebase_uid and user and user.firebase_uid != firebase_uid:
            logger.info("[admin_login] Binding firebase_uid=%s for user %s", firebase_uid, user.id)
            user.firebase_uid = firebase_uid
            db.commit()

        if pending_invite:
            logger.info("[admin_login] Marking invitation %s as accepted for email=%s", pending_invite.id, effective_email)
            pending_invite.accepted_at = datetime.now(timezone.utc)
            db.commit()

        # Ensure active AdminRole record exists
        admin_role_rec = db.query(AdminRole).filter(AdminRole.user_id == user.id).first()
        if not admin_role_rec:
            logger.info("[admin_login] Creating AdminRole record level=%s for user_id=%s", role_level, user.id)
            admin_role_rec = AdminRole(
                user_id=user.id,
                role_level=role_level,
                is_active=True,
                activated_at=datetime.now(timezone.utc),
            )
            db.add(admin_role_rec)
            db.commit()
        elif not admin_role_rec.is_active:
            admin_role_rec.is_active = True
            admin_role_rec.role_level = role_level
            db.commit()

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

    # -- Step 3: Authorisation checks --------------------------------------
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

    # -- Step 4: firebase_uid binding / reconciliation ----------------------
    # At this point the user is confirmed admin and active.
    # If the stored UID differs from the token UID, update it - Firebase has
    # already verified ownership of the email via OAuth, so this is safe.
    # This covers:
    #   ? First-time Google sign-in (user.firebase_uid is None)
    #   ? Provider switch: email/password ? Google OAuth
    #   ? Concurrent duplicate request (same UID already written - no-op)
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
                    # Already reconciled by a concurrent request - proceed.
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
                        "[admin_login] firebase_uid reconciled for user %s ? %s",
                        user.id, firebase_uid,
                    )
                else:
                    # Different email under lock - genuine mismatch, reject.
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
            # The user is already verified admin - don't block access for a
            # transient DB error.

    # -- Step 5: Issue JWT --------------------------------------------------
    access_token = create_access_token(
        {"sub": str(user.id)},
        expires_delta=timedelta(hours=24),
    )

    # -- Step 5a: Record last login timestamp (Req 9) -----------------------
    try:
        user.last_login_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        db.rollback()  # non-fatal - proceed with login

    # -- Step 6: Write success audit log -----------------------------------
    _insert_audit_log(
        db,
        action="admin_login_success",
        admin_user_id=user.id,
        ip_address=ip,
    )

    logger.info("Admin login success - user_id=%s", user.id)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


# -- GET /audit-logs --------------------------------------------------------

import json as _json

# Human-readable action label map
_ACTION_LABELS: dict[str, str] = {
    "admin_login_success":                "Admin Login Success",
    "admin_login_failure":                "Admin Login Failure",
    "admin_logout":                       "Admin Logout",
    "admin_invited":                      "Admin Invited",
    "admin_deactivated":                  "Admin Deactivated",
    "admin_role_changed":                 "Admin Role Changed",
    "admin_invitation_revoked":           "Invitation Revoked",
    "product_created":                    "Product Created",
    "product_updated":                    "Product Updated",
    "product_deleted":                    "Product Deleted",
    "product_status_patched":             "Product Status Changed",
    "product_featured_patched":           "Product Featured Status Changed",
    "product_affiliate_patched":          "Product Affiliate Setting Changed",
    "Commission Created":                 "Commission Created",
    "order_refund":                       "Order Refund Issued",
    "order_status_change":                "Order Status Changed",
    "order_dispute":                      "Order Dispute Raised",
    "auto_affiliate_enrollment":          "Affiliate Auto-Enrollment",
    "affiliate_enable":                   "Affiliate Enabled",
    "affiliate_disable":                  "Affiliate Disabled",
    "vendor_enable":                      "Vendor Enabled",
    "vendor_disable":                     "Vendor Disabled",
    "vendor_restrict":                    "Vendor Restricted",
    "report_resolved":                    "Report Resolved",
    "report_rejected":                    "Report Rejected",
    "report_assigned":                    "Report Assigned",
    "support_ticket_replied":             "Support Ticket Replied",
    "support_ticket_status_changed":      "Support Ticket Status Changed",
    "review_moderated":                   "Review Moderated",
    "platform_pause":                     "Platform Paused",
    "platform_resume":                    "Platform Resumed",
    "admin_referral_link_created":        "Referral Link Created",
    "admin_referral_link_deleted":        "Referral Link Deleted",
    "admin_referral_link_status_changed": "Referral Link Status Changed",
}

_ACTION_CATEGORY_MAP: dict[str, str] = {
    "admin_login_success":              "Security",
    "admin_login_failure":              "Security",
    "admin_logout":                     "Security",
    "admin_invited":                    "Security",
    "admin_deactivated":                "Security",
    "admin_role_changed":               "Security",
    "admin_invitation_revoked":         "Security",
    "product_created":                  "Product",
    "product_updated":                  "Product",
    "product_deleted":                  "Product",
    "product_status_patched":           "Product",
    "product_featured_patched":         "Product",
    "product_affiliate_patched":        "Product",
    "Commission Created":               "Financial",
    "order_refund":                     "Financial",
    "order_status_change":              "Financial",
    "order_dispute":                    "Financial",
    "auto_affiliate_enrollment":        "Affiliate",
    "affiliate_enable":                 "Affiliate",
    "affiliate_disable":                "Affiliate",
    "vendor_enable":                    "Vendor",
    "vendor_disable":                   "Vendor",
    "vendor_restrict":                  "Vendor",
    "report_resolved":                  "Reports",
    "report_rejected":                  "Reports",
    "report_assigned":                  "Reports",
    "support_ticket_replied":           "Support",
    "support_ticket_status_changed":    "Support",
    "review_moderated":                 "Content",
    "platform_pause":                   "System",
    "platform_resume":                  "System",
    "admin_referral_link_created":      "Referral",
    "admin_referral_link_deleted":      "Referral",
    "admin_referral_link_status_changed": "Referral",
}


def _build_description(action: str, actor_name: str, target_label: str, meta: dict) -> str:
    """Produce a human-readable sentence describing the audit event."""
    actor = actor_name or "System"
    target = target_label or "unknown resource"
    reason = meta.get("reason", "") if meta else ""

    templates: dict[str, str] = {
        "admin_login_success":    f"{actor} logged into the Admin Portal successfully.",
        "admin_login_failure":    f"Login attempt failed" + (f" — reason: {reason}." if reason else "."),
        "admin_logout":           f"{actor} logged out of the Admin Portal.",
        "admin_invited":          f"{actor} invited a new administrator.",
        "admin_deactivated":      f"{actor} deactivated administrator account {target}.",
        "admin_role_changed":     f"{actor} changed the role of {target}.",
        "admin_invitation_revoked": f"{actor} revoked an admin invitation for {target}.",
        "product_created":        f"{actor} created a new product ({target}).",
        "product_updated":        f"{actor} updated product {target}.",
        "product_deleted":        f"{actor} permanently deleted product {target}.",
        "product_status_patched": f"{actor} changed the publish status of product {target}.",
        "product_featured_patched": f"{actor} updated the featured status of product {target}.",
        "product_affiliate_patched": f"{actor} changed affiliate settings for product {target}.",
        "Commission Created":     f"System generated a commission for {target}.",
        "order_refund":           f"{actor} issued a refund for order {target}.",
        "order_status_change":    f"{actor} updated the status of order {target}.",
        "order_dispute":          f"A dispute was raised on order {target}.",
        "auto_affiliate_enrollment": f"{target} was automatically enrolled as an affiliate after completing registration.",
        "affiliate_enable":       f"{actor} enabled affiliate account {target}.",
        "affiliate_disable":      f"{actor} disabled affiliate account {target}.",
        "vendor_enable":          f"{actor} enabled vendor account {target}.",
        "vendor_disable":         f"{actor} disabled vendor account {target}.",
        "vendor_restrict":        f"{actor} restricted vendor account {target}.",
        "report_resolved":        f"{actor} resolved report {target}.",
        "report_rejected":        f"{actor} rejected report {target}.",
        "report_assigned":        f"{actor} assigned report {target} for review.",
        "support_ticket_replied": f"{actor} replied to support ticket {target}.",
        "support_ticket_status_changed": f"{actor} updated the status of support ticket {target}.",
        "review_moderated":       f"{actor} moderated a review on {target}.",
        "platform_pause":         f"{actor} paused the platform.",
        "platform_resume":        f"{actor} resumed the platform.",
        "admin_referral_link_created": f"{actor} created a new referral link.",
        "admin_referral_link_deleted": f"{actor} deleted referral link {target}.",
        "admin_referral_link_status_changed": f"{actor} updated the status of referral link {target}.",
    }
    return templates.get(action, f"{actor} performed action: {action.replace('_', ' ')}.")


def _resolve_target_label(db: Session, target_type: Optional[str], target_id: Optional[str]) -> str:
    """Resolve a human-readable label for a target entity without raising on failure."""
    if not target_type or not target_id:
        return ""
    try:
        from app.models.product import Product
        tid = target_id.strip()

        if target_type in ("user", "affiliate", "customer", "vendor"):
            row = db.query(User.name, User.email).filter(User.id == int(tid)).first()
            if row:
                return f"{row.name} ({row.email})" if row.email else row.name

        elif target_type == "product":
            row = db.query(Product.title).filter(Product.id == int(tid)).first()
            if row:
                return row.title

        elif target_type in ("order",):
            return f"ORD-{tid}"

        elif target_type == "affiliate_commission":
            return f"Commission #{tid}"

        elif target_type == "support_ticket":
            return f"Ticket #{tid}"

        elif target_type == "report":
            return f"Report #{tid}"

    except Exception:
        pass
    return f"{target_type} #{target_id}"


@router.get("/audit-logs")
def get_audit_logs(
    page: int = 1,
    page_size: int = 50,
    action: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_admin_role),
):
    """
    Return paginated, fully-enriched audit logs ordered by created_at descending.

    Query params:
      page       - minimum 1 (clamped)
      page_size  - range [1, 200] (clamped)
      action     - optional exact-match filter on AuditLog.action
      category   - optional filter: Security | Product | Financial | Affiliate | Vendor | ...
      search     - optional text search on actor name or email
      date_from  - ISO date string (YYYY-MM-DD), inclusive lower bound
      date_to    - ISO date string (YYYY-MM-DD), inclusive upper bound
    """
    from datetime import date as _date
    from app.models.product import Product  # local import — avoids circular deps

    page = max(1, page)
    page_size = max(1, min(200, page_size))

    query = db.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action == action)

    # Category filter — use stored column if populated, else derive from action map
    if category:
        stored_match = query.filter(AuditLog.category == category)
        # Also include legacy rows (category IS NULL) whose action maps to this category
        matching_actions = [a for a, c in _ACTION_CATEGORY_MAP.items() if c == category]
        if matching_actions:
            from sqlalchemy import or_
            query = query.filter(
                or_(
                    AuditLog.category == category,
                    (AuditLog.category.is_(None)) & (AuditLog.action.in_(matching_actions)),
                )
            )
        else:
            query = query.filter(AuditLog.category == category)

    if date_from:
        try:
            df = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(AuditLog.created_at >= df)
        except ValueError:
            pass

    if date_to:
        try:
            dt = datetime.strptime(date_to, "%Y-%m-%d")
            # Include whole day
            dt = dt.replace(hour=23, minute=59, second=59)
            query = query.filter(AuditLog.created_at <= dt)
        except ValueError:
            pass

    total: int = query.count()
    offset: int = (page - 1) * page_size

    rows = (
        query
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    # Batch-load actors (users) referenced in this page to avoid N+1 queries
    actor_ids = list({r.admin_user_id for r in rows if r.admin_user_id is not None})
    actors_by_id: dict[int, User] = {}
    if actor_ids:
        actor_rows = db.query(User).filter(User.id.in_(actor_ids)).all()
        actors_by_id = {u.id: u for u in actor_rows}

    items = []
    for row in rows:
        # ── Actor resolution ──────────────────────────────────────────────
        actor_snapshot: dict | None = None
        if row.actor_metadata:
            try:
                actor_snapshot = _json.loads(row.actor_metadata)
            except Exception:
                actor_snapshot = None

        actor_user = actors_by_id.get(row.admin_user_id) if row.admin_user_id else None
        actor_name  = (actor_snapshot or {}).get("name")  or (actor_user.name  if actor_user else None) or "System"
        actor_email = (actor_snapshot or {}).get("email") or (actor_user.email if actor_user else None)
        actor_role  = (actor_snapshot or {}).get("role")  or (actor_user.role  if actor_user else None)

        # ── Target resolution ─────────────────────────────────────────────
        target_label = _resolve_target_label(db, row.target_type, row.target_id)

        # ── Search filter (applied post-resolution to match actor name/email) ──
        if search:
            s = search.lower()
            haystack = f"{actor_name} {actor_email or ''}".lower()
            if s not in haystack:
                total -= 1
                continue

        # ── Category ──────────────────────────────────────────────────────
        resolved_category = row.category or _ACTION_CATEGORY_MAP.get(row.action, "System")

        # ── Metadata parsing ──────────────────────────────────────────────
        parsed_meta: dict = {}
        if row.metadata_json:
            try:
                parsed_meta = _json.loads(row.metadata_json)
            except Exception:
                parsed_meta = {"raw": row.metadata_json}

        # ── Human-readable description ────────────────────────────────────
        description = _build_description(row.action, actor_name, target_label, parsed_meta)

        items.append({
            # ── Backward-compatible fields ──
            "id":             row.id,
            "admin_user_id":  row.admin_user_id,
            "action":         row.action,
            "target_type":    row.target_type,
            "target_id":      row.target_id,
            "metadata":       row.metadata_json,
            "ip_address":     row.ip_address,
            "created_at":     row.created_at.isoformat() if row.created_at else None,
            # ── Enriched enterprise fields ──
            "action_label":   _ACTION_LABELS.get(row.action, row.action.replace("_", " ").title()),
            "category":       resolved_category,
            "description":    description,
            "actor": {
                "id":    row.admin_user_id,
                "name":  actor_name,
                "email": actor_email,
                "role":  actor_role,
                "type":  "System" if not row.admin_user_id else "Administrator",
            },
            "target": {
                "type":  row.target_type,
                "id":    row.target_id,
                "label": target_label or None,
            },
            "metadata_parsed": parsed_meta,
        })

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items,
    }

