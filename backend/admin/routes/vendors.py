import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from admin.validators.admin_auth import require_admin_role
from admin_controls.vendor.services import update_vendor_status
from app.shared.firebase.connection import db as fdb, firebase_connected
from app.db.session import get_db
from app.models.user import User
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)

router = APIRouter()

class VendorStatusUpdateSchema(BaseModel):
    status: str

@router.get("/")
def list_vendors(admin_user = Depends(require_admin_role)):
    if not firebase_connected or fdb is None:
        from app.db.session import SessionLocal
        from app.models.user import User as UserModel
        from app.models.product import Product
        db_s = SessionLocal()
        try:
            # Primary: users with role="vendor"
            role_vendors = db_s.query(UserModel).filter(
                UserModel.role.in_(["vendor", "Vendor"])
            ).all()

            # Secondary: users who have uploaded products (may have role="customer" in SQLite)
            product_vendor_ids = {
                p.vendor_id for p in db_s.query(Product.vendor_id).distinct().all()
                if p.vendor_id
            }
            product_users = db_s.query(UserModel).filter(
                UserModel.id.in_([int(v) for v in product_vendor_ids if str(v).isdigit()])
            ).all() if product_vendor_ids else []

            seen = set()
            result = []
            for u in role_vendors + product_users:
                if u.id not in seen:
                    seen.add(u.id)
                    result.append({
                        "uid": str(u.id),
                        "id": str(u.id),
                        "displayName": u.name or "Vendor",
                        "email": u.email,
                        "role": "vendor",
                        "status": "active" if u.is_active else "disabled",
                        "createdAt": u.created_at.isoformat() + "Z" if u.created_at else "",
                    })
            return result
        finally:
            db_s.close()
    try:
        users = []
        for r_val in ("vendor", "Vendor"):
            snap = fdb.collection("users").where("role", "==", r_val).stream()
            for doc in snap:
                data = doc.to_dict()
                users.append({"uid": doc.id, **data})
        seen = set()
        unique_users = []
        for u in users:
            if u["uid"] not in seen:
                seen.add(u["uid"])
                unique_users.append(u)
        return unique_users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{uid}/status")
def change_vendor_status(
    uid: str,
    payload: VendorStatusUpdateSchema,
    admin_user = Depends(require_admin_role)
):
    try:
        update_vendor_status(uid, payload.status)
        return {"success": True, "message": f"Vendor status updated to {payload.status}."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/{id}/enable")
def enable_vendor(
    id: int,
    admin_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    user.is_active = True
    audit = AuditLog(
        admin_user_id=admin_user.id,
        action="vendor_enable",
        target_type="vendor",
        target_id=str(id),
    )
    db.add(audit)

    # Notify vendor and log activity
    from app.services.notification_service import NotificationService
    from app.services.activity_log_service import ActivityLogService
    NotificationService.create_notification(
        db=db,
        user_id=id,
        title="Account Re-activated! ✦",
        message="Your vendor account has been re-activated by the administration.",
        category="account"
    )
    ActivityLogService.log_user_activity(
        db=db,
        user_id=id,
        activity_type="vendor_status_change",
        details="Vendor account status set to enabled by administrator."
    )

    db.commit()

    if firebase_connected and fdb is not None and user.firebase_uid:
        try:
            fdb.collection("users").document(user.firebase_uid).set(
                {"accountStatus": "active"}, merge=True
            )
        except Exception as exc:
            logger.error("[vendor_enable] Firestore write failed for uid=%s: %s", user.firebase_uid, exc)

    return {"success": True, "message": f"Vendor {id} has been enabled."}


@router.post("/{id}/disable")
def disable_vendor(
    id: int,
    admin_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    user.is_active = False
    audit = AuditLog(
        admin_user_id=admin_user.id,
        action="vendor_disable",
        target_type="vendor",
        target_id=str(id),
    )
    db.add(audit)

    # Notify vendor and log activity
    from app.services.notification_service import NotificationService
    from app.services.activity_log_service import ActivityLogService
    NotificationService.create_notification(
        db=db,
        user_id=id,
        title="Account Deactivated ✦",
        message="Your vendor account has been deactivated by the administration.",
        category="account"
    )
    ActivityLogService.log_user_activity(
        db=db,
        user_id=id,
        activity_type="vendor_status_change",
        details="Vendor account status set to disabled by administrator."
    )

    db.commit()

    if firebase_connected and fdb is not None and user.firebase_uid:
        try:
            fdb.collection("users").document(user.firebase_uid).set(
                {"accountStatus": "disabled"}, merge=True
            )
        except Exception as exc:
            logger.error("[vendor_disable] Firestore write failed for uid=%s: %s", user.firebase_uid, exc)

    return {"success": True, "message": f"Vendor {id} has been disabled."}


@router.post("/{id}/restrict")
def restrict_vendor(
    id: int,
    admin_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    # is_active is left unchanged for restrict
    audit = AuditLog(
        admin_user_id=admin_user.id,
        action="vendor_restrict",
        target_type="vendor",
        target_id=str(id),
    )
    db.add(audit)

    # Notify vendor and log activity
    from app.services.notification_service import NotificationService
    from app.services.activity_log_service import ActivityLogService
    NotificationService.create_notification(
        db=db,
        user_id=id,
        title="Account Restricted ✦",
        message="Your vendor account has been restricted by the administration.",
        category="account"
    )
    ActivityLogService.log_user_activity(
        db=db,
        user_id=id,
        activity_type="vendor_status_change",
        details="Vendor account status set to restricted by administrator."
    )

    db.commit()

    if firebase_connected and fdb is not None and user.firebase_uid:
        try:
            fdb.collection("users").document(user.firebase_uid).set(
                {"accountStatus": "restricted"}, merge=True
            )
        except Exception as exc:
            logger.error("[vendor_restrict] Firestore write failed for uid=%s: %s", user.firebase_uid, exc)


    return {"success": True, "message": f"Vendor {id} has been restricted."}
