from app.shared.firebase.connection import db, firebase_connected
from datetime import datetime, timezone
from fastapi import HTTPException
from app.db.session import SessionLocal
from app.models.order import Order as OrderModel
from app.models.user import User as UserModel
from app.models.product import Product as ProductModel

def _map_order(doc):
    d = doc.to_dict()
    return {
        "id":            doc.id,
        "orderId":       d.get("orderId", doc.id),
        "customerName":  d.get("customerName", "Anonymous"),
        "customerEmail": d.get("customerEmail", ""),
        "price":         float(d.get("price", d.get("total", 0))),
        "status":        d.get("status", "Completed"),
        "paymentStatus": d.get("paymentStatus", "Paid"),
        "createdAt":     d.get("createdAt") or datetime.utcnow().isoformat() + "Z",
        "vendorId":      d.get("vendorId", d.get("vendor_id", "")),
        "productName":   d.get("productName", "Product"),
        "method":        d.get("method", ""),
        "region":        d.get("region", ""),
    }

def _map_vendor(doc):
    d = doc.to_dict()
    return {
        "id":            doc.id,
        "name":          d.get("storeName", d.get("displayName", "Vendor")),
        "email":         d.get("email", ""),
        "status":        "Approved" if d.get("isApproved") else "Pending",
        "totalEarnings": float(d.get("totalEarnings", 0)),
    }

_firestore_broken = False

def get_payments_telemetry():
    global _firestore_broken
    if not firebase_connected or db is None or _firestore_broken:
        db_s = SessionLocal()
        try:
            sql_orders = db_s.query(OrderModel).all()
            sql_vendors = db_s.query(UserModel).filter(UserModel.role.in_(["vendor", "Vendor"])).all()
            
            orders = []
            for o in sql_orders:
                customer = db_s.query(UserModel).filter(UserModel.id == o.user_id).first()
                cust_name = customer.name if customer else "Customer"
                cust_email = customer.email if customer else ""
                
                v_id = ""
                p_name = "Product"
                if o.items:
                    prod = db_s.query(ProductModel).filter(ProductModel.id == o.items[0].product_id).first()
                    if prod:
                        p_name = prod.title
                        v_id = str(prod.vendor_id) if prod.vendor_id else ""

                orders.append({
                    "id":            str(o.id),
                    "orderId":       f"ORD-{o.id}",
                    "customerName":  cust_name,
                    "customerEmail": cust_email,
                    "price":         float(o.total_amount or 0.0),
                    "status":        o.status or "Completed",
                    "paymentStatus": "Paid" if (o.status or "").lower() == "completed" else "Pending",
                    "createdAt":     o.created_at.isoformat() + "Z" if o.created_at else "",
                    "vendorId":      v_id,
                    "productName":   p_name,
                    "method":        o.payment_method or "upi",
                    "region":        "India",
                })
                
            vendors = []
            for v in sql_vendors:
                vendors.append({
                    "id":            str(v.id),
                    "name":          v.name or "Vendor",
                    "email":         v.email,
                    "status":        "Approved" if v.is_verified else "Pending",
                    "totalEarnings": 0.0,
                })
            return {"orders": orders, "vendors": vendors}
        finally:
            db_s.close()

    try:
        orders  = [_map_order(d)  for d in db.collection("orders").stream()]
        vendors = [_map_vendor(d) for d in db.collection("vendors").stream()]
        return {"orders": orders, "vendors": vendors}
    except Exception as e:
        print(f"[payments] Firestore error: {e}. Falling back to SQLite.")
        _firestore_broken = True
        return get_payments_telemetry()

def get_payments_overview():
    telemetry = get_payments_telemetry()
    orders    = telemetry["orders"]

    total_revenue = pending = refunded = successful = failed = 0

    for o in orders:
        price      = float(o["price"])
        status     = o["status"]
        pay_status = o["paymentStatus"]

        if pay_status == "Paid" or status == "Completed":
            total_revenue += price
            successful    += 1
        elif status in ("Pending", "Processing"):
            pending += price
        elif status == "Refunded" or pay_status == "Refunded":
            refunded += price
        elif pay_status == "Failed" or status == "Failed":
            failed += 1

    return {
        "totalRevenue":       round(total_revenue, 2),
        "pendingRevenue":     round(pending, 2),
        "refundedAmount":     round(refunded, 2),
        "successfulPayments": successful,
        "failedPayments":     failed,
        "totalTransactions":  len(orders),
    }

