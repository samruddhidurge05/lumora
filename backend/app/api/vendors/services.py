"""
Vendor service layer — SQLAlchemy database operations.
All functions accept vendor_id (str) which maps to Product.vendor_id.
"""
from datetime import datetime, timezone
from typing import Optional

from app.db.session import SessionLocal
from app.models.vendor import Vendor
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.review import Review
from app.models.user import User
from app.models.withdrawal import Withdrawal


def _get_db():
    """Create a standalone session (for use outside of request context)."""
    return SessionLocal()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Vendor Profile ────────────────────────────────────────────────────────────

def get_vendor_profile(vendor_id: str) -> Optional[dict]:
    db = _get_db()
    try:
        v = db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if not v:
            return None
        return {
            "id":                 v.id,
            "name":               v.name,
            "avatar":             v.avatar,
            "bio":                v.bio,
            "banner":             v.banner,
            "sales":              v.sales,
            "rating":             v.rating,
            "createdAt":          v.created_at.isoformat() if v.created_at else None,
            "tagline":            v.tagline,
            "instagram":          v.instagram,
            "website":            v.website,
            "twitter":            v.twitter,
            "refundPolicy":       v.refund_policy,
            "supportEmail":       v.support_email,
            "responseTime":       v.response_time,
            "announcement":       v.announcement,
            "announcementActive": v.announcement_active,
            "vacationMode":       v.vacation_mode,
            "vacationMessage":    v.vacation_message,
        }
    finally:
        db.close()


def save_vendor_profile(vendor_id: str, data: dict) -> dict:
    db = _get_db()
    try:
        v = db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if v:
            v.name   = data.get("displayName", data.get("name", v.name))
            v.bio    = data.get("storeBio",    data.get("bio",  v.bio))
            v.avatar = data.get("avatar", v.avatar)
        else:
            v = Vendor(
                id=vendor_id,
                name=data.get("displayName", data.get("name", "Creator")),
                bio=data.get("storeBio", ""),
                avatar=data.get("avatar"),
            )
            db.add(v)
        db.commit()
        db.refresh(v)
        return {"id": v.id, "name": v.name, "bio": v.bio}
    finally:
        db.close()


def save_store_settings(vendor_id: str, settings: dict) -> dict:
    """Store settings are persisted on the Vendor row."""
    db = _get_db()
    try:
        v = db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if v:
            if settings.get("storeName") is not None:
                v.name = settings["storeName"]
            if settings.get("tagline") is not None:
                v.tagline = settings["tagline"]
            if settings.get("bio") is not None:
                v.bio = settings["bio"]
            if settings.get("website") is not None:
                v.website = settings["website"]
            if settings.get("twitter") is not None:
                v.twitter = settings["twitter"]
            if settings.get("instagram") is not None:
                v.instagram = settings["instagram"]
            if settings.get("refundPolicy") is not None:
                v.refund_policy = settings["refundPolicy"]
            if settings.get("supportEmail") is not None:
                v.support_email = settings["supportEmail"]
            if settings.get("responseTime") is not None:
                v.response_time = settings["responseTime"]
            if settings.get("announcement") is not None:
                v.announcement = settings["announcement"]
            if settings.get("announcementActive") is not None:
                v.announcement_active = settings["announcementActive"]
            if settings.get("vacationMode") is not None:
                v.vacation_mode = settings["vacationMode"]
            if settings.get("vacationMessage") is not None:
                v.vacation_message = settings["vacationMessage"]
            db.commit()
        return {"success": True}
    finally:
        db.close()


