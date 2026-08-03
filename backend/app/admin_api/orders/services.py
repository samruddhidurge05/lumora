from app.shared.firebase.connection import db, firebase_connected
from firebase_admin import firestore
from datetime import datetime, timezone
from fastapi import HTTPException
from app.db.session import SessionLocal
from app.models.order import Order as OrderModel
from app.models.user import User as UserModel


def _get_order_commission_amt(db_s, order_id: int) -> float:
    """
    Return the total affiliate commission amount for an order from the
    affiliate_commissions table.  Returns 0.0 when no commission exists.
    This is the ONLY source of commission truth — no calculation performed here.
    """
    try:
        from sqlalchemy import func
        from app.models.affiliate import AffiliateCommission
        result = (
            db_s.query(func.coalesce(func.sum(AffiliateCommission.commission_amt), 0.0))
            .filter(
                AffiliateCommission.order_id == order_id,
                # Exclude reversed/rejected commissions — those are no longer owed
                AffiliateCommission.commission_status.notin_(["reversed", "rejected", "cancelled"]),
            )
            .scalar()
        )
        return round(float(result or 0.0), 2)
    except Exception:
        return 0.0


def get_orders_list(page: int = 1, page_size: int = 50, status: str | None = None):
    page = max(1, page)
    page_size = max(1, min(200, page_size))

    # Always use SQLite as the primary source for the admin orders list.
    # Firestore is the real-time mirror for customers - SQLite is the
    # source of truth for admin operations and is always available locally.
    db_s = SessionLocal()
    try:
        q = db_s.query(OrderModel).order_by(OrderModel.created_at.desc())
        if status:
            q = q.filter(OrderModel.status.ilike(status))
        total = q.count()
        orders = q.offset((page - 1) * page_size).limit(page_size).all()
        result = []
        for o in orders:
            try:
                customer = db_s.query(UserModel).filter(UserModel.id == o.user_id).first() if o.user_id else None
                cust_name = getattr(customer, "name", None) or "Customer"
                cust_email = getattr(customer, "email", None) or ""
            except Exception:
                cust_name = "Customer"
                cust_email = ""

            items_data = []
            try:
                if hasattr(o, "items") and o.items:
                    for item in o.items:
                        prod_title = "Product"
                        try:
                            if item.product and hasattr(item.product, "title") and item.product.title:
                                prod_title = item.product.title
                        except Exception:
                            prod_title = "Product"

                        items_data.append({
                            "productId": str(getattr(item, "product_id", "") or ""),
                            "productName": prod_title,
                            "price": float(getattr(item, "price_paid", 0.0) or 0.0),
                        })
            except Exception as e:
                print(f"[get_orders_list] Error loading items for order {o.id}: {e}")

            customer_paid = float(o.total_amount or 0.0)
            affiliate_commission = _get_order_commission_amt(db_s, o.id)
            net_platform_revenue = round(customer_paid - affiliate_commission, 2)

            created_at_str = ""
            if o.created_at:
                try:
                    created_at_str = o.created_at.isoformat() + "Z"
                except Exception:
                    created_at_str = str(o.created_at)

            result.append({
                "id": str(o.id),
                "orderId": f"ORD-{o.id}",
                "customerId": str(o.user_id) if o.user_id else "",
                "customerName": cust_name,
                "customerEmail": cust_email,
                "items": items_data,
                "totalUSD": customer_paid,
                "price": customer_paid,
                "status": o.status or "completed",
                "paymentStatus": "Paid" if (o.status or "").lower() == "completed" else "Pending",
                "paymentMethod": o.payment_method or "upi",
                "createdAt": created_at_str,
                "affiliateId": str(o.affiliate_id) if o.affiliate_id else None,
                "referralCodeUsed": getattr(o, "referral_code_used", None),
                "referralLinkId": str(o.referral_link_id) if getattr(o, "referral_link_id", None) else None,
                # Financial breakdown fields — used by Transaction Ledger in admin UI
                "customerPaid": customer_paid,
                "affiliateCommission": affiliate_commission,
                "netPlatformRevenue": net_platform_revenue,
            })
        return {"total": total, "page": page, "page_size": page_size, "items": result}
    finally:
        db_s.close()

_firestore_broken = False

