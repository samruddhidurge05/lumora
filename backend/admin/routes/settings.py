import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from admin.validators.admin_auth import require_admin_role
from admin.firestore.admin_firestore import get_platform_settings
from app.shared.firebase.connection import db as fdb, firebase_connected
from app.models.platform_setting import PlatformSetting
from app.db.session import get_db
from app.services.audit_log_service import log_admin_action

logger = logging.getLogger(__name__)

router = APIRouter()

# ── In-process fallback store — last resort when both Firestore and SQLite are unavailable ──
# Kept as final fallback only; SQLite is the authoritative source of truth.
_local_platform_state: dict = {
    "isPlatformPaused": False,
    "pauseMessage": "Lumora is temporarily paused by the platform administrators",
    "lastUpdated": datetime.now(timezone.utc).isoformat() + "Z",
    "updatedBy": "system",
}


# ── Private helpers ──────────────────────────────────────────────────────────

def _get_platform_setting(db: Session, key: str, default=None):
    """Read a value from the SQLite platform_settings table.

    The stored value is a JSON string of the form ``{"value": <actual>}``.
    Returns *default* when the key does not exist or the row cannot be
    deserialised.
    """
    try:
        setting = db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
        if setting:
            return json.loads(setting.value).get("value", default)
    except Exception as exc:
        logger.error("[settings] _get_platform_setting error for key=%s: %s", key, exc)
    return default


def _set_platform_setting(db: Session, key: str, value, admin_user_id: int):
    """Upsert a key/value pair into the SQLite platform_settings table.

    Uses a query-then-update/insert pattern (SQLite-compatible upsert).
    Commits immediately so the authoritative write is durable before any
    best-effort Firestore sync is attempted.
    """
    try:
        serialised = json.dumps({"value": value})
        setting = db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
        if setting:
            setting.value = serialised
            setting.updated_by = admin_user_id
            setting.updated_at = datetime.now(timezone.utc)
        else:
            setting = PlatformSetting(
                key=key,
                value=serialised,
                updated_by=admin_user_id,
            )
            db.add(setting)
        db.commit()
    except Exception as exc:
        logger.error("[settings] _set_platform_setting error for key=%s: %s", key, exc)
        db.rollback()
        raise


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/")
def get_settings(
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin_role),
):
    # Primary: Firestore
    if firebase_connected and fdb is not None:
        try:
            return get_platform_settings()
        except Exception as exc:
            logger.warning("[settings] Firestore read failed, falling back to SQLite: %s", exc)

    # Secondary: SQLite platform_settings
    try:
        paused = _get_platform_setting(db, "isPlatformPaused", default=False)
        message = _get_platform_setting(
            db,
            "pauseMessage",
            default="Lumora is temporarily paused by the platform administrators",
        )
        return {
            "isPlatformPaused": paused,
            "pauseMessage": message,
            "lastUpdated": None,
            "updatedBy": "sqlite",
        }
    except Exception as exc:
        logger.warning("[settings] SQLite read failed, falling back to _local_platform_state: %s", exc)

    # Last resort: in-process dict
    return _local_platform_state


@router.put("/")
def update_settings(
    data: dict = Body(...),
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin_role),
):
    if not firebase_connected or fdb is None:
        _local_platform_state.update(data)
        try:
            log_admin_action(
                db=db,
                admin_user_id=admin_user.id,
                action="settings_updated",
                target_type=None,
                target_id=None,
                metadata={"keys": list(data.keys())},
            )
        except Exception as exc:
            logger.error("[settings] audit_log insert failed on update_settings: %s", exc)
            # Requirements 10.14: audit failure must not prevent the primary action.
        return {"success": True, "settings": _local_platform_state}
    try:
        doc_ref = fdb.collection("platformSettings").document("global")
        doc_ref.set(data, merge=True)
        try:
            log_admin_action(
                db=db,
                admin_user_id=admin_user.id,
                action="settings_updated",
                target_type=None,
                target_id=None,
                metadata={"keys": list(data.keys())},
            )
        except Exception as exc:
            logger.error("[settings] audit_log insert failed on update_settings: %s", exc)
            # Requirements 10.14: audit failure must not prevent the primary action.
        return {"success": True, "settings": get_platform_settings()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pause")
def pause_platform(
    data: dict = Body(None),
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin_role),
):
    message = (data.get("message") if data else None) or \
              "Lumora is temporarily paused by the platform administrators"
    now = datetime.now(timezone.utc).isoformat() + "Z"

    # ── SQLite is authoritative — write and commit first ─────────────────────
    _set_platform_setting(db, "isPlatformPaused", True, admin_user.id)
    _set_platform_setting(db, "pauseMessage", message, admin_user.id)

    # ── Audit log (non-blocking — failure must not prevent the primary action) ─
    try:
        log_admin_action(
            db=db,
            admin_user_id=admin_user.id,
            action="platform_pause",
            target_type=None,
            target_id=None,
            metadata={"message": message},
        )
    except Exception as exc:
        logger.error("[settings] audit_log insert failed on pause: %s", exc)
        # Requirements 10.6, 10.14: audit failure must not roll back the authoritative write.

    # ── Best-effort Firestore sync ────────────────────────────────────────────
    if firebase_connected and fdb is not None:
        try:
            doc_ref = fdb.collection("platformSettings").document("global")
            doc_ref.set(
                {
                    "isPlatformPaused": True,
                    "pauseMessage": message,
                    "lastUpdated": now,
                    "updatedBy": admin_user.email,
                },
                merge=True,
            )
        except Exception as exc:
            # SQLite commit already happened — log but do NOT raise.
            logger.error(
                "[settings] Firestore pause sync failed (SQLite write already committed): %s",
                exc,
            )

    return {"success": True, "message": "Platform paused successfully."}


@router.post("/resume")
def resume_platform(
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin_role),
):
    now = datetime.now(timezone.utc).isoformat() + "Z"

    # ── SQLite is authoritative — write and commit first ─────────────────────
    _set_platform_setting(db, "isPlatformPaused", False, admin_user.id)

    # ── Audit log (non-blocking — failure must not prevent the primary action) ─
    try:
        log_admin_action(
            db=db,
            admin_user_id=admin_user.id,
            action="platform_resume",
            target_type=None,
            target_id=None,
            metadata=None,
        )
    except Exception as exc:
        logger.error("[settings] audit_log insert failed on resume: %s", exc)
        # Requirements 10.7, 10.14: audit failure must not roll back the authoritative write.

    # ── Best-effort Firestore sync ────────────────────────────────────────────
    if firebase_connected and fdb is not None:
        try:
            doc_ref = fdb.collection("platformSettings").document("global")
            doc_ref.set(
                {
                    "isPlatformPaused": False,
                    "lastUpdated": now,
                    "updatedBy": admin_user.email,
                },
                merge=True,
            )
        except Exception as exc:
            logger.error(
                "[settings] Firestore resume sync failed (SQLite write already committed): %s",
                exc,
            )

    return {"success": True, "message": "Platform resumed successfully."}