def get_vendor_payouts():
    telemetry = get_payments_telemetry()
    orders    = telemetry["orders"]
    vendors   = telemetry["vendors"]

    payouts = []
    for v in vendors:
        vid = v["id"]
        paid_orders    = [o for o in orders if o["vendorId"] == vid and o["paymentStatus"] == "Paid"]
        pending_orders = [o for o in orders if o["vendorId"] == vid and o["status"] in ("Pending", "Processing")]

        total_sales   = sum(float(o["price"]) for o in paid_orders) or float(v["totalEarnings"])
        pending_payout= sum(float(o["price"]) for o in pending_orders)

        payouts.append({
            "vendorId":       vid,
            "vendorName":     v["name"],
            "totalSales":     round(total_sales, 2),
            "commission":     round(total_sales * 0.05, 2),
            "paidPayout":     round(total_sales * 0.95, 2),
            "pendingPayout":  round(pending_payout, 2),
            "lastPayoutDate": datetime.utcnow().strftime("%Y-%m-%d"),
        })

    return payouts

def get_refund_monitor_list():
    telemetry = get_payments_telemetry()
    orders    = telemetry["orders"]

    refunds = []
    for o in orders:
        if o["status"] == "Refunded" or o["paymentStatus"] == "Refunded":
            refunds.append({
                "id":           f"REF-{o['id'][-4:]}" if len(o['id']) >= 4 else f"REF-{o['id']}",
                "orderId":      o["id"],
                "customerName": o["customerName"],
                "amount":       o["price"],
                "reason":       "Customer refund request",
                "status":       "Approved",
            })
        elif o["status"] == "Pending" and o["paymentStatus"] == "Unpaid":
            refunds.append({
                "id":           f"REF-{o['id'][-4:]}" if len(o['id']) >= 4 else f"REF-{o['id']}",
                "orderId":      o["id"],
                "customerName": o["customerName"],
                "amount":       o["price"],
                "reason":       "Payment pending verification",
                "status":       "Pending",
            })

    return refunds

def get_transactions_list(page: int = 1, page_size: int = 50, status: str = None):
    page = max(1, page)
    page_size = max(1, min(200, page_size))
    telemetry = get_payments_telemetry()
    all_txns = [
        {
            "id":      f"TXN-{o['id'][-4:]}" if len(o['id']) >= 4 else f"TXN-{o['id']}",
            "orderId": o["id"],
            "customerName": o.get("customerName", ""),
            "amount":  o["price"],
            "method":  o["method"],
            "status":  "Success" if o["paymentStatus"] == "Paid" else "Failed",
            "date":    o["createdAt"][:10] if o["createdAt"] else datetime.utcnow().strftime("%Y-%m-%d"),
        }
        for o in telemetry["orders"]
    ]
    if status:
        all_txns = [t for t in all_txns if t["status"].lower() == status.lower()]
    total = len(all_txns)
    items = all_txns[(page - 1) * page_size: page * page_size]
    return {"total": total, "page": page, "page_size": page_size, "items": items}

