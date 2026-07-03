from fastapi import APIRouter, Depends, HTTPException, Body
from admin.validators.admin_auth import require_admin_role
from admin.firestore.admin_firestore import get_platform_settings
from app.shared.firebase.connection import db, firebase_connected
from datetime import datetime, timezone

router = APIRouter()

# ── In-process fallback store when Firestore is unavailable ─────────────────
# This survives for the lifetime of the server process and is enough for
# local / offline development where firebase-admin is not installed.
_local_platform_state: dict = {
    "isPlatformPaused": False,
    "pauseMessage": "Lumora is temporarily paused by the platform administrators",
    "lastUpdated": datetime.now(timezone.utc).isoformat() + "Z",
    "updatedBy": "system",
}


@router.get("/")
def get_settings(admin_user = Depends(require_admin_role)):
    if firebase_connected and db is not None:
        return get_platform_settings()
    return _local_platform_state

@router.put("/")
def update_settings(data: dict = Body(...), admin_user = Depends(require_admin_role)):
    if not firebase_connected or db is None:
        _local_platform_state.update(data)
        return {"success": True, "settings": _local_platform_state}
    try:
        doc_ref = db.collection("platformSettings").document("global")
        doc_ref.set(data, merge=True)
        return {"success": True, "settings": get_platform_settings()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pause")
def pause_platform(data: dict = Body(None), admin_user = Depends(require_admin_role)):
    message = (data.get("message") if data else None) or \
              "Lumora is temporarily paused by the platform administrators"
    now = datetime.now(timezone.utc).isoformat() + "Z"

    if not firebase_connected or db is None:
        _local_platform_state.update({
            "isPlatformPaused": True,
            "pauseMessage": message,
            "lastUpdated": now,
            "updatedBy": admin_user.email,
        })
        return {"success": True, "message": "Platform paused successfully (local mode)."}
    try:
        doc_ref = db.collection("platformSettings").document("global")
        doc_ref.set({
            "isPlatformPaused": True,
            "pauseMessage": message,
            "lastUpdated": now,
            "updatedBy": admin_user.email
        }, merge=True)
        return {"success": True, "message": "Platform paused successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/resume")
def resume_platform(admin_user = Depends(require_admin_role)):
    now = datetime.now(timezone.utc).isoformat() + "Z"

    if not firebase_connected or db is None:
        _local_platform_state.update({
            "isPlatformPaused": False,
            "lastUpdated": now,
            "updatedBy": admin_user.email,
        })
        return {"success": True, "message": "Platform resumed successfully (local mode)."}
    try:
        doc_ref = db.collection("platformSettings").document("global")
        doc_ref.set({
            "isPlatformPaused": False,
            "lastUpdated": now,
            "updatedBy": admin_user.email
        }, merge=True)
        return {"success": True, "message": "Platform resumed successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
