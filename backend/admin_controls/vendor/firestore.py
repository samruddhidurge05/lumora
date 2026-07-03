from app.shared.firebase.connection import db, firebase_connected
from datetime import datetime, timezone

def _require_db():
    if not firebase_connected or db is None:
        raise RuntimeError("Firestore is not connected.")

def update_vendor_status_in_firestore(uid: str, status_val: str):
    """
    Update vendor status in Firestore users and vendors collections.
    Status can be: active, suspended, disabled, restricted.
    When Firestore is unavailable, silently skips (SQLite sync still happens in services.py).
    """
    if not firebase_connected or db is None:
        # No Firestore — SQLite-only mode; caller handles the DB update
        return
    
    # Normalize inputs
    status_val = status_val.lower()
    
    # Map users collection display status
    user_status = "Approved" if status_val == "active" else status_val.capitalize()
    is_approved = (status_val == "active")
    
    now_str = datetime.now(timezone.utc).isoformat()
    
    # Update users collection
    user_ref = db.collection("users").document(uid)
    user_ref.set({
      "accountStatus": status_val,
      "status": user_status,
      "isApproved": is_approved,
      "isActive": is_approved,
      "updatedAt": now_str
    }, merge=True)
    
    # Update vendors collection
    vendor_ref = db.collection("vendors").document(uid)
    vendor_ref.set({
        "status": status_val,
        "isApproved": is_approved,
        "updatedAt": now_str
    }, merge=True)

def get_vendor_status_from_firestore(uid: str) -> str:
    """
    Get vendor status from Firestore users or vendors collection.
    Falls back to 'active' when Firestore is unavailable.
    """
    if not firebase_connected or db is None:
        return "active"
    
    # Check users doc
    user_ref = db.collection("users").document(uid)
    user_snap = user_ref.get()
    if user_snap.exists:
        data = user_snap.to_dict()
        return data.get("accountStatus", "active").lower()
        
    # Fallback to vendors collection
    vendor_ref = db.collection("vendors").document(uid)
    vendor_snap = vendor_ref.get()
    if vendor_snap.exists:
        data = vendor_snap.to_dict()
        return data.get("status", "active").lower()
        
    return "active"