def process_vendor_payout(vendor_id: str, amount: float):
    db_s = SessionLocal()
    payee_role = "vendor"
    try:
        # Check payee role in SQLite (supporting SQLite ID or Firebase UID)
        payee_user = None
        if vendor_id.isdigit():
            payee_user = db_s.query(UserModel).filter(UserModel.id == int(vendor_id)).first()
        if not payee_user:
            payee_user = db_s.query(UserModel).filter(UserModel.firebase_uid == vendor_id).first()

        if payee_user and payee_user.role.lower() == "affiliate":
            payee_role = "affiliate"
            
            from app.models.affiliate import AffiliateProfile, AffiliatePayout as AffiliatePayoutModel, AffiliateCommission as AffiliateCommissionModel
            profile = db_s.query(AffiliateProfile).filter(AffiliateProfile.user_id == payee_user.id).first()
            if profile:
                payout = db_s.query(AffiliatePayoutModel).filter(
                    AffiliatePayoutModel.affiliate_id == profile.id,
                    AffiliatePayoutModel.status == "pending"
                ).order_by(AffiliatePayoutModel.created_at.desc()).first()
                
                if payout:
                    payout.status = "completed"
                    db_s.add(payout)
                else:
                    # Create matching completed payout log
                    payout = AffiliatePayoutModel(
                        affiliate_id=profile.id,
                        amount=amount,
                        method="upi",
                        status="completed"
                    )
                    db_s.add(payout)
                
                # Mark approved commissions as "paid" to satisfy this payout
                approved_commissions = db_s.query(AffiliateCommissionModel).filter(
                    AffiliateCommissionModel.affiliate_id == profile.id,
                    AffiliateCommissionModel.status == "approved"
                ).order_by(AffiliateCommissionModel.created_at.asc()).all()
                
                remaining = amount
                for comm in approved_commissions:
                    if remaining <= 0:
                        break
                    if comm.commission_amt <= remaining:
                        comm.status = "paid"
                        remaining -= comm.commission_amt
                    else:
                        comm.status = "paid"
                        remaining = 0
                    db_s.add(comm)
                    # Sync status change to Firestore affiliateConversions
                    if firebase_connected and db is not None:
                        try:
                            db.collection("affiliateConversions").document(f"COMM-{comm.id}").update({
                                "status": "paid",
                                "updatedAt": datetime.utcnow().isoformat() + "Z"
                            })
                        except Exception:
                            pass
        else:
            # Payee is vendor
            from app.models.withdrawal import Withdrawal as WithdrawalModel
            withdrawal = db_s.query(WithdrawalModel).filter(
                WithdrawalModel.vendor_id == vendor_id,
                WithdrawalModel.status == "pending"
            ).order_by(WithdrawalModel.created_at.desc()).first()
            
            if withdrawal:
                withdrawal.status = "completed"
                db_s.add(withdrawal)
            else:
                # Create completed matching withdrawal
                withdrawal = WithdrawalModel(
                    vendor_id=vendor_id,
                    amount=amount,
                    method="upi",
                    status="completed"
                )
                db_s.add(withdrawal)

        # Notify payee and log activity
        if payee_user:
            from app.services.notification_service import NotificationService
            NotificationService.create_notification(
                db=db_s,
                user_id=payee_user.id,
                title="Payout Completed ✦",
                message=f"Your payout of ₹{amount * 80:.2f} has been processed successfully.",
                category="payout"
            )
            from app.services.activity_log_service import ActivityLogService
            ActivityLogService.log_user_activity(
                db=db_s,
                user_id=payee_user.id,
                activity_type="payout_complete",
                details=f"Received payout of ₹{amount * 80:.2f} via UPI/Bank."
            )

        db_s.commit()
    except Exception as e:
        print(f"[payout-sync] Error processing SQLite payout data: {e}")
    finally:
        db_s.close()

    if not firebase_connected or db is None:
        return {"success": True, "vendorId": vendor_id, "amount": amount, "role": payee_role}

    payout_ref = db.collection("affiliatePayouts").document()
    if payee_role == "affiliate":
        payout_ref.set({
            "affiliateId": vendor_id,
            "amount":      amount,
            "status":      "Completed",
            "createdAt":   datetime.utcnow().isoformat() + "Z",
            "type":        "affiliate_payout",
        })
    else:
        payout_ref.set({
            "vendorId":  vendor_id,
            "amount":    amount,
            "status":    "Completed",
            "createdAt": datetime.utcnow().isoformat() + "Z",
            "type":      "vendor_payout",
        })
        vendor_ref = db.collection("vendors").document(vendor_id)
        if vendor_ref.get().exists:
            vendor_ref.update({
                "lastPayoutAmount": amount,
                "lastPayoutDate":   datetime.utcnow().isoformat() + "Z",
            })
            
    return {"success": True, "vendorId": vendor_id, "amount": amount, "role": payee_role}