# ── Withdrawals ───────────────────────────────────────────────────────────────
# Persisted to the `withdrawals` table via the Withdrawal SQLAlchemy model.
# The old in-memory _WITHDRAWALS dict has been removed.

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
        vendor_id = data["vendor_id"]
        method    = data.get("method", "upi")
        eta       = "Instant" if method == "upi" else "2-3 days"
        w = Withdrawal(
            vendor_id    = vendor_id,
            amount       = float(data["amount"]),
            method       = method,
            upi_id       = data.get("upiId"),
            bank_account = data.get("bankAccount"),
            status       = "pending",
            eta          = eta,
        )
        db.add(w)

        # Log vendor activity and notify admins
        user = db.query(User).filter(User.firebase_uid == vendor_id).first()
        if user:
            from app.services.activity_log_service import ActivityLogService
            ActivityLogService.log_user_activity(
                db=db,
                user_id=user.id,
                activity_type="withdrawal_request",
                details=f"Requested withdrawal of ₹{w.amount:.2f} via {w.method}."
            )
            
            # Notify admins
            admins = db.query(User).filter(User.role == "admin").all()
            from app.services.notification_service import NotificationService
            for admin in admins:
                NotificationService.create_notification(
                    db=db,
                    user_id=admin.id,
                    title="New Withdrawal Request ✦",
                    message=f"Vendor '{user.name}' has requested a withdrawal of ₹{w.amount:.2f}.",
                    category="withdrawal"
                )

        db.commit()
        db.refresh(w)
        return _withdrawal_to_dict(w)
    finally:
        db.close()


def _withdrawal_to_dict(w: Withdrawal) -> dict:
    """Convert a Withdrawal ORM row to the dict shape the frontend expects."""
    return {
        "id":          f"wd_{w.id}",
        "vendorId":    w.vendor_id,
        "amount":      float(w.amount),
        "method":      w.method or "upi",
        "upiId":       w.upi_id,
        "bankAccount": w.bank_account,
        "status":      w.status or "pending",
        "createdAt":   w.created_at.isoformat() if w.created_at else None,
        "eta":         w.eta or "Instant",
    }


# ── Dashboard Stats ───────────────────────────────────────────────────────────

def get_vendor_stats(vendor_id: str) -> dict:
    db = _get_db()
    try:
        products = db.query(Product).filter(
            (Product.vendor_id == vendor_id) | (Product.seller == vendor_id)
        ).all()

        prod_ids = [p.id for p in products]
        total_sales   = 0
        total_revenue = 0.0

        if prod_ids:
            items = db.query(OrderItem).filter(OrderItem.product_id.in_(prod_ids)).all()
            total_sales   = len(items)
            total_revenue = sum(float(i.price_paid or 0) for i in items)

        active_count = sum(1 for p in products if (p.status or "published") in ("published", "active"))
        ratings      = [p.rating for p in products if p.rating]
        avg_rating   = round(sum(ratings) / len(ratings), 1) if ratings else 0.0
        
        # Calculate completed withdrawals
        withdrawn_sum = sum(w.amount for w in db.query(Withdrawal).filter(
            Withdrawal.vendor_id == vendor_id,
            Withdrawal.status == "completed"
        ).all())

        # Calculate review count and affiliate sales
        review_count = 0
        affiliate_sales = 0
        if prod_ids:
            review_count = db.query(Review).filter(Review.product_id.in_(prod_ids)).count()
            from app.models.affiliate import AffiliateCommission
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


# ── Vendor Orders ─────────────────────────────────────────────────────────────

