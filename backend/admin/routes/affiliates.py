from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from admin.validators.admin_auth import require_admin_role
from admin_controls.affiliate.services import update_affiliate_status
from app.shared.firebase.connection import db, firebase_connected

router = APIRouter()

class AffiliateStatusUpdateSchema(BaseModel):
    status: str

@router.get("/")
def list_affiliates(admin_user = Depends(require_admin_role)):
    if not firebase_connected or db is None:
        from app.db.session import SessionLocal
        from app.models.user import User as UserModel
        from app.models.affiliate import AffiliateProfile
        db_s = SessionLocal()
        try:
            # Primary: find users with role="affiliate" in SQLite
            role_affiliates = db_s.query(UserModel).filter(
                UserModel.role.in_(["affiliate", "Affiliate"])
            ).all()

            # Secondary: find users who have an AffiliateProfile record
            # (covers users who registered as affiliate via Firebase but whose
            # SQLite role was set to "vendor" or "customer" due to dual-role)
            profile_user_ids = {p.user_id for p in db_s.query(AffiliateProfile).all()}
            profile_users = db_s.query(UserModel).filter(
                UserModel.id.in_(profile_user_ids)
            ).all() if profile_user_ids else []

            # Merge — deduplicate by id
            seen = set()
            result = []
            for u in role_affiliates + profile_users:
                if u.id not in seen:
                    seen.add(u.id)
                    # Get affiliate profile for extra data (code, clicks, etc.)
                    aff_profile = db_s.query(AffiliateProfile).filter(
                        AffiliateProfile.user_id == u.id
                    ).first()
                    result.append({
                        "uid": str(u.id),
                        "id": str(u.id),
                        "displayName": u.name or "Affiliate",
                        "email": u.email,
                        "role": "affiliate",
                        "status": "active" if u.is_active else "disabled",
                        "createdAt": u.created_at.isoformat() + "Z" if u.created_at else "",
                        "affiliateCode": aff_profile.referral_code if aff_profile else "",
                        "totalClicks": aff_profile.total_clicks if aff_profile else 0,
                        "totalConversions": aff_profile.total_sales if aff_profile else 0,
                        "totalCommission": float(aff_profile.total_earnings) if aff_profile else 0.0,
                    })
            return result
        finally:
            db_s.close()
    try:
        users = []
        for r_val in ("affiliate", "Affiliate"):
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
def change_affiliate_status(
    uid: str,
    payload: AffiliateStatusUpdateSchema,
    admin_user = Depends(require_admin_role)
):
    try:
        update_affiliate_status(uid, payload.status)
        return {"success": True, "message": f"Affiliate status updated to {payload.status}."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
