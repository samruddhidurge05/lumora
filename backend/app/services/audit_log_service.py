from app.models.audit_log import AuditLog
from datetime import datetime
from sqlalchemy.orm import Session
import json

# ─── Action → Category mapping ───────────────────────────────────────────────
ACTION_CATEGORY_MAP: dict[str, str] = {
    # Security
    "admin_login_success":              "Security",
    "admin_login_failure":              "Security",
    "admin_logout":                     "Security",
    "admin_invited":                    "Security",
    "admin_deactivated":                "Security",
    "admin_role_changed":               "Security",
    "admin_invitation_revoked":         "Security",
    # Product
    "product_created":                  "Product",
    "product_updated":                  "Product",
    "product_deleted":                  "Product",
    "product_status_patched":           "Product",
    "product_featured_patched":         "Product",
    "product_affiliate_patched":        "Product",
    # Financial
    "Commission Created":               "Financial",
    "order_refund":                     "Financial",
    "order_status_change":              "Financial",
    "order_dispute":                    "Financial",
    # Affiliate
    "auto_affiliate_enrollment":        "Affiliate",
    "affiliate_enable":                 "Affiliate",
    "affiliate_disable":                "Affiliate",
    # Vendor
    "vendor_enable":                    "Vendor",
    "vendor_disable":                   "Vendor",
    "vendor_restrict":                  "Vendor",
    # Reports
    "report_resolved":                  "Reports",
    "report_rejected":                  "Reports",
    "report_assigned":                  "Reports",
    # Support
    "support_ticket_replied":           "Support",
    "support_ticket_status_changed":    "Support",
    # Content
    "review_moderated":                 "Content",
    # System
    "platform_pause":                   "System",
    "platform_resume":                  "System",
    # Referral
    "admin_referral_link_created":      "Referral",
    "admin_referral_link_deleted":      "Referral",
    "admin_referral_link_status_changed": "Referral",
}


def log_admin_action(
    db: Session,
    admin_user_id: int | None,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    metadata: dict | None = None,
    ip_address: str | None = None,
    # Optional enrichment — does NOT break existing callers
    category: str | None = None,
    actor_name: str | None = None,
    actor_email: str | None = None,
    actor_role: str | None = None,
) -> AuditLog:
    """
    Insert an AuditLog entry and commit immediately.

    Backward-compatible: all new params (category, actor_*) are optional.
    Category is auto-resolved from ACTION_CATEGORY_MAP if not explicitly provided.
    Actor metadata is stored as a JSON snapshot so it survives future user record changes.
    """
    resolved_category = category or ACTION_CATEGORY_MAP.get(action, "System")

    actor_blob: str | None = None
    if actor_name or actor_email or actor_role:
        actor_blob = json.dumps({
            "name":  actor_name,
            "email": actor_email,
            "role":  actor_role,
        })

    entry = AuditLog(
        admin_user_id=admin_user_id,
        action=action,
        category=resolved_category,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        metadata_json=json.dumps(metadata) if metadata else None,
        actor_metadata=actor_blob,
        ip_address=ip_address,
        created_at=datetime.utcnow(),
    )
    db.add(entry)
    db.commit()
    return entry

