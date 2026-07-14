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

_firestore_broken = False

def get_customers_list(page: int = 1, page_size: int = 50, search: str = None):
    global _firestore_broken
    page = max(1, page)
    page_size = max(1, min(200, page_size))

    if not firebase_connected or db is None or _firestore_broken:
        db_s = SessionLocal()
        try:
            q = db_s.query(UserModel).filter(UserModel.role.in_(["customer", "Customer", "user", "User", ""]))
            if search:
                term = f"%{search.lower()}%"
                from sqlalchemy import or_, func
                q = q.filter(or_(
                    func.lower(UserModel.email).like(term),
                    func.lower(UserModel.name).like(term)
                ))
            total = q.count()
            users = q.offset((page - 1) * page_size).limit(page_size).all()
            return {"total": total, "page": page, "page_size": page_size, "items": [_map_user_sqlite(u) for u in users]}
        finally:
            db_s.close()

    # Firestore path — native paginated database queries with robust fallback
    from firebase_admin import firestore
    query_ref = db.collection("users").where("role", "in", ["customer", "user", ""])
    # Note: when search is active we still need the role filter.
    # Fetch all matching-role docs and apply text filter in memory — Firestore
    # does not support compound inequality queries so this is the correct approach.

    try:
        # When search is active, fetch all role-filtered docs and filter in memory.
        # This keeps the role filter intact and avoids the Firestore compound-inequality limitation.
        if search:
            docs = list(query_ref.stream())
            all_items = [_map_user(d) for d in docs
                         if (d.to_dict().get("role") or "customer").lower() in ("customer", "user", "")]
            term = search.lower()
            all_items = [c for c in all_items
                         if term in c["displayName"].lower() or term in c["email"].lower()]
            total = len(all_items)
            all_items.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
            items = all_items[(page - 1) * page_size: page * page_size]
        else:
            try:
                total = query_ref.count().get()[0][0].value
            except Exception:
                total = len(list(query_ref.stream()))

            paginated_query = query_ref.order_by("createdAt", direction=firestore.Query.DESCENDING).offset((page - 1) * page_size).limit(page_size)
            docs = list(paginated_query.stream())
            items = [_map_user(d) for d in docs
                     if (d.to_dict().get("role") or "customer").lower() in ("customer", "user", "")]
    except Exception as e:
        print(f"[customers] Firestore query failed: {e}. Falling back to SQLite.")
        _firestore_broken = True
        return get_customers_list(page, page_size, search)

    return {"total": total, "page": page, "page_size": page_size, "items": items}

def get_customer_by_id(customer_id: str):
    global _firestore_broken
    if not firebase_connected or db is None or _firestore_broken:
        db_s = SessionLocal()
        try:
            user = db_s.query(UserModel).filter(UserModel.id == int(customer_id)).first()
            if not user:
                raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found.")
            return _map_user_sqlite(user)
        finally:
            db_s.close()

    try:
        snap = db.collection("users").document(customer_id).get()
        if not snap.exists:
            raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found.")
        return _map_user(snap)
    except Exception as e:
        print(f"[customers] Firestore get failed: {e}. Falling back to SQLite.")
        _firestore_broken = True
        return get_customer_by_id(customer_id)

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
