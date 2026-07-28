"""
Public settings and feature flags API router
=============================================
Provides feature flag configurations to frontend applications.
"""
import json
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.platform_setting import PlatformSetting
from app.shared.firebase.connection import db as fdb, firebase_connected
from admin.firestore.admin_firestore import get_platform_settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Settings"])


def get_vendor_enabled_state(db: Session | None = None) -> dict:
    """
    Helper to check feature flags: vendor_enabled, vendorSellingEnabled, vendorRegistrationEnabled,
    affiliate_enabled, and affiliateProgramEnabled.
    SQLite platform_settings is the authoritative source of truth; Firestore is best-effort sync/fallback.
    """
    vendor_enabled = True
    vendor_selling = True
    vendor_reg = True
    affiliate_enabled = True

    # 1. Authoritative check: SQLite platform_settings table
    db_session = db
    close_db = False
    if db_session is None:
        try:
            from app.db.database import SessionLocal
            db_session = SessionLocal()
            close_db = True
        except Exception:
            db_session = None

    sqlite_found = False
    if db_session is not None:
        try:
            row_ve = db_session.query(PlatformSetting).filter(PlatformSetting.key == "vendor_enabled").first()
            row_vs = db_session.query(PlatformSetting).filter(PlatformSetting.key == "vendorSellingEnabled").first()
            row_vr = db_session.query(PlatformSetting).filter(PlatformSetting.key == "vendorRegistrationEnabled").first()
            row_ae = db_session.query(PlatformSetting).filter(PlatformSetting.key == "affiliateProgramEnabled").first()
            row_aff = db_session.query(PlatformSetting).filter(PlatformSetting.key == "affiliate_enabled").first()

            if row_ve or row_vs or row_vr or row_ae or row_aff:
                sqlite_found = True
                if row_ve and row_ve.value:
                    vendor_enabled = json.loads(str(row_ve.value)).get("value", True)
                if row_vs and row_vs.value:
                    vendor_selling = json.loads(str(row_vs.value)).get("value", True)
                if row_vr and row_vr.value:
                    vendor_reg = json.loads(str(row_vr.value)).get("value", True)
                if row_ae and row_ae.value:
                    affiliate_enabled = json.loads(str(row_ae.value)).get("value", True)
                if row_aff and row_aff.value:
                    affiliate_enabled = affiliate_enabled and json.loads(str(row_aff.value)).get("value", True)
        except Exception as exc:
            logger.error("[settings_router] SQLite read error for feature flags: %s", exc)
        finally:
            if close_db and db_session:
                db_session.close()

    if sqlite_found:
        effective_vendor_enabled = vendor_enabled and vendor_selling and vendor_reg
        return {
            "vendor_enabled": effective_vendor_enabled,
            "vendorSellingEnabled": vendor_selling,
            "vendorRegistrationEnabled": vendor_reg,
            "affiliate_enabled": affiliate_enabled,
            "affiliateProgramEnabled": affiliate_enabled,
        }

    # 2. Secondary check: Firestore
    if firebase_connected and fdb is not None:
        try:
            settings_dict = get_platform_settings()
            if settings_dict:
                vendor_enabled = settings_dict.get("vendor_enabled", True)
                vendor_selling = settings_dict.get("vendorSellingEnabled", True)
                vendor_reg = settings_dict.get("vendorRegistrationEnabled", True)
                aff_enabled = settings_dict.get("affiliateProgramEnabled", settings_dict.get("affiliate_enabled", True))
                effective_vendor_enabled = vendor_enabled and vendor_selling and vendor_reg
                return {
                    "vendor_enabled": effective_vendor_enabled,
                    "vendorSellingEnabled": vendor_selling,
                    "vendorRegistrationEnabled": vendor_reg,
                    "affiliate_enabled": aff_enabled,
                    "affiliateProgramEnabled": aff_enabled,
                }
        except Exception as exc:
            logger.warning("[settings_router] Firestore read error: %s", exc)

    effective_vendor_enabled = vendor_enabled and vendor_selling and vendor_reg
    return {
        "vendor_enabled": effective_vendor_enabled,
        "vendorSellingEnabled": vendor_selling,
        "vendorRegistrationEnabled": vendor_reg,
        "affiliate_enabled": affiliate_enabled,
        "affiliateProgramEnabled": affiliate_enabled,
    }


@router.get("/features")
def get_features(db: Session = Depends(get_db)):
    """
    GET /api/settings/features
    Returns current feature flag status for the application.
    """
    return get_vendor_enabled_state(db)
