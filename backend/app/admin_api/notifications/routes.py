from fastapi import APIRouter, Depends
from datetime import datetime, timedelta
from admin.validators.admin_auth import require_admin_role
from app.db.session import get_db
from app.models.conversation import Conversation
from app.models.user import User
from app.shared.firebase.connection import db as firestore_db, firebase_connected
from sqlalchemy.orm import Session

router = APIRouter()

# 30-second server-side cache
_cache: dict = {"data": None, "expires_at": None}


@router.get("/counts")
def get_notification_counts(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    now = datetime.utcnow()
    if _cache["data"] and _cache["expires_at"] and now < _cache["expires_at"]:
        return _cache["data"]

    # Support tickets: open tickets in SQLite
    try:
        support_tickets = db.query(Conversation).filter(
            Conversation.type == "support_ticket",
            Conversation.status == "open",
        ).count()
    except Exception:
        support_tickets = 0

    # Reports: pending in Firestore (excludes contact_requests, counted separately)
    reports = 0
    contact_requests = 0
    if firebase_connected and firestore_db is not None:
        try:
            docs = firestore_db.collection("reports").where("status", "==", "Pending").stream()
            for d in docs:
                data = d.to_dict()
                if data.get("category") == "contact_request":
                    contact_requests += 1
                else:
                    reports += 1
        except Exception:
            reports = 0
            contact_requests = 0

    # Pending orders: in Firestore
    pending_orders = 0
    if firebase_connected and firestore_db is not None:
        try:
            docs = list(firestore_db.collection("orders").stream())
            pending_orders = sum(
                1 for d in docs
                if d.to_dict().get("status") in ("Pending", "Processing", "pending", "processing")
            )
        except Exception:
            pending_orders = 0

    # Pending admin invitations (not yet accepted, not expired, not revoked)
    team_invites = 0
    try:
        from app.models.admin_invitation import AdminInvitation
        team_invites = db.query(AdminInvitation).filter(
            AdminInvitation.accepted_at == None,
            AdminInvitation.expires_at > now,
            AdminInvitation.revoked_at == None,
        ).count()
    except Exception:
        team_invites = 0

    result = {
        "support_tickets": support_tickets,
        "reports": reports,
        "contact_requests": contact_requests,
        "pending_orders": pending_orders,
        "team_invites": team_invites,
        "total": support_tickets + reports + contact_requests + pending_orders + team_invites,
    }

    _cache["data"] = result
    _cache["expires_at"] = now + timedelta(seconds=30)
    return result
