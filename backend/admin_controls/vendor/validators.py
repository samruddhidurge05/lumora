from fastapi import HTTPException, status
from app.shared.firebase.connection import db, firebase_connected
from app.db.session import SessionLocal
from app.models.user import User as UserModel
from admin_controls.vendor.firestore import get_vendor_status_from_firestore

def check_vendor_enabled(vendor_id: str):
    """
    Check if a vendor is active and enabled.
    Raises 403 Forbidden if suspended, disabled, or rejected.
    """
    db_s = SessionLocal()
    try:
        user = None
        try:
            user = db_s.query(UserModel).filter(UserModel.id == int(vendor_id)).first()
        except ValueError:
            user = db_s.query(UserModel).filter(UserModel.email == vendor_id.lower()).first()
            
        if user and not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vendor account is disabled or suspended."
            )
            
        if not firebase_connected or db is None:
            # Fallback to local check was sufficient
            return
            
        email = user.email if user else None
        firestore_uid = vendor_id
        if user:
            try:
                users_ref = db.collection("users")
                query_ref = users_ref.where("email", "==", email.lower()).limit(1).stream()
                docs = list(query_ref)
                if docs:
                    firestore_uid = docs[0].id
            except Exception:
                pass
    finally:
        db_s.close()
        
    # 2. Query status from Firestore
    status_val = get_vendor_status_from_firestore(firestore_uid)
    if status_val in ("suspended", "disabled", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vendor account is disabled or suspended."
        )
