from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from admin.validators.admin_auth import require_admin_role
from admin_controls.vendor.services import update_vendor_status
from app.shared.firebase.connection import db, firebase_connected

router = APIRouter()

class VendorStatusUpdateSchema(BaseModel):
    status: str

@router.get("/")
def list_vendors(admin_user = Depends(require_admin_role)):
    if not firebase_connected or db is None:
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
            snap = db.collection("users").where("role", "==", r_val).stream()
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
