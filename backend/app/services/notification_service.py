from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.shared.firebase.connection import db as fs_db, firebase_connected
from datetime import datetime, timezone

class NotificationService:
    @staticmethod
    def create_notification(
        db: Session,
        user_id: int,
        title: str,
        message: str,
        category: str = "general"
    ) -> Notification:
        # 1. Create in SQLite database (Single Source of Truth)
        notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            category=category,
            is_read=False
        )
        db.add(notif)
        db.flush()  # Populates notif.id before committing

        # 2. Sync to Firestore (Read-Only Mirror for Real-Time UI updates)
        if firebase_connected and fs_db is not None:
            try:
                # We can write to a collection matching the user's notification feed
                doc_ref = fs_db.collection("userNotifications").document(f"notif_{notif.id}")
                doc_ref.set({
                    "id": notif.id,
                    "userId": str(user_id),
                    "title": title,
                    "text": message,
                    "message": message,
                    "category": category,
                    "read": False,
                    "is_read": False,
                    "createdAt": datetime.now(timezone.utc).isoformat() + "Z",
                })
            except Exception as e:
                print(f"[NotificationService] Firestore sync error (non-fatal): {e}")

        return notif

    @staticmethod
    def create_vendor_sale_notification(
        db: Session,
        vendor_firebase_uid: str,
        buyer_name: str,
        product_name: str,
        amount: float,
        order_id: str
    ) -> None:
        """
        Creates a notification for the vendor.
        Handles both SQLite user reference if matches vendor_firebase_uid, and Firestore updates.
        """
        from app.models.user import User
        vendor_user = db.query(User).filter(User.firebase_uid == vendor_firebase_uid).first()
        
        msg = f"New Sale! {buyer_name} purchased your product '{product_name}' for ₹{amount:.2f}."
        if vendor_user:
            NotificationService.create_notification(
                db=db,
                user_id=vendor_user.id,
                title="Product Sold ✦",
                message=msg,
                category="purchase"
            )
            
        # Write to vendorNotifications collection in Firestore for real-time seller updates
        if firebase_connected and fs_db is not None:
            try:
                notif_ref = fs_db.collection("vendorNotifications").document()
                notif_ref.set({
                    "vendorId": vendor_firebase_uid,
                    "orderId": order_id,
                    "buyerName": buyer_name,
                    "productName": product_name,
                    "amount": float(amount),
                    "type": "sale",
                    "read": False,
                    "createdAt": datetime.now(timezone.utc).isoformat() + "Z"
                })
            except Exception as e:
                print(f"[NotificationService] Firestore vendor sale sync error (non-fatal): {e}")
