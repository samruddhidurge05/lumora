"""
Vendor service layer - SQLAlchemy database operations.
All functions accept vendor_id (str) which maps to Product.vendor_id.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional, cast

from app.db.session import SessionLocal
from app.models.vendor import Vendor
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.review import Review
from app.models.user import User
from app.models.withdrawal import Withdrawal
from app.models.affiliate import AffiliateCommission


def _get_db():
    """Create a standalone session (for use outside of request context)."""
    return SessionLocal()


def _format_datetime(dt: Any) -> Optional[str]:
    """Safely format a datetime object or Column to ISO string."""
    if not dt:
        return None
    if isinstance(dt, datetime):
        return dt.isoformat()
    try:
        return dt.isoformat()
    except Exception:
        return str(dt)


def _format_date_str(dt: Any, fmt: str = "%b %d, %Y") -> str:
    """Safely format a datetime object or Column to date string."""
    if not dt:
        return "some time ago"
    if isinstance(dt, datetime):
        return dt.strftime(fmt)
    try:
        return dt.strftime(fmt)
    except Exception:
        return str(dt)


# -- Vendor Profile ------------------------------------------------------------

def get_vendor_profile(vendor_id: str) -> Optional[dict]:
    db = _get_db()
    try:
        v = db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if not v:
            return None
        return {
            "id":                 str(v.id),
            "name":               str(v.name or ""),
            "avatar":             v.avatar,
            "bio":                str(v.bio or ""),
            "banner":             v.banner,
            "sales":              str(v.sales or "0"),
            "rating":             str(v.rating or "5.0"),
            "createdAt":          _format_datetime(v.created_at),
            "tagline":            v.tagline,
            "instagram":          v.instagram,
            "website":            v.website,
            "twitter":            v.twitter,
            "refundPolicy":       v.refund_policy,
            "supportEmail":       v.support_email,
            "responseTime":       v.response_time,
            "announcement":       v.announcement,
            "announcementActive": bool(v.announcement_active),
            "vacationMode":       bool(v.vacation_mode),
            "vacationMessage":    v.vacation_message,
            # Personal fields
            "phone":              v.phone,
            "country":            v.country,
            "github":             v.github,
            "storeUrl":           v.store_url,
            # Payment information
            "upiId":              v.upi_id,
            "accountHolderName":  v.account_holder_name,
            "bankName":           v.bank_name,
            "accountNumber":      v.account_number,
            "ifscCode":           v.ifsc_code,
        }
    finally:
        db.close()


def get_or_create_vendor_profile(vendor_id: str, vendor_info: Optional[dict] = None) -> dict:
    """
    Get the vendor profile, auto-creating the Vendor row if it doesn't exist.
    Called on GET /vendors/{id}/profile so the profile is always available
    after first login - no explicit save required to unblock the module.
    """
    db = _get_db()
    try:
        v = db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if not v:
            name = (vendor_info or {}).get("name") or "My Store"
            email = (vendor_info or {}).get("email") or ""
            v = Vendor(
                id=vendor_id,
                name=name,
                email=email,
                bio="",
            )
            db.add(v)
            db.commit()
            db.refresh(v)
        return {
            "id":                 str(v.id),
            "name":               str(v.name or ""),
            "avatar":             v.avatar,
            "bio":                str(v.bio or ""),
            "banner":             v.banner,
            "sales":              str(v.sales or "0"),
            "rating":             str(v.rating or "5.0"),
            "createdAt":          _format_datetime(v.created_at),
            "tagline":            v.tagline,
            "instagram":          v.instagram,
            "website":            v.website,
            "twitter":            v.twitter,
            "refundPolicy":       v.refund_policy,
            "supportEmail":       v.support_email,
            "responseTime":       v.response_time,
            "announcement":       v.announcement,
            "announcementActive": bool(v.announcement_active),
            "vacationMode":       bool(v.vacation_mode),
            "vacationMessage":    v.vacation_message,
            # Personal fields
            "phone":              v.phone,
            "country":            v.country,
            "github":             v.github,
            "storeUrl":           v.store_url,
            "upiId":              v.upi_id,
            "accountHolderName":  v.account_holder_name,
            "bankName":           v.bank_name,
            "accountNumber":      v.account_number,
            "ifscCode":           v.ifsc_code,
        }
    finally:
        db.close()


def save_vendor_profile(vendor_id: str, data: dict) -> dict:
    db = _get_db()
    try:
        v = db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if v:
            new_name = data.get("storeName") or data.get("displayName") or data.get("name") or v.name or "Creator"
            v.name   = str(new_name)  # type: ignore
            bio_val  = data.get("storeBio") if "storeBio" in data else data.get("bio", v.bio)
            v.bio    = str(bio_val) if bio_val is not None else ""  # type: ignore
            if "avatar" in data:
                v.avatar = data.get("avatar", v.avatar)  # type: ignore
            if "banner" in data:
                v.banner = data.get("banner", v.banner)  # type: ignore
            if "tagline" in data:
                v.tagline = data.get("tagline")  # type: ignore
            if "instagram" in data:
                v.instagram = data.get("instagram")  # type: ignore
            if "website" in data:
                v.website = data.get("website")  # type: ignore
            if "twitter" in data:
                v.twitter = data.get("twitter")  # type: ignore
            if "refundPolicy" in data:
                v.refund_policy = data.get("refundPolicy")  # type: ignore
            if "supportEmail" in data:
                v.support_email = data.get("supportEmail")  # type: ignore
            if "responseTime" in data:
                v.response_time = data.get("responseTime")  # type: ignore
            if "announcement" in data:
                v.announcement = data.get("announcement")  # type: ignore
            if "announcementActive" in data:
                v.announcement_active = data.get("announcementActive")  # type: ignore
            if "vacationMode" in data:
                v.vacation_mode = data.get("vacationMode")  # type: ignore
            if "vacationMessage" in data:
                v.vacation_message = data.get("vacationMessage")  # type: ignore
            if "phone" in data:
                v.phone = str(data["phone"]) if data["phone"] else None  # type: ignore
            if "country" in data:
                v.country = str(data["country"]) if data["country"] else None  # type: ignore
            if "github" in data:
                v.github = str(data["github"]) if data["github"] else None  # type: ignore
            if "storeUrl" in data:
                v.store_url = str(data["storeUrl"]) if data["storeUrl"] else None  # type: ignore
            if "upiId" in data:
                v.upi_id = str(data["upiId"]) if data["upiId"] else None  # type: ignore
            if "accountHolderName" in data:
                v.account_holder_name = str(data["accountHolderName"]) if data["accountHolderName"] else None  # type: ignore
            if "bankName" in data:
                v.bank_name = str(data["bankName"]) if data["bankName"] else None  # type: ignore
            if "accountNumber" in data:
                v.account_number = str(data["accountNumber"]) if data["accountNumber"] else None  # type: ignore
            if "ifscCode" in data:
                v.ifsc_code = str(data["ifscCode"]) if data["ifscCode"] else None  # type: ignore
        else:
            v = Vendor(
                id=vendor_id,
                name=str(data.get("storeName") or data.get("displayName") or data.get("name") or "Creator"),
                email=data.get("email"),
                phone=str(data["phone"]) if data.get("phone") else None,
                store_url=str(data["storeUrl"]) if data.get("storeUrl") else None,
                country=str(data["country"]) if data.get("country") else None,
                github=str(data["github"]) if data.get("github") else None,
                tagline=data.get("tagline"),
                instagram=data.get("instagram"),
                website=data.get("website"),
                twitter=data.get("twitter"),
                refund_policy=data.get("refundPolicy"),
                support_email=data.get("supportEmail"),
                response_time=data.get("responseTime", "24 hours"),
                announcement=data.get("announcement"),
                announcement_active=bool(data.get("announcementActive")),
                vacation_mode=bool(data.get("vacationMode")),
                vacation_message=data.get("vacationMessage"),
                bio=str(data.get("storeBio", data.get("bio", ""))),
                avatar=data.get("avatar"),
                banner=data.get("banner"),
                upi_id=str(data["upiId"]) if data.get("upiId") else None,
                account_holder_name=str(data["accountHolderName"]) if data.get("accountHolderName") else None,
                bank_name=str(data["bankName"]) if data.get("bankName") else None,
                account_number=str(data["accountNumber"]) if data.get("accountNumber") else None,
                ifsc_code=str(data["ifscCode"]) if data.get("ifscCode") else None,
            )
            db.add(v)
        db.commit()
        db.refresh(v)
        return {
            "id":                str(v.id),
            "name":              str(v.name or ""),
            "bio":               str(v.bio or ""),
            "avatar":            v.avatar,
            "banner":            v.banner,
            "tagline":           v.tagline,
            "instagram":         v.instagram,
            "website":           v.website,
            "twitter":           v.twitter,
            "refundPolicy":      v.refund_policy,
            "supportEmail":      v.support_email,
            "responseTime":      v.response_time,
            "announcement":      v.announcement,
            "announcementActive":bool(v.announcement_active),
            "vacationMode":      bool(v.vacation_mode),
            "vacationMessage":   v.vacation_message,
            # Personal fields
            "phone":             v.phone,
            "country":           v.country,
            "github":            v.github,
            "storeUrl":          v.store_url,
            "upiId":             v.upi_id,
            "accountHolderName": v.account_holder_name,
            "bankName":          v.bank_name,
            "accountNumber":     v.account_number,
            "ifscCode":          v.ifsc_code,
        }
    finally:
        db.close()


def save_store_settings(vendor_id: str, settings: dict) -> dict:
    """Store settings are persisted on the Vendor row."""
    db = _get_db()
    try:
        v = db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if v:
            if settings.get("storeName") is not None:
                v.name = str(settings["storeName"])  # type: ignore
            if settings.get("tagline") is not None:
                v.tagline = str(settings["tagline"])  # type: ignore
            if settings.get("bio") is not None:
                v.bio = str(settings["bio"])  # type: ignore
            if settings.get("website") is not None:
                v.website = str(settings["website"])  # type: ignore
            if settings.get("twitter") is not None:
                v.twitter = str(settings["twitter"])  # type: ignore
            if settings.get("instagram") is not None:
                v.instagram = str(settings["instagram"])  # type: ignore
            if settings.get("refundPolicy") is not None:
                v.refund_policy = str(settings["refundPolicy"])  # type: ignore
            if settings.get("supportEmail") is not None:
                v.support_email = str(settings["supportEmail"])  # type: ignore
            if settings.get("responseTime") is not None:
                v.response_time = str(settings["responseTime"])  # type: ignore
            if settings.get("announcement") is not None:
                v.announcement = str(settings["announcement"])  # type: ignore
            if settings.get("announcementActive") is not None:
                v.announcement_active = bool(settings["announcementActive"])  # type: ignore
            if settings.get("vacationMode") is not None:
                v.vacation_mode = bool(settings["vacationMode"])  # type: ignore
            if settings.get("vacationMessage") is not None:
                v.vacation_message = str(settings["vacationMessage"])  # type: ignore
            db.commit()
        return {"success": True}
    finally:
        db.close()


# -- Withdrawals ---------------------------------------------------------------

def get_withdrawal_history(vendor_id: str) -> list[dict]:
    """Load all withdrawal requests for this vendor from the database."""
    db = _get_db()
    try:
        rows = (
            db.query(Withdrawal)
            .filter(Withdrawal.vendor_id == vendor_id)
            .order_by(Withdrawal.created_at.desc())
            .all()
        )
        return [_withdrawal_to_dict(w) for w in rows]
    finally:
        db.close()


def create_withdrawal(data: dict) -> dict:
    """Persist a new withdrawal request to the database."""
    db = _get_db()
    try:
        vendor_id = data.get("vendor_id")
        if not vendor_id:
            from fastapi import HTTPException as _HTTPException
            raise _HTTPException(status_code=400, detail="vendor_id is required.")

        amount_raw = data.get("amount")
        if amount_raw is None:
            from fastapi import HTTPException as _HTTPException
            raise _HTTPException(status_code=400, detail="Withdrawal amount is required.")

        try:
            amount = float(amount_raw)
        except (ValueError, TypeError):
            from fastapi import HTTPException as _HTTPException
            raise _HTTPException(status_code=400, detail="Invalid withdrawal amount.")

        if amount <= 0:
            from fastapi import HTTPException as _HTTPException
            raise _HTTPException(status_code=400, detail="Withdrawal amount must be greater than zero.")

        # -- BALANCE VALIDATION -------------------------------------------
        products = db.query(Product.id).filter(
            (Product.vendor_id == vendor_id) | (Product.seller == vendor_id)
        ).all()
        prod_ids = [int(cast(Any, p[0])) for p in products]
        total_revenue = 0.0
        if prod_ids:
            valid_order_ids = [
                o.id for o in db.query(Order.id).filter(
                    Order.status.notin_(["cancelled", "refunded"])
                ).all()
            ]
            if valid_order_ids:
                items = db.query(OrderItem).filter(
                    OrderItem.product_id.in_(prod_ids),
                    OrderItem.order_id.in_(valid_order_ids)
                ).all()
                total_revenue = sum(float(cast(Any, i.price_paid or 0)) for i in items)

        net_revenue = total_revenue * 0.85
        withdrawn_sum = sum(float(cast(Any, w.amount)) for w in db.query(Withdrawal).filter(
            Withdrawal.vendor_id == vendor_id,
            Withdrawal.status.in_(["completed", "pending", "processing"])
        ).all())

        available_balance = max(0.0, net_revenue - withdrawn_sum)
        if amount > available_balance:
            from fastapi import HTTPException as _HTTPException
            raise _HTTPException(
                status_code=400,
                detail=f"Insufficient balance. Available: ₹{available_balance:.2f}, Requested: ₹{amount:.2f}."
            )

        # -- IDEMPOTENCY GUARD ---------------------------------------------
        existing_pending = db.query(Withdrawal).filter(
            Withdrawal.vendor_id == vendor_id,
            Withdrawal.status == "pending"
        ).first()
        if existing_pending:
            from fastapi import HTTPException as _HTTPException
            raise _HTTPException(
                status_code=409,
                detail=(
                    f"You already have a pending withdrawal of ₹{float(cast(Any, existing_pending.amount)):.2f}. "
                    "Please wait for it to be processed before submitting a new request."
                )
            )

        method = str(data.get("method", "upi"))
        eta    = "Instant" if method == "upi" else "2-3 days"
        w = Withdrawal(
            vendor_id    = str(vendor_id),
            amount       = amount,
            method       = method,
            upi_id       = data.get("upiId"),
            bank_account = data.get("bankAccount"),
            status       = "pending",
            eta          = eta,
        )
        db.add(w)

        # Log vendor activity and notify admins
        user_query = db.query(User).filter(User.firebase_uid == vendor_id)
        if str(vendor_id).isdigit():
            user_query = db.query(User).filter((User.firebase_uid == vendor_id) | (User.id == int(vendor_id)))
        user = user_query.first()
        if user:
            from app.services.activity_log_service import ActivityLogService
            ActivityLogService.log_user_activity(
                db=db,
                user_id=int(cast(Any, user.id)),
                activity_type="withdrawal_request",
                details=f"Requested withdrawal of ₹{float(cast(Any, w.amount)):.2f} via {w.method}."
            )

            # Notify admins
            admins = db.query(User).filter(User.role == "admin").all()
            from app.services.notification_service import NotificationService
            for admin in admins:
                NotificationService.create_notification(
                    db=db,
                    user_id=int(cast(Any, admin.id)),
                    title="New Withdrawal Request 💰",
                    message=f"Vendor '{user.name}' has requested a withdrawal of ₹{float(cast(Any, w.amount)):.2f}.",
                    category="withdrawal"
                )

        try:
            db.commit()
            db.refresh(w)
        except Exception as db_err:
            db.rollback()
            raise db_err

        # Structured log
        from app.utils.logger import log_structured_event
        log_structured_event(
            user_id=int(cast(Any, user.id)) if user else None,
            role="vendor",
            action="withdrawal_requested",
            module="vendors",
            status="success",
            details=f"Withdrawal request submitted: ₹{float(cast(Any, w.amount)):.2f} via {w.method}",
        )

        return _withdrawal_to_dict(w)
    except Exception:
        raise
    finally:
        db.close()


def _withdrawal_to_dict(w: Withdrawal) -> dict:
    """Convert a Withdrawal ORM row to the dict shape the frontend expects."""
    return {
        "id":          f"wd_{w.id}",
        "vendorId":    str(w.vendor_id),
        "amount":      float(cast(Any, w.amount)),
        "method":      str(w.method or "upi"),
        "upiId":       w.upi_id,
        "bankAccount": w.bank_account,
        "status":      str(w.status or "pending"),
        "createdAt":   _format_datetime(w.created_at),
        "eta":         str(w.eta or "Instant"),
    }


# -- Dashboard Stats -----------------------------------------------------------

def get_vendor_stats(vendor_id: str) -> dict:
    db = _get_db()
    try:
        products = db.query(Product).filter(
            (Product.vendor_id == vendor_id) | (Product.seller == vendor_id)
        ).all()

        prod_ids = [int(cast(Any, p.id)) for p in products]
        total_sales   = 0
        total_revenue = 0.0

        if prod_ids:
            valid_order_ids = [
                o.id for o in db.query(Order.id).filter(
                    Order.status.notin_(["cancelled", "refunded"])
                ).all()
            ]
            if valid_order_ids:
                items = db.query(OrderItem).filter(
                    OrderItem.product_id.in_(prod_ids),
                    OrderItem.order_id.in_(valid_order_ids)
                ).all()
                total_sales   = len(items)
                total_revenue = sum(float(cast(Any, i.price_paid or 0)) for i in items)

        active_count = sum(1 for p in products if (p.status or "published") in {"published", "active", "pending_review", "draft"})
        ratings      = [float(cast(Any, p.rating)) for p in products if p.rating]
        avg_rating   = round(sum(ratings) / len(ratings), 1) if ratings else 0.0
        
        # Calculate completed withdrawals
        withdrawn_sum = sum(float(cast(Any, w.amount)) for w in db.query(Withdrawal).filter(
            Withdrawal.vendor_id == vendor_id,
            Withdrawal.status == "completed"
        ).all())

        # Calculate review count and affiliate sales
        review_count = 0
        affiliate_sales = 0
        if prod_ids:
            review_count = db.query(Review).filter(Review.product_id.in_(prod_ids)).count()
            affiliate_sales = db.query(AffiliateCommission).filter(AffiliateCommission.product_id.in_(prod_ids)).count()

        net_revenue = total_revenue * 0.85
        available_balance = max(0.0, net_revenue - withdrawn_sum)

        return {
            "total_revenue":      round(total_revenue, 2),
            "total_orders":       total_sales,
            "active_products":    active_count,
            "avg_rating":         avg_rating,
            "product_count":      len(products),
            "withdrawn":          round(withdrawn_sum, 2),
            "published_products": active_count,
            "archived_products":  sum(1 for p in products if p.status == "archived"),
            "sales":              total_sales,
            "net_revenue":        round(net_revenue, 2),
            "pending_revenue":    round(available_balance, 2),
            "withdrawals":        round(withdrawn_sum, 2),
            "review_count":       review_count,
            "affiliate_sales":    affiliate_sales
        }
    finally:
        db.close()


# -- Vendor Orders -------------------------------------------------------------

def get_vendor_orders(vendor_id: str) -> list[dict]:
    """Return all orders that contain at least one product from this vendor."""
    db = _get_db()
    try:
        products = db.query(Product).filter(
            (Product.vendor_id == vendor_id) | (Product.seller == vendor_id)
        ).all()
        prod_ids = {int(cast(Any, p.id)) for p in products}
        prod_map = {int(cast(Any, p.id)): str(p.title or f"Product {p.id}") for p in products}

        if not prod_ids:
            return []

        items = db.query(OrderItem).filter(OrderItem.product_id.in_(prod_ids)).all()
        order_ids = {int(cast(Any, i.order_id)) for i in items}
        if not order_ids:
            return []

        orders = (
            db.query(Order)
            .filter(Order.id.in_(order_ids))
            .order_by(Order.created_at.desc())
            .all()
        )

        user_ids = {int(cast(Any, o.user_id)) for o in orders}
        users    = db.query(User).filter(User.id.in_(user_ids)).all()
        user_map = {
            int(cast(Any, u.id)): (str(u.name) if u.name else (str(u.email).split("@")[0] if u.email else f"User #{u.id}"))
            for u in users
        }

        result = []
        for o in orders:
            order_items   = [i for i in items if i.order_id == o.id]
            customer_name = user_map.get(int(cast(Any, o.user_id)), f"User #{o.user_id}")
            first_prod_id = int(cast(Any, order_items[0].product_id)) if order_items else 0
            result.append({
                "id":           f"ORD-{o.id}",
                "orderId":      o.id,
                "customer":     customer_name,
                "customerName": customer_name,
                "product":      prod_map.get(first_prod_id, "Product"),
                "productName":  prod_map.get(first_prod_id, "Product"),
                "amount":       float(cast(Any, o.total_amount or 0)),
                "status":       str(o.status or "completed"),
                "date":         _format_datetime(o.created_at),
                "createdAt":    _format_datetime(o.created_at),
                "priority":     "normal",
                "items":        [
                    {
                        "productId":   i.product_id,
                        "productName": prod_map.get(int(cast(Any, i.product_id)), "-"),
                        "pricePaid":   float(cast(Any, i.price_paid or 0)),
                        "downloadUrl": i.download_url,
                    }
                    for i in order_items
                ],
            })
        return result
    finally:
        db.close()


def fulfill_vendor_order(vendor_id: str, order_id: int) -> dict:
    """Mark an order as fulfilled (completed) after verifying vendor owns items in order."""
    db = _get_db()
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            return {"success": False, "detail": "Order not found"}

        # Verify vendor owns at least one product in this order
        products = db.query(Product.id).filter(
            (Product.vendor_id == vendor_id) | (Product.seller == vendor_id)
        ).all()
        prod_ids = {int(cast(Any, p[0])) for p in products}
        order_items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
        order_prod_ids = {int(cast(Any, i.product_id)) for i in order_items}

        if not prod_ids.intersection(order_prod_ids):
            return {"success": False, "detail": "Not authorized to fulfill this order"}

        order.status = "completed"  # type: ignore
        db.commit()
        return {"success": True, "orderId": order_id, "status": "completed"}
    finally:
        db.close()


def update_vendor_order_status(vendor_id: str, order_id: int, new_status: str) -> dict:
    """
    Update an order's status to any valid value.
    Vendor must own at least one product in the order.
    Valid statuses: pending | processing | completed | refunded | cancelled
    """
    VALID_STATUSES = {"pending", "processing", "completed", "refunded", "cancelled"}
    if new_status not in VALID_STATUSES:
        return {"success": False, "detail": f"Invalid status '{new_status}'. Valid: {', '.join(sorted(VALID_STATUSES))}"}

    db = _get_db()
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            return {"success": False, "detail": "Order not found"}

        # Ownership check - vendor must own a product in this order
        products = db.query(Product.id).filter(
            (Product.vendor_id == vendor_id) | (Product.seller == vendor_id)
        ).all()
        prod_ids = {int(cast(Any, p[0])) for p in products}
        order_items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
        order_prod_ids = {int(cast(Any, i.product_id)) for i in order_items}

        if not prod_ids.intersection(order_prod_ids):
            return {"success": False, "detail": "Not authorized to update this order"}

        order.status = new_status  # type: ignore
        db.commit()
        return {"success": True, "orderId": order_id, "status": new_status}
    finally:
        db.close()


# -- Vendor Reviews ------------------------------------------------------------

def get_vendor_reviews(vendor_id: str) -> list[dict]:
    """Return all reviews on products belonging to this vendor."""
    db = _get_db()
    try:
        products = db.query(Product).filter(
            (Product.vendor_id == vendor_id) | (Product.seller == vendor_id)
        ).all()
        prod_ids = {int(cast(Any, p.id)) for p in products}
        prod_map = {int(cast(Any, p.id)): str(p.title or f"Product {p.id}") for p in products}

        if not prod_ids:
            return []

        reviews = db.query(Review).filter(Review.product_id.in_(prod_ids)).order_by(Review.created_at.desc()).all()
        return [
            {
                "id":          r.id,
                "productId":   r.product_id,
                "productName": prod_map.get(int(cast(Any, r.product_id)), "-"),
                "product":     prod_map.get(int(cast(Any, r.product_id)), "-"),
                "rating":      float(cast(Any, r.rating or 0)),
                "comment":     str(r.comment or ""),
                "userId":      r.user_id,
                "customer":    (str(r.user.name) if (r.user and r.user.name) else (str(r.user.email).split("@")[0] if (r.user and r.user.email) else f"User #{r.user_id}")),
                "reply":       str(r.reply or ""),
                "createdAt":   _format_datetime(r.created_at),
                "date":        _format_date_str(r.created_at),
                "helpful":     0,
            }
            for r in reviews
        ]
    finally:
        db.close()


def reply_to_vendor_review(vendor_id: str, review_id: int, reply_text: str) -> dict:
    """Save vendor reply to the database for a specific review on their product."""
    db = _get_db()
    try:
        review = db.query(Review).filter(Review.id == review_id).first()
        if not review:
            return {"success": False, "detail": "Review not found"}

        # Verify vendor owns the product of this review
        product = db.query(Product).filter(
            Product.id == review.product_id,
            (Product.vendor_id == vendor_id) | (Product.seller == vendor_id)
        ).first()

        if not product:
            return {"success": False, "detail": "Not authorized to reply to this review"}

        review.reply = reply_text  # type: ignore
        db.commit()
        return {"success": True, "reply": reply_text}
    finally:
        db.close()


# -- Dashboard Summary --------------------------------------------------------

def get_vendor_dashboard(vendor_id: str) -> dict:
    """
    Single-call dashboard endpoint.
    Returns: stats + recent_orders(5) + recent_products(5) + recent_reviews(5)
             + activity_feed(8) + monthly_chart(12 months)
    """
    db = _get_db()
    try:
        # -- Products ----------------------------------------------------------
        products = db.query(Product).filter(
            (Product.vendor_id == vendor_id) | (Product.seller == vendor_id)
        ).all()
        prod_ids  = [int(cast(Any, p.id)) for p in products]
        prod_map  = {int(cast(Any, p.id)): str(p.title or f"Product {p.id}") for p in products}
        prod_list_map = {int(cast(Any, p.id)): p for p in products}

        # -- Orders & Revenue --------------------------------------------------
        total_sales   = 0
        total_revenue = 0.0
        items_all     = []
        if prod_ids:
            valid_order_ids = [
                o.id for o in db.query(Order.id).filter(
                    Order.status.notin_(["cancelled", "refunded"])
                ).all()
            ]
            if valid_order_ids:
                items_all     = db.query(OrderItem).filter(
                    OrderItem.product_id.in_(prod_ids),
                    OrderItem.order_id.in_(valid_order_ids)
                ).all()
                total_sales   = len(items_all)
                total_revenue = sum(float(cast(Any, i.price_paid or 0)) for i in items_all)

        order_ids = list({int(cast(Any, i.order_id)) for i in items_all})
        all_orders = []
        if order_ids:
            all_orders = db.query(Order).filter(Order.id.in_(order_ids)).order_by(Order.created_at.desc()).all()

        user_ids_in_orders = {int(cast(Any, o.user_id)) for o in all_orders}
        users_in_orders    = db.query(User).filter(User.id.in_(user_ids_in_orders)).all()
        user_name_map = {
            int(cast(Any, u.id)): (str(u.name) if u.name else (str(u.email).split("@")[0] if u.email else f"User #{u.id}"))
            for u in users_in_orders
        }

        # Recent orders (last 5) - with real customer names
        recent_orders = []
        for o in all_orders[:5]:
            o_items       = [i for i in items_all if i.order_id == o.id]
            customer_name = user_name_map.get(int(cast(Any, o.user_id)), f"User #{o.user_id}")
            first_p_id    = int(cast(Any, o_items[0].product_id)) if o_items else 0
            recent_orders.append({
                "id":       f"ORD-{o.id}",
                "customer": customer_name,
                "product":  prod_map.get(first_p_id, "Product"),
                "amount":   float(cast(Any, o.total_amount or 0)),
                "status":   str(o.status or "completed"),
                "date":     _format_datetime(o.created_at),
            })

        # -- Stats -------------------------------------------------------------
        ACTIVE_STATUSES = {"published", "active", "pending_review", "draft"}
        active_count = sum(1 for p in products if (p.status or "published") in ACTIVE_STATUSES)
        ratings      = [float(cast(Any, p.rating)) for p in products if p.rating]
        avg_rating   = round(sum(ratings) / len(ratings), 1) if ratings else 0.0

        # Calculate completed withdrawals
        withdrawn_sum = sum(float(cast(Any, w.amount)) for w in db.query(Withdrawal).filter(
            Withdrawal.vendor_id == vendor_id,
            Withdrawal.status == "completed"
        ).all())

        review_count = 0
        affiliate_sales = 0
        top_products = []
        if prod_ids:
            review_count = db.query(Review).filter(Review.product_id.in_(prod_ids)).count()
            affiliate_sales = db.query(AffiliateCommission).filter(AffiliateCommission.product_id.in_(prod_ids)).count()
            
            # Aggregate order items per product for top products
            from sqlalchemy import func
            sales_per_product = db.query(
                OrderItem.product_id,
                func.count(OrderItem.id).label("sales"),
                func.sum(OrderItem.price_paid).label("revenue")
            ).filter(OrderItem.product_id.in_(prod_ids)).group_by(OrderItem.product_id).all()
            
            for p_id, sales, revenue in sales_per_product:
                prod_obj = prod_list_map.get(int(cast(Any, p_id)))
                if prod_obj:
                    top_products.append({
                        "id": str(p_id),
                        "title": str(prod_obj.title or ""),
                        "sales": int(cast(Any, sales)),
                        "revenue": round(float(revenue or 0), 2),
                        "rating": float(cast(Any, prod_obj.rating or 0))
                    })
            top_products.sort(key=lambda x: x["revenue"], reverse=True)
            top_products = top_products[:5]

        net_revenue = total_revenue * 0.85
        available_balance = max(0.0, net_revenue - withdrawn_sum)

        # -- Reviews -----------------------------------------------------------
        recent_reviews = []
        if prod_ids:
            reviews = db.query(Review).filter(
                Review.product_id.in_(prod_ids)
            ).order_by(Review.created_at.desc()).limit(5).all()
            recent_reviews = [
                {
                    "id":          r.id,
                    "productName": prod_map.get(int(cast(Any, r.product_id)), "-"),
                    "rating":      float(cast(Any, r.rating or 0)),
                    "comment":     str(r.comment or "")[:120],
                    "date":        _format_datetime(r.created_at),
                    "verified":    bool(getattr(r, "verified", False)),
                }
                for r in reviews
            ]

        # -- Recent Products ---------------------------------------------------
        sorted_products = sorted(products, key=lambda p: p.created_at or datetime.min, reverse=True)
        recent_products = [
            {
                "id":        str(p.id),
                "title":     str(p.title or "Untitled"),
                "price":     float(cast(Any, p.price or 0)),
                "category":  str(p.category or "-"),
                "status":    str(p.status or "published"),
                "downloads": int(cast(Any, p.downloads or 0)),
                "rating":    float(cast(Any, p.rating or 0)),
                "thumbnail": p.thumbnail or p.preview,
            }
            for p in sorted_products[:5]
        ]

        # -- Activity feed (merged orders + reviews, sorted by date) ----------
        activity = []
        for o in all_orders[:4]:
            o_items       = [i for i in items_all if i.order_id == o.id]
            customer_name = user_name_map.get(int(cast(Any, o.user_id)), f"User #{o.user_id}")
            first_p_id    = int(cast(Any, o_items[0].product_id)) if o_items else 0
            product_name  = prod_map.get(first_p_id, "")
            activity.append({
                "type": "order",
                "text": f"New order from {customer_name}",
                "sub":  product_name,
                "time": _format_datetime(o.created_at),
            })
        for r in recent_reviews[:4]:
            activity.append({
                "type": "review",
                "text": f"{r['productName']} got a {r['rating']}★ review",
                "sub":  str(r["comment"] or "")[:60],
                "time": r["date"],
            })
        # Sort merged list by time descending, take top 8
        activity.sort(key=lambda x: x["time"] or "", reverse=True)
        activity = activity[:8]

        # -- Aggregate actual revenue by month abbreviation --------------------
        monthly_raw = {}
        for o in all_orders:
            if o.created_at:
                key = o.created_at.strftime("%b") if isinstance(o.created_at, datetime) else str(o.created_at)[:3]
                monthly_raw[key] = monthly_raw.get(key, 0) + float(cast(Any, o.total_amount or 0))

        # Always emit all 12 months in calendar order; missing months = 0
        MONTH_ORDER = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
        monthly_chart = [
            {"label": m, "value": round(monthly_raw.get(m, 0), 2)}
            for m in MONTH_ORDER
        ]

        return {
            "stats": {
                "total_revenue":      round(total_revenue, 2),
                "total_orders":       total_sales,
                "active_products":    active_count,
                "product_count":      len(products),
                "avg_rating":         avg_rating,
                "published_products": active_count,
                "archived_products":  sum(1 for p in products if p.status == "archived"),
                "sales":              total_sales,
                "net_revenue":        round(net_revenue, 2),
                "pending_revenue":    round(available_balance, 2),
                "withdrawals":        round(withdrawn_sum, 2),
                "review_count":       review_count,
                "affiliate_sales":    affiliate_sales
            },
            "recent_orders":   recent_orders,
            "recent_products": recent_products,
            "recent_reviews":  recent_reviews,
            "top_products":    top_products,
            "activity":        activity,
            "monthly_chart":   monthly_chart,
        }
    finally:
        db.close()


# -- Vendor Products -----------------------------------------------------------

def get_vendor_products(vendor_id: str, search: str = "", category: str = "",
                        status_filter: str = "", sort: str = "newest",
                        page: int = 1, limit: int = 20) -> dict:
    page = max(1, page)
    limit = max(1, min(100, limit))
    db = _get_db()
    try:
        query = db.query(Product).filter(
            (Product.vendor_id == vendor_id) | (Product.seller == vendor_id)
        )
        # Search
        if search:
            like = f"%{search.lower()}%"
            query = query.filter(
                Product.title.ilike(like) | Product.description.ilike(like) | Product.category.ilike(like)
            )
        # Category filter
        if category:
            query = query.filter(Product.category == category)
        # Status filter
        if status_filter and status_filter != "all":
            query = query.filter(Product.status == status_filter)

        # Sort
        if sort == "price-asc":
            query = query.order_by(Product.price.asc())
        elif sort == "price-desc":
            query = query.order_by(Product.price.desc())
        elif sort == "rating":
            query = query.order_by(Product.rating.desc())
        elif sort == "popular":
            query = query.order_by(Product.downloads.desc())
        else:  # newest
            query = query.order_by(Product.created_at.desc())

        total = query.count()
        products = query.offset((page - 1) * limit).limit(limit).all()

        return {
            "items": [
                {
                    "id":          p.id,
                    "title":       str(p.title or "Untitled"),
                    "name":        str(p.title or "Untitled"),
                    "description": str(p.description or ""),
                    "price":       float(cast(Any, p.price or 0)),
                    "category":    str(p.category or "Uncategorized"),
                    "status":      str(p.status or "published"),
                    "downloads":   int(cast(Any, p.downloads or 0)),
                    "rating":      float(cast(Any, p.rating or 0)),
                    "reviews":     int(cast(Any, p.reviews or 0)),
                    "thumbnail":   p.thumbnail or p.preview,
                    "preview":     p.preview or p.thumbnail,
                    "file_url":    p.file_url,
                    "featured":    bool(p.featured),
                    "trending":    bool(p.trending),
                    "new_arrival": bool(p.new_arrival),
                    "badge":       p.badge,
                    "version":     str(p.version or "v1.0.0"),
                    "file_size":   str(p.file_size or "-"),
                    "license":     p.license,
                    "tags":        p.tags if p.tags else [],
                    "highlights":  p.highlights if p.highlights else [],
                    "vendor_id":   p.vendor_id,
                    "healthScore": min(100, max(0, int((float(cast(Any, p.rating or 0)) / 5) * 100))) if p.rating else 75,
                    "createdAt":   _format_datetime(p.created_at),
                    "updatedAt":   _format_datetime(p.updated_at),
                    # Extended metadata fields
                    "features":            p.features if p.features else [],
                    "system_requirements": p.system_requirements if p.system_requirements else [],
                    "what_you_get":        p.what_you_get if p.what_you_get else [],
                    "short_desc":          p.short_desc,
                    "installation_guide":  p.installation_guide,
                    "subcategory":         p.subcategory,
                    "discount":            float(cast(Any, p.discount or 0)),
                    "preview_images":      p.preview_images if p.preview_images else [],
                    "preview_video":       p.preview_video,
                    "seo_title":           p.seo_title,
                    "seo_description":     p.seo_description,
                    "visibility":          str(p.visibility or "public"),
                    "affiliate_enabled":   bool(p.affiliate_enabled),
                    "commission_type":     str(p.commission_type or "percentage"),
                    "commission_value":    float(cast(Any, p.commission_value or 0)),
                }
                for p in products
            ],
            "total": total,
            "page":  page,
            "pages": max(1, -(-total // limit)),  # ceil division
        }
    finally:
        db.close()
