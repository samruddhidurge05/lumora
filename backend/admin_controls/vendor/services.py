from app.db.session import SessionLocal
from app.models.user import User as UserModel
from admin_controls.vendor.firestore import update_vendor_status_in_firestore, get_vendor_status_from_firestore
from app.shared.firebase.connection import db, firebase_connected

def update_vendor_status(uid: str, status_val: str):
    """
    Update vendor status in Firestore and sync to SQLite.
    """
    # 1. Update Firestore collections (users, vendors)
    update_vendor_status_in_firestore(uid, status_val)
    
    # 2. Get the email from Firestore user doc to locate the SQLite user
    email = None
    if firebase_connected and db is not None:
        try:
            doc_ref = db.collection("users").document(uid)
            snap = doc_ref.get()
            if snap.exists:
                email = snap.to_dict().get("email")
        except Exception:
            pass
            
    # 3. If email is not found, fallback: maybe uid is the SQLite user ID
    db_s = SessionLocal()
    try:
        user = None
        if email:
            user = db_s.query(UserModel).filter(UserModel.email == email.lower()).first()
        if not user:
            try:
                user = db_s.query(UserModel).filter(UserModel.id == int(uid)).first()
            except ValueError:
                pass
                
        if user:
            # Sync is_active flag in SQLite
            is_active = (status_val.lower() == "active")
            user.is_active = is_active
            
            # Sync vendor profile status in SQLite
            from app.models.vendor import Vendor
            vendor = db_s.query(Vendor).filter(Vendor.id == str(user.id)).first()
            if vendor:
                vendor.status = status_val.lower()
            
            db_s.commit()
    finally:
        db_s.close()