def get_order_by_id(order_id: str) -> dict:
    global _firestore_broken
    clean_id = order_id.replace("ORD-", "")
    if not clean_id.isdigit():
        raise HTTPException(status_code=400, detail="Invalid order ID format.")
    if not firebase_connected or db is None or _firestore_broken:
        db_s = SessionLocal()
        try:
            order = db_s.query(OrderModel).filter(OrderModel.id == int(clean_id)).first()
            if not order:
                raise HTTPException(status_code=404, detail=f"Order {order_id} not found.")
            customer = db_s.query(UserModel).filter(UserModel.id == order.user_id).first()
            cust_name = customer.name if customer else "Customer"
            cust_email = customer.email if customer else ""
            
            items_data = []
            for item in order.items:
                items_data.append({
                    "productId": str(item.product_id),
                    "productName": item.product.title if item.product else "Product",
                    "price": float(item.price_paid or 0.0),
                })
            return {
                "id": str(order.id),
                "orderId": f"ORD-{order.id}",
                "customerId": str(order.user_id),
                "customerName": cust_name,
                "customerEmail": cust_email,
                "items": items_data,
                "totalUSD": float(order.total_amount or 0.0),
                "price": float(order.total_amount or 0.0),
                "status": order.status or "completed",
                "paymentStatus": "Paid" if (order.status or "").lower() == "completed" else "Pending",
                "paymentMethod": order.payment_method or "upi",
                "createdAt": order.created_at.isoformat() + "Z" if order.created_at else "",
                "affiliateId": str(order.affiliate_id) if order.affiliate_id else None,
                "referralCodeUsed": order.referral_code_used or None,
                "referralLinkId": str(order.referral_link_id) if order.referral_link_id else None,
            }
        finally:
            db_s.close()

    try:
        doc_snap = db.collection("orders").document(clean_id).get()
        if not doc_snap.exists:
            raise HTTPException(status_code=404, detail=f"Order {order_id} not found.")
        order_data = doc_snap.to_dict() or {}
        return {"id": doc_snap.id, **order_data}
    except Exception as e:
        print(f"[orders] Firestore order get failed: {e}. Falling back to SQLite.")
        _firestore_broken = True
        return get_order_by_id(order_id)

def modify_order_status(order_id: str, status: str):
    clean_id = order_id.replace("ORD-", "")
    if not clean_id.isdigit():
        raise HTTPException(status_code=400, detail="Invalid order ID format.")
    db_s = SessionLocal()
    try:
        order = db_s.query(OrderModel).filter(OrderModel.id == int(clean_id)).first()
        if order:
            order.status = status
            
            # --- Commission synchronization ---
            from app.models.affiliate import AffiliateCommission as AffiliateCommissionModel, AffiliateProfile
            commissions = db_s.query(AffiliateCommissionModel).filter(
                AffiliateCommissionModel.order_id == order.id
            ).all()
            
            status_lower = status.lower()
            if status_lower in ("completed", "approved"):
                for c in commissions:
                    if c.status == "pending":
                        c.status = "approved"
                        # update profile balance
                        profile = db_s.query(AffiliateProfile).filter(AffiliateProfile.id == c.affiliate_id).first()
                        if profile:
                            profile.total_sales += 1
                            # note: balance is checked against approved commissions, but we keep metrics in sync
                        db_s.add(c)
                        # sync to Firestore affiliateConversions
                        if firebase_connected and db is not None:
                            try:
                                db.collection("affiliateConversions").document(f"COMM-{c.id}").update({
                                    "status": "approved",
                                    "updatedAt": datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
                                })
                            except Exception:
                                pass
            elif status_lower in ("refunded", "cancelled"):
                for c in commissions:
                    if c.status in ("pending", "approved"):
                        old_status = c.status
                        c.status = "cancelled"
                        # deduct from profile total_earnings
                        profile = db_s.query(AffiliateProfile).filter(AffiliateProfile.id == c.affiliate_id).first()
                        if profile:
                            profile.total_earnings = round(max(0.0, (profile.total_earnings or 0.0) - c.commission_amt), 2)
                            profile.total_sales = max(0, profile.total_sales - 1)
                            db_s.add(profile)
                        db_s.add(c)
                        # sync to Firestore affiliateConversions
                        if firebase_connected and db is not None:
                            try:
                                db.collection("affiliateConversions").document(f"COMM-{c.id}").update({
                                    "status": "cancelled",
                                    "updatedAt": datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
                                })
                            except Exception:
                                pass
            db_s.commit()
    finally:
        db_s.close()

    if firebase_connected and db is not None:
        ref = db.collection("orders").document(clean_id)
        ref.update({
            "status": status,
            "updatedAt": datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z",
        })
    return {"success": True, "id": order_id, "status": status}

def process_order_refund(order_id: str):
    clean_id = order_id.replace("ORD-", "")
    modify_order_status(order_id, "Refunded")
    if firebase_connected and db is not None:
        db.collection("orders").document(clean_id).update({
            "paymentStatus": "Refunded",
        })
    return {"success": True, "id": order_id}

def process_order_dispute(order_id: str):
    return modify_order_status(order_id, "Disputed")
