import json
from fastapi import Depends, status
from app.dependencies import get_current_user_required
from app.models.user import User
from app.models.platform_setting import PlatformSetting
from app.db.database import SessionLocal
from admin.firestore.admin_firestore import get_platform_settings
from app.shared.firebase.connection import db, firebase_connected
from app.core.exceptions import LumoraException

def check_platform_paused():
    is_paused = False
    pause_msg = "Platform is temporarily paused."
    
    if firebase_connected and db is not None:
        settings = get_platform_settings()
        if settings.get("isPlatformPaused", False):
            is_paused = True
            pause_msg = settings.get("pauseMessage") or "Platform is temporarily paused."
    else:
        # Fallback: read from SQLite platform_settings table
        db_session = SessionLocal()
        try:
            paused_setting = db_session.query(PlatformSetting).filter(
                PlatformSetting.key == "isPlatformPaused"
            ).first()
            if paused_setting:
                raw = json.loads(paused_setting.value).get("value", False)
                if raw:
                    is_paused = True
                    msg_setting = db_session.query(PlatformSetting).filter(
                        PlatformSetting.key == "pauseMessage"
                    ).first()
                    if msg_setting:
                        pause_msg = json.loads(msg_setting.value).get("value") or "Platform is temporarily paused."
        finally:
            db_session.close()
            
    if is_paused:
        raise LumoraException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="PLATFORM_PAUSED",
            message=pause_msg
        )

def verify_vendor_active(current_user: User = Depends(get_current_user_required)):
    if current_user.role == "admin":
        return

    if current_user.role not in ("vendor", "affiliate"):
        raise LumoraException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="ROLE_REQUIRED",
            message="Vendor role required."
        )

    # SQLite active check
    if not current_user.is_active:
        raise LumoraException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="ACCOUNT_DISABLED",
            message="Your vendor account has been disabled by the platform administrator. All business operations are currently unavailable. Please contact support for assistance."
        )

    if firebase_connected and db is not None:
        from admin_controls.vendor.firestore import get_vendor_status_from_firestore
        status_val = get_vendor_status_from_firestore(str(current_user.id))
        if status_val in ("suspended", "disabled", "rejected"):
            raise LumoraException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="ACCOUNT_DISABLED",
                message="Your vendor account has been disabled by the platform administrator. All business operations are currently unavailable. Please contact support for assistance."
            )

    check_platform_paused()

def verify_affiliate_active(current_user: User = Depends(get_current_user_required)):
    if current_user.role == "admin":
        return

    # Dual-role support: vendor-role users who also have an AffiliateProfile
    # are allowed to access affiliate endpoints (they registered as both).
    if current_user.role not in ("affiliate", "vendor"):
        raise LumoraException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="ROLE_REQUIRED",
            message="Affiliate role required."
        )


    # SQLite active check
    if not current_user.is_active:
        raise LumoraException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="ACCOUNT_DISABLED",
            message="Your affiliate account has been disabled by the platform administrator. Campaign creation and payout requests are unavailable."
        )

    if firebase_connected and db is not None:
        from admin_controls.affiliate.firestore import get_affiliate_status_from_firestore
        status_val = get_affiliate_status_from_firestore(str(current_user.id))
        if status_val in ("suspended", "disabled", "rejected"):
            raise LumoraException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="ACCOUNT_DISABLED",
                message="Your affiliate account has been disabled by the platform administrator. Campaign creation and payout requests are unavailable."
            )

    check_platform_paused()
