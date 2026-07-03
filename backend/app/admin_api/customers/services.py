from app.shared.firebase.connection import db, firebase_connected
from datetime import datetime
from fastapi import HTTPException
from app.db.session import SessionLocal
from app.models.user import User as UserModel

def _map_user(doc):
    data = doc.to_dict()
    display = (
        data.get("displayName")
        or data.get("fullName")
        or data.get("name")
        or "User"
    )
    raw_role = (data.get("role") or "user").lower()
    normalized_role = "customer" if raw_role in ("user", "customer", "") else raw_role
    return {
        "id":          doc.id,
        "uid":         doc.id,
        "displayName": display,
        "email":       data.get("email", ""),
        "role":        normalized_role,
        "createdAt":   data.get("createdAt") or datetime.utcnow().isoformat() + "Z",
        "status":      data.get("accountStatus") or data.get("status", "active"),
    }

def _map_user_sqlite(user):
    return {
        "id":          str(user.id),
        "uid":         str(user.id),
        "displayName": user.name or "User",
        "email":       user.email,
        "role":        "customer" if (user.role or "").lower() in ("user", "customer", "") else (user.role or "customer").lower(),
        "createdAt":   user.created_at.isoformat() + "Z" if user.created_at else datetime.utcnow().isoformat() + "Z",
        "status":      "active" if user.is_active else "disabled",
    }

def get_customers_list():
    if not firebase_connected or db is None:
        db_s = SessionLocal()
        try:
            users = db_s.query(UserModel).filter(UserModel.role.in_(["customer", "Customer", "user", "User", ""])).all()
            return [_map_user_sqlite(u) for u in users]
        finally:
            db_s.close()

    users_ref = db.collection("users")
    customers = []
    for role_value in ("customer", "user"):
        try:
            docs = users_ref.where("role", "==", role_value).stream()
            for d in docs:
                customers.append(_map_user(d))
        except Exception:
            pass

    if customers:
        seen = set()
        unique = []
        for c in customers:
            if c["id"] not in seen:
                seen.add(c["id"])
                unique.append(c)
        return unique

    docs = users_ref.stream()
    return [
        _map_user(d)
        for d in docs
        if (d.to_dict().get("role") or "user").lower()
        not in ("admin", "vendor", "affiliate")
    ]

def get_customer_by_id(customer_id: str):
    if not firebase_connected or db is None:
        db_s = SessionLocal()
        try:
            user = db_s.query(UserModel).filter(UserModel.id == int(customer_id)).first()
            if not user:
                raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found.")
            return _map_user_sqlite(user)
        finally:
            db_s.close()

    snap = db.collection("users").document(customer_id).get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found.")
    return _map_user(snap)

def modify_customer(customer_id: str, data: dict):
    db_s = SessionLocal()
    try:
        user = db_s.query(UserModel).filter(UserModel.id == int(customer_id)).first()
        if user:
            if "displayName" in data:
                user.name = data["displayName"]
            elif "name" in data:
                user.name = data["name"]
            db_s.commit()
    finally:
        db_s.close()

    if firebase_connected and db is not None:
        db.collection("users").document(customer_id).update({
            **data,
            "updatedAt": datetime.utcnow().isoformat() + "Z",
        })
    return {"id": customer_id, **data}
