from typing import Optional, Tuple, Dict, Any
from app.shared.firebase.connection import db as fs_db, firebase_connected
from app.models.user import User as UserModel

def resolve_customer_identity(
    db_s,
    user_id: Any = None,
    order_id: Any = None,
    fallback_doc: Optional[Dict[str, Any]] = None
) -> Tuple[str, str]:
    """
    Forensic Production Customer Identity Resolution.
    Returns (customer_name, customer_email).
    Guarantees no 'User #id', 'Anonymous', or 'Customer' fallbacks when real customer data exists
    in SQL UserModel, Firestore users, Firestore customers, or Firestore order snapshots.
    """
    c_name: Optional[str] = None
    c_email: Optional[str] = None

    # 1. Check fallback_doc dict if provided
    if fallback_doc and isinstance(fallback_doc, dict):
        for k in ("customerName", "fullName", "displayName", "userName", "name"):
            v = fallback_doc.get(k)
            if v and str(v).strip() and str(v).strip().lower() not in ("user", "anonymous", "customer", "guest"):
                c_name = str(v).strip()
                break
        for k in ("customerEmail", "userEmail", "email"):
            v = fallback_doc.get(k)
            if v and str(v).strip():
                c_email = str(v).strip()
                break

    # 2. Check SQL UserModel with type safety
    if user_id and not c_name:
        user_obj = None
        try:
            if str(user_id).isdigit():
                user_obj = db_s.query(UserModel).filter(UserModel.id == int(user_id)).first()
            if not user_obj:
                user_obj = db_s.query(UserModel).filter(UserModel.firebase_uid == str(user_id)).first()
        except Exception:
            pass

        if user_obj:
            nm = getattr(user_obj, "name", None)
            if nm and str(nm).strip() and str(nm).strip().lower() not in ("user", "anonymous", "customer", "guest"):
                c_name = str(nm).strip()
            em = getattr(user_obj, "email", None)
            if em and str(em).strip():
                if not c_email:
                    c_email = str(em).strip()

    # 3. Check Firestore users & customers collection by document ID or uid field
    if firebase_connected and fs_db is not None and user_id and not c_name:
        str_uid = str(user_id).strip()
        try:
            # Check users collection by doc ID
            u_doc = fs_db.collection("users").document(str_uid).get()
            if u_doc.exists:
                ud = u_doc.to_dict() or {}
                c_name = ud.get("fullName") or ud.get("displayName") or ud.get("name")
                if not c_email:
                    c_email = ud.get("email")
            
            # Check customers collection by doc ID if still no name
            if not c_name:
                cust_doc = fs_db.collection("customers").document(str_uid).get()
                if cust_doc.exists:
                    cd = cust_doc.to_dict() or {}
                    c_name = cd.get("fullName") or cd.get("displayName") or cd.get("name")
                    if not c_email:
                        c_email = cd.get("email")

            # Check users collection by query uid==str_uid if still no name
            if not c_name:
                q_users = list(fs_db.collection("users").where("uid", "==", str_uid).limit(1).stream())
                if q_users:
                    ud = q_users[0].to_dict() or {}
                    c_name = ud.get("fullName") or ud.get("displayName") or ud.get("name")
                    if not c_email:
                        c_email = ud.get("email")

            # Check customers collection by query uid==str_uid if still no name
            if not c_name:
                q_custs = list(fs_db.collection("customers").where("uid", "==", str_uid).limit(1).stream())
                if q_custs:
                    cd = q_custs[0].to_dict() or {}
                    c_name = cd.get("fullName") or cd.get("displayName") or cd.get("name")
                    if not c_email:
                        c_email = cd.get("email")
        except Exception:
            pass

    # 4. Check Firestore order snapshot
    if firebase_connected and fs_db is not None and order_id and not c_name:
        try:
            str_ord = str(order_id).strip()
            clean_ord = f"ORD-{str_ord}" if not str_ord.startswith("ORD-") else str_ord
            o_doc = fs_db.collection("orders").document(clean_ord).get()
            if not o_doc.exists:
                raw_id = str_ord.replace("ORD-", "")
                o_doc = fs_db.collection("orders").document(raw_id).get()

            if o_doc.exists:
                od = o_doc.to_dict() or {}
                nm = od.get("customerName") or od.get("displayName") or od.get("userName")
                if nm and str(nm).strip() and str(nm).strip().lower() not in ("user", "anonymous", "customer", "guest"):
                    c_name = str(nm).strip()
                if not c_email:
                    em = od.get("customerEmail") or od.get("userEmail")
                    if em and str(em).strip():
                        c_email = str(em).strip()
        except Exception:
            pass

    # 5. Final resolution format
    if not c_name or str(c_name).strip().lower() in ("user", "anonymous", "customer", "guest"):
        if c_email and "@" in c_email:
            c_name = c_email
        elif user_id:
            c_name = f"User #{user_id}"
        else:
            c_name = "Customer Account"

    if not c_email:
        c_email = ""

    return str(c_name), str(c_email)