def get_vendor_orders(vendor_id: str) -> list[dict]:
    """Return all orders that contain at least one product from this vendor."""
    db = _get_db()
    try:
        products = db.query(Product).filter(
            (Product.vendor_id == vendor_id) | (Product.seller == vendor_id)
        ).all()
        prod_ids = {p.id for p in products}
        prod_map = {p.id: p.title or p.name or f"Product {p.id}" for p in products}

        if not prod_ids:
            return []

        items = db.query(OrderItem).filter(OrderItem.product_id.in_(prod_ids)).all()
        order_ids = {i.order_id for i in items}
        if not order_ids:
            return []

        # ── FIX: JOIN User to get real customer name (Issue 2) ───────────────
        orders = (
            db.query(Order)
            .filter(Order.id.in_(order_ids))
            .order_by(Order.created_at.desc())
            .all()
        )

        # Build a user_id → display_name map from a single batch query
        user_ids = {o.user_id for o in orders}
        users    = db.query(User).filter(User.id.in_(user_ids)).all()
        user_map = {
            u.id: (u.name or u.email.split("@")[0] if u.email else f"User #{u.id}")
            for u in users
        }

        result = []
        for o in orders:
            order_items   = [i for i in items if i.order_id == o.id]
            customer_name = user_map.get(o.user_id, f"User #{o.user_id}")
            result.append({
                "id":           f"ORD-{o.id}",
                "orderId":      o.id,
                "customer":     customer_name,
                "customerName": customer_name,
                "product":      prod_map.get(order_items[0].product_id, "Product") if order_items else "—",
                "productName":  prod_map.get(order_items[0].product_id, "Product") if order_items else "—",
                "amount":       float(o.total_amount or 0),
                "status":       o.status or "completed",
                "date":         o.created_at.isoformat() if o.created_at else None,
                "createdAt":    o.created_at.isoformat() if o.created_at else None,
                "priority":     "normal",
                "items":        [
                    {
                        "productId":   i.product_id,
                        "productName": prod_map.get(i.product_id, "—"),
                        "pricePaid":   float(i.price_paid or 0),
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
        prod_ids = {p[0] for p in products}
        order_items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
        order_prod_ids = {i.product_id for i in order_items}

        if not prod_ids.intersection(order_prod_ids):
            return {"success": False, "detail": "Not authorized to fulfill this order"}

        order.status = "completed"
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

        # Ownership check — vendor must own a product in this order
        products = db.query(Product.id).filter(
            (Product.vendor_id == vendor_id) | (Product.seller == vendor_id)
        ).all()
        prod_ids = {p[0] for p in products}
        order_items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
        order_prod_ids = {i.product_id for i in order_items}

        if not prod_ids.intersection(order_prod_ids):
            return {"success": False, "detail": "Not authorized to update this order"}

        order.status = new_status
        db.commit()
        return {"success": True, "orderId": order_id, "status": new_status}
    finally:
        db.close()


# ── Vendor Reviews ────────────────────────────────────────────────────────────

def get_vendor_reviews(vendor_id: str) -> list[dict]:
    """Return all reviews on products belonging to this vendor."""
    db = _get_db()
    try:
        products = db.query(Product).filter(
            (Product.vendor_id == vendor_id) | (Product.seller == vendor_id)
        ).all()
        prod_ids = {p.id for p in products}
        prod_map = {p.id: p.title or p.name or f"Product {p.id}" for p in products}

        if not prod_ids:
            return []

        reviews = db.query(Review).filter(Review.product_id.in_(prod_ids)).order_by(Review.created_at.desc()).all()
        return [
            {
                "id":          r.id,
                "productId":   r.product_id,
                "productName": prod_map.get(r.product_id, "—"),
                "product":     prod_map.get(r.product_id, "—"),
                "rating":      float(r.rating or 0),
                "comment":     r.comment or "",
                "userId":      r.user_id,
                "customer":    (r.user.name or r.user.email.split("@")[0]) if (r.user and (r.user.name or r.user.email)) else f"User #{r.user_id}",
                "reply":       r.reply or "",
                "createdAt":   r.created_at.isoformat() if r.created_at else None,
                "date":        r.created_at.strftime("%b %d, %Y") if r.created_at else "some time ago",
                "helpful":     3 if r.id % 2 == 0 else 1,  # simulated helpful count for visual UI polish
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

        review.reply = reply_text
        db.commit()
        return {"success": True, "reply": reply_text}
    finally:
        db.close()


# ── Dashboard Summary ────────────────────────────────────────────────────────

def get_vendor_dashboard(vendor_id: str) -> dict:
    """
    Single-call dashboard endpoint.
    Returns: stats + recent_orders(5) + recent_products(5) + recent_reviews(5)
             + activity_feed(8) + monthly_chart(12 months)
    """
    db = _get_db()
    try:
        # ── Products ──────────────────────────────────────────────────────────
        products = db.query(Product).filter(
            (Product.vendor_id == vendor_id) | (Product.seller == vendor_id)
        ).all()
        prod_ids  = [p.id for p in products]
        prod_map  = {p.id: (p.title or p.name or f"Product {p.id}") for p in products}
        prod_list_map = {p.id: p for p in products}

        # ── Orders & Revenue ──────────────────────────────────────────────────
        total_sales   = 0
        total_revenue = 0.0
        items_all     = []
        if prod_ids:
            items_all     = db.query(OrderItem).filter(OrderItem.product_id.in_(prod_ids)).all()
            total_sales   = len(items_all)
            total_revenue = sum(float(i.price_paid or 0) for i in items_all)

        order_ids = list({i.order_id for i in items_all})
        all_orders = []
        if order_ids:
            all_orders = db.query(Order).filter(Order.id.in_(order_ids)).order_by(Order.created_at.desc()).all()

        # ── FIX Issue 2: Build user_id → display name map ────────────────────
        user_ids_in_orders = {o.user_id for o in all_orders}
        users_in_orders    = db.query(User).filter(User.id.in_(user_ids_in_orders)).all()
        user_name_map = {
            u.id: (u.name or u.email.split("@")[0] if u.email else f"User #{u.id}")
            for u in users_in_orders
        }

        # Recent orders (last 5) — with real customer names
        recent_orders = []
        for o in all_orders[:5]:
            o_items       = [i for i in items_all if i.order_id == o.id]
            customer_name = user_name_map.get(o.user_id, f"User #{o.user_id}")
            recent_orders.append({
                "id":       f"ORD-{o.id}",
                "customer": customer_name,
                "product":  prod_map.get(o_items[0].product_id, "Product") if o_items else "—",
                "amount":   float(o.total_amount or 0),
                "status":   o.status or "completed",
                "date":     o.created_at.isoformat() if o.created_at else None,
            })

        # ── Stats ─────────────────────────────────────────────────────────────
        active_count = sum(1 for p in products if (p.status or "published") in ("published", "active"))
        ratings      = [p.rating for p in products if p.rating]
        avg_rating   = round(sum(ratings) / len(ratings), 1) if ratings else 0.0

        # Calculate completed withdrawals
        withdrawn_sum = sum(w.amount for w in db.query(Withdrawal).filter(
            Withdrawal.vendor_id == vendor_id,
            Withdrawal.status == "completed"
        ).all())

        review_count = 0
        affiliate_sales = 0
        top_products = []
        if prod_ids:
            review_count = db.query(Review).filter(Review.product_id.in_(prod_ids)).count()
            from app.models.affiliate import AffiliateCommission
            affiliate_sales = db.query(AffiliateCommission).filter(AffiliateCommission.product_id.in_(prod_ids)).count()
            
            # Aggregate order items per product for top products
            from sqlalchemy import func
            sales_per_product = db.query(
                OrderItem.product_id,
                func.count(OrderItem.id).label("sales"),
                func.sum(OrderItem.price_paid).label("revenue")
            ).filter(OrderItem.product_id.in_(prod_ids)).group_by(OrderItem.product_id).all()
            
            for p_id, sales, revenue in sales_per_product:
                prod_obj = prod_list_map.get(p_id)
                if prod_obj:
                    top_products.append({
                        "id": str(p_id),
                        "title": prod_obj.title,
                        "sales": sales,
                        "revenue": round(float(revenue or 0), 2),
                        "rating": float(prod_obj.rating or 0)
                    })
            top_products.sort(key=lambda x: x["revenue"], reverse=True)
            top_products = top_products[:5]

        net_revenue = total_revenue * 0.85
        available_balance = max(0.0, net_revenue - withdrawn_sum)

        # ── Reviews ───────────────────────────────────────────────────────────
        recent_reviews = []
        if prod_ids:
            reviews = db.query(Review).filter(
                Review.product_id.in_(prod_ids)
            ).order_by(Review.created_at.desc()).limit(5).all()
            recent_reviews = [
                {
                    "id":          r.id,
                    "productName": prod_map.get(r.product_id, "—"),
                    "rating":      float(r.rating or 0),
                    "comment":     (r.comment or "")[:120],
                    "date":        r.created_at.isoformat() if r.created_at else None,
                    "verified":    r.verified if hasattr(r, "verified") else False,
                }
                for r in reviews
            ]

        # ── Recent Products ───────────────────────────────────────────────────
        sorted_products = sorted(products, key=lambda p: p.created_at or datetime.min, reverse=True)
        recent_products = [
            {
                "id":        str(p.id),
                "title":     p.title or p.name or "Untitled",
                "price":     float(p.price or 0),
                "category":  p.category or "—",
                "status":    p.status or "published",
                "downloads": p.downloads or 0,
                "rating":    float(p.rating or 0),
                "thumbnail": p.thumbnail or p.preview,
            }
            for p in sorted_products[:5]
        ]

        # ── Activity feed (merged orders + reviews, sorted by date) ──────────
        activity = []
        for o in all_orders[:4]:
            o_items       = [i for i in items_all if i.order_id == o.id]
            customer_name = user_name_map.get(o.user_id, f"User #{o.user_id}")
            product_name  = prod_map.get(o_items[0].product_id, "") if o_items else ""
            activity.append({
                "type": "order",
                "text": f"New order from {customer_name}",
                "sub":  product_name,
                "time": o.created_at.isoformat() if o.created_at else None,
            })
        for r in recent_reviews[:4]:
            activity.append({
                "type": "review",
                "text": f"{r['productName']} got a {r['rating']}★ review",
                "sub":  (r["comment"] or "")[:60],
                "time": r["date"],
            })
        # Sort merged list by time descending, take top 8
        activity.sort(key=lambda x: x["time"] or "", reverse=True)
        activity = activity[:8]

        # ── FIX Issue 3: Always return all 12 months ─────────────────────────
        # Aggregate actual revenue by month abbreviation
        monthly_raw = {}
        for o in all_orders:
            if o.created_at:
                key = o.created_at.strftime("%b")
                monthly_raw[key] = monthly_raw.get(key, 0) + float(o.total_amount or 0)

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


# ── Vendor Products ───────────────────────────────────────────────────────────

def get_vendor_products(vendor_id: str, search: str = "", category: str = "",
                        status_filter: str = "", sort: str = "newest",
                        page: int = 1, limit: int = 20) -> dict:
    """
    Return paginated, searchable, filterable products for this vendor.
    Returns: { items: [...], total: int, page: int, pages: int }
    """
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
                    "title":       p.title or "Untitled",
                    "name":        p.title or "Untitled",
                    "description": p.description or "",
                    "price":       float(p.price or 0),
                    "category":    p.category or "Uncategorized",
                    "status":      p.status or "published",
                    "downloads":   p.downloads or 0,
                    "rating":      float(p.rating or 0),
                    "reviews":     p.reviews or 0,
                    "thumbnail":   p.thumbnail or p.preview,
                    "preview":     p.preview or p.thumbnail,
                    "file_url":    p.file_url,
                    "featured":    p.featured or False,
                    "trending":    p.trending or False,
                    "new_arrival": p.new_arrival or False,
                    "badge":       p.badge,
                    "version":     p.version or "v1.0.0",
                    "file_size":   p.file_size or "—",
                    "license":     p.license,
                    "tags":        p.tags if p.tags else [],
                    "highlights":  p.highlights if p.highlights else [],
                    "vendor_id":   p.vendor_id,
                    "healthScore": min(100, max(0, int((float(p.rating or 0) / 5) * 100))) if p.rating else 75,
                    "createdAt":   p.created_at.isoformat() if p.created_at else None,
                    "updatedAt":   p.updated_at.isoformat() if p.updated_at else None,
                }
                for p in products
            ],
            "total": total,
            "page":  page,
            "pages": max(1, -(-total // limit)),  # ceil division
        }
    finally:
        db.close()
