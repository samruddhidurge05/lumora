from app.shared.firebase.connection import db, firebase_connected
from datetime import datetime, timezone

def _require_db():
    if not firebase_connected or db is None:
        raise RuntimeError("Firestore is not connected.")

def update_affiliate_status_in_firestore(uid: str, status_val: str):
    """
    Update affiliate status in Firestore users and affiliates collections.
    Status can be: active, suspended, disabled, restricted.
    When Firestore is unavailable, silently skips (SQLite sync still happens in services.py).
    """
    if not firebase_connected or db is None:
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
    
    # Update affiliates collection
    affiliate_ref = db.collection("affiliates").document(uid)
    affiliate_ref.set({
        "status": status_val,
        "updatedAt": now_str
    }, merge=True)

def get_affiliate_status_from_firestore(uid: str) -> str:
    """
    Get affiliate status from Firestore users or affiliates collection.
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
        
    # Fallback to affiliates collection
    affiliate_ref = db.collection("affiliates").document(uid)
    affiliate_snap = affiliate_ref.get()
    if affiliate_snap.exists:
        data = affiliate_snap.to_dict()
        return data.get("status", "active").lower()
        
    return "active"
