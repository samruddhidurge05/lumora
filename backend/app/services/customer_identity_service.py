from typing import Optional, Tuple, Dict, Any
from app.shared.firebase.connection import db as fs_db, firebase_connected
from app.models.user import User as UserModel

def _is_real_name(val: Optional[str]) -> bool:
    if not val or not val.strip():
        return False
    s = val.strip().lower()
    if s in ("user", "anonymous", "customer", "guest", "unknown", "default customer", "customer account"):
        return False
    if s.startswith("user #") or s.startswith("user#") or s.startswith("customer #") or s.startswith("customer#"):
        return False
    return True


def resolve_customer_identity(
    db_s=None,
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
    user_obj = None

    owned_db = False
    if db_s is None:
        try:
            from app.db.session import SessionLocal
            db_s = SessionLocal()
            owned_db = True
        except Exception:
            db_s = None

    try:
        # 1. Check fallback_doc dict if provided
        if fallback_doc and isinstance(fallback_doc, dict):
            for k in ("customerName", "fullName", "displayName", "userName", "name"):
                v = fallback_doc.get(k)
                if _is_real_name(v):
                    c_name = str(v).strip()
                    break
            for k in ("customerEmail", "userEmail", "email"):
                v = fallback_doc.get(k)
                if v and str(v).strip():
                    c_email = str(v).strip()
                    break

        # 2. Check SQL UserModel with type safety
        if user_id and not c_name and db_s is not None:
            try:
                if str(user_id).isdigit():
                    user_obj = db_s.query(UserModel).filter(UserModel.id == int(user_id)).first()
                if not user_obj:
                    user_obj = db_s.query(UserModel).filter(UserModel.firebase_uid == str(user_id)).first()
            except Exception:
                pass

            if user_obj:
                nm = getattr(user_obj, "name", None)
                if _is_real_name(nm):
                    c_name = str(nm).strip()
                em = getattr(user_obj, "email", None)
                if em and str(em).strip():
                    if not c_email:
                        c_email = str(em).strip()

        # 3. Check Firestore users & customers collection by document ID, firebase_uid, or email
        if firebase_connected and fs_db is not None and not c_name:
            uids_to_check = []
            if user_id:
                uids_to_check.append(str(user_id).strip())
            if user_obj:
                fb_uid = getattr(user_obj, "firebase_uid", None)
                if fb_uid and str(fb_uid).strip() and str(fb_uid).strip() not in uids_to_check:
                    uids_to_check.append(str(fb_uid).strip())

            try:
                # Check users and customers collections by document IDs
                for uid_val in uids_to_check:
                    if c_name:
                        break
                    u_doc = fs_db.collection("users").document(uid_val).get()
                    if u_doc.exists:
                        ud = u_doc.to_dict() or {}
                        nm = ud.get("fullName") or ud.get("displayName") or ud.get("name")
                        if _is_real_name(nm):
                            c_name = str(nm).strip()
                        if not c_email:
                            c_email = ud.get("email")

                    if not c_name:
                        cust_doc = fs_db.collection("customers").document(uid_val).get()
                        if cust_doc.exists:
                            cd = cust_doc.to_dict() or {}
                            nm = cd.get("fullName") or cd.get("displayName") or cd.get("name")
                            if _is_real_name(nm):
                                c_name = str(nm).strip()
                            if not c_email:
                                c_email = cd.get("email")

                # Check by query uid == uid_val
                for uid_val in uids_to_check:
                    if c_name:
                        break
                    q_users = list(fs_db.collection("users").where("uid", "==", uid_val).limit(1).stream())
                    if q_users:
                        ud = q_users[0].to_dict() or {}
                        nm = ud.get("fullName") or ud.get("displayName") or ud.get("name")
                        if _is_real_name(nm):
                            c_name = str(nm).strip()
                        if not c_email:
                            c_email = ud.get("email")

                    if not c_name:
                        q_custs = list(fs_db.collection("customers").where("uid", "==", uid_val).limit(1).stream())
                        if q_custs:
                            cd = q_custs[0].to_dict() or {}
                            nm = cd.get("fullName") or cd.get("displayName") or cd.get("name")
                            if _is_real_name(nm):
                                c_name = str(nm).strip()
                            if not c_email:
                                c_email = cd.get("email")

                # Check by query email == c_email if still no name
                if not c_name and c_email:
                    q_em_users = list(fs_db.collection("users").where("email", "==", c_email).limit(1).stream())
                    if q_em_users:
                        ud = q_em_users[0].to_dict() or {}
                        nm = ud.get("fullName") or ud.get("displayName") or ud.get("name")
                        if _is_real_name(nm):
                            c_name = str(nm).strip()

                    if not c_name:
                        q_em_custs = list(fs_db.collection("customers").where("email", "==", c_email).limit(1).stream())
                        if q_em_custs:
                            cd = q_em_custs[0].to_dict() or {}
                            nm = cd.get("fullName") or cd.get("displayName") or cd.get("name")
                            if _is_real_name(nm):
                                c_name = str(nm).strip()
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
                    if _is_real_name(nm):
                        c_name = str(nm).strip()
                    if not c_email:
                        em = od.get("customerEmail") or od.get("userEmail")
                        if em and str(em).strip():
                            c_email = str(em).strip()
            except Exception:
                pass

        # 5. Final resolution format
        if not _is_real_name(c_name):
            if c_email and "@" in c_email:
                c_name = c_email
            elif user_id:
                c_name = f"User #{user_id}"
            else:
                c_name = "Customer Account"

        if not c_email:
            c_email = ""

        if not c_name:
            c_name = "Customer Account"

        return c_name, c_email
    finally:
        if owned_db and db_s is not None:
            try:
                db_s.close()
            except Exception:
                pass
