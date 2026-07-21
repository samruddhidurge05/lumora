from app.shared.firebase.connection import db, firebase_connected
from datetime import datetime, timedelta
from fastapi import HTTPException
from app.db.session import SessionLocal
from app.models.order import Order as OrderModel
from app.models.product import Product as ProductModel
from app.models.user import User as UserModel
from app.models.review import Review as ReviewModel


def compute_growth(current_period_orders, previous_period_orders):
    """Compute period-over-period revenue growth as a percentage."""
    current_rev = sum(float(o.get('total', 0)) for o in current_period_orders)
    previous_rev = sum(float(o.get('total', 0)) for o in previous_period_orders)
    if previous_rev == 0:
        return 0
    return round(((current_rev - previous_rev) / previous_rev) * 100, 1)


def _parse_order_dt(order_dict: dict) -> datetime:
    """Parse a createdAt string from an order dict; returns epoch on failure."""
    try:
        raw = order_dict.get("createdAt", "")
        if raw:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        pass
    return datetime(1970, 1, 1)


def _get_cutoff(date_range: str) -> datetime | None:
    """Return a UTC cutoff datetime for the given range string, or None for 'all'."""
    now = datetime.utcnow()
    if date_range == "7d":
        return now - timedelta(days=7)
    elif date_range == "30d":
        return now - timedelta(days=30)
    elif date_range == "90d":
        return now - timedelta(days=90)
    return None  # "all" - no filter

def calculate_kpis(orders, products_count, vendors_count, reviews):
    total_revenue = paid = completed = refunded = 0

    for o in orders:
        price      = float(o.get("price", o.get("total", 0)))
        status     = o.get("status", "")
        pay_status = o.get("paymentStatus", "")

        if pay_status == "Paid" or status == "Completed":
            total_revenue += price
            paid          += 1
        if status == "Completed":
            completed += 1
        if status == "Refunded":
            refunded  += 1

    total    = len(orders)
    aov      = round(total_revenue / paid, 2) if paid > 0 else 0
    refund_r = round(refunded / total * 100, 2) if total > 0 else 0
    ratings  = [float(r.get("rating", 5)) for r in reviews]
    avg_rat  = round(sum(ratings) / len(ratings), 2) if ratings else 0

    unique_cust = len({o.get("customerEmail") for o in orders if o.get("customerEmail")})

    return {
        "aov":                  aov,
        "refundRate":           refund_r,
        "totalOrders":          total,
        "paidOrdersCount":      paid,
        "completedOrdersCount": completed,
        "activeCustomers":      max(unique_cust, 1),
        "publishedProducts":    products_count,
        "approvedVendors":      vendors_count,
        "avgRating":            avg_rat,
        "totalRevenue":         round(total_revenue, 2),
    }

_firestore_broken = False

def get_analytics_dashboard_data(date_range: str = "all"):
    global _firestore_broken
    if not firebase_connected or db is None or _firestore_broken:
        db_s = SessionLocal()
        try:
            cutoff = _get_cutoff(date_range)
            q = db_s.query(OrderModel)
            if cutoff:
                q = q.filter(OrderModel.created_at >= cutoff)
            sql_orders = q.all()
            sql_products = db_s.query(ProductModel).all()
            sql_vendors = db_s.query(UserModel).filter(UserModel.role.in_(["vendor", "Vendor"])).all()
            sql_reviews = db_s.query(ReviewModel).all()

            # Fetch previous period orders for growth computation
            prev_sql_orders = []
            if cutoff:
                window_days = (datetime.utcnow() - cutoff).days or 30
                prev_start = cutoff - timedelta(days=window_days)
                prev_q = db_s.query(OrderModel).filter(
                    OrderModel.created_at >= prev_start,
                    OrderModel.created_at < cutoff,
                )
                prev_sql_orders = prev_q.all()

            def _to_order_dict(o):
                return {
                    "price": float(o.total_amount or 0.0),
                    "total": float(o.total_amount or 0.0),
                    "status": o.status or "completed",
                    "paymentStatus": "Paid" if (o.status or "").lower() == "completed" else "Pending",
                }

            orders = []
            for o in sql_orders:
                customer = db_s.query(UserModel).filter(UserModel.id == o.user_id).first()
                cust_name = customer.name if customer else "Customer"
                cust_email = customer.email if customer else ""
                
                # Fetch first product details
                p_name = "Product"
                if o.items:
                    prod = db_s.query(ProductModel).filter(ProductModel.id == o.items[0].product_id).first()
                    p_name = prod.title if prod else "Product"

                orders.append({
                    "price": float(o.total_amount or 0.0),
                    "total": float(o.total_amount or 0.0),
                    "status": o.status or "completed",
                    "paymentStatus": "Paid" if (o.status or "").lower() == "completed" else "Pending",
                    "customerName": cust_name,
                    "customerEmail": cust_email,
                    "createdAt": o.created_at.isoformat() + "Z" if o.created_at else "",
                    "category": "Asset",
                    "productName": p_name
                })

            prev_orders_dicts = [_to_order_dict(o) for o in prev_sql_orders]

            products = [{"status": p.status, "category": p.category, "title": p.title} for p in sql_products]
            vendors = [{"isApproved": v.is_verified or v.is_active, "status": "active" if v.is_active else "disabled", "role": v.role} for v in sql_vendors]
            reviews = [{"rating": r.rating} for r in sql_reviews]

            products_count = len(products)
            vendors_count = len(vendors)
            kpis = calculate_kpis(orders, products_count, vendors_count, reviews)

            # Compute growth metrics
            try:
                revenue_growth = compute_growth(orders, prev_orders_dicts)
                current_count = len(orders)
                prev_count = len(prev_orders_dicts)
                growth_velocity = round(((current_count - prev_count) / max(prev_count, 1)) * 100, 1)
                paid_orders = kpis["paidOrdersCount"]
                total_orders_count = kpis["totalOrders"]
                conversion_rate = round((paid_orders / max(total_orders_count, 1)) * 100, 1)
                current_aov = kpis["aov"]
                prev_paid = sum(1 for o in prev_orders_dicts if o.get("paymentStatus") == "Paid" or o.get("status") == "Completed")
                prev_rev = sum(float(o.get("total", 0)) for o in prev_orders_dicts if o.get("paymentStatus") == "Paid" or o.get("status") == "Completed")
                prev_aov = round(prev_rev / prev_paid, 2) if prev_paid > 0 else 0
                aov_growth = round((current_aov - prev_aov) / max(prev_aov, 1) * 100, 1)
            except Exception:
                revenue_growth = 0
                growth_velocity = 0
                conversion_rate = 0
                aov_growth = 0

            # Product performance
            prod_sales = {}
            for o in orders:
                name = o.get("productName", "Unknown Product")
                price = float(o.get("price", o.get("total", 0)))
                if name not in prod_sales:
                    prod_sales[name] = {"revenue": 0.0, "sales": 0, "category": o.get("category", "General")}
                prod_sales[name]["revenue"] += price
                prod_sales[name]["sales"] += 1

            product_performance = sorted(
                [{"id": n.lower().replace(" ", "-"), "name": n, "category": s["category"],
                  "revenue": round(s["revenue"], 2), "orders": s["sales"], "sales": s["sales"]}
                 for n, s in prod_sales.items()],
                key=lambda x: x["revenue"], reverse=True,
            )[:5]

            geo_analytics = []
            rev = kpis["totalRevenue"]
            # Build real daily timeline from actual order dates
            _sql_daily: dict = {}
            for o in orders:
                price_o = float(o.get("price", o.get("total", 0)))
                pay_s   = o.get("paymentStatus", "")
                stat_o  = o.get("status", "")
                if not (pay_s == "Paid" or stat_o == "Completed"):
                    continue
                try:
                    dt_o = datetime.fromisoformat(o.get("createdAt", "").replace("Z", "+00:00")).replace(tzinfo=None)
                    dow  = dt_o.strftime("%a")
                    _sql_daily[dow] = _sql_daily.get(dow, 0.0) + price_o
                except Exception:
                    pass

            _all_dows = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            timeline_daily = [{"label": d, "value": round(_sql_daily.get(d, 0.0), 2)} for d in _all_dows]
            sparkline_vals  = [round(_sql_daily.get(d, 0.0), 2) for d in _all_dows]

            return {
                "kpis": kpis,
                "revenueTrend": {
                    "today":    round(_sql_daily.get(datetime.utcnow().strftime("%a"), 0.0), 2),
                    "sparkline": sparkline_vals,
                    "timeline": {
                        "daily":   timeline_daily,
                        "weekly":  [{"label": "Wk 1", "value": round(rev * .22, 2)},
                                     {"label": "Wk 2", "value": round(rev * .28, 2)}],
                        "monthly": [{"label": datetime.utcnow().strftime("%b"), "value": rev}],
                    },
                },
                "productPerformance": product_performance,
                "customerAnalytics": {
                    "returningCustomers":  kpis["activeCustomers"],
                    "repeatPurchasesCount":kpis["completedOrdersCount"],
                    "repeatPurchaseRate":  round((kpis["completedOrdersCount"] / max(kpis["totalOrders"], 1)) * 100, 1),
                    "newCustomers":        kpis["activeCustomers"],
                    "clv":                 round(kpis["aov"] * 1.5, 2),
                    "clvTrend":            [round(kpis["aov"] * 0.5, 2), round(kpis["aov"] * 0.8, 2), round(kpis["aov"] * 1.2, 2), round(kpis["aov"] * 1.5, 2)],
                    "totalCustomers":      kpis["activeCustomers"],
                },
                "trustMetrics": {
                    "satisfactionRate": kpis["avgRating"],
                    "refundRate":       kpis["refundRate"],
                },
                "geoAnalytics": geo_analytics,
                "growth": {
                    "revenueGrowth":   revenue_growth,
                    "aovGrowth":       aov_growth,
                    "refundRateGrowth": round((-kpis["refundRate"]), 1) if kpis["refundRate"] > 0 else 0,
                    "customerGrowth":  growth_velocity,
                    "reviewGrowth":    0,
                },
                "forecast": {
                    "nextQuarterRevenue": round(rev * 1.25, 2),
                    "nextMonthRevenue":   round(rev * 0.35, 2),
                    "confidenceScore":    75 if rev > 0 else 0,
                    "forecastPath": [
                        {"label": "M+1", "value": round(rev * 0.35, 2)},
                        {"label": "M+2", "value": round(rev * 0.38, 2)},
                        {"label": "M+3", "value": round(rev * 0.42, 2)},
                    ],
                },
                "_meta": {"totalReviews": len(reviews)},
            }
        finally:
            db_s.close()

    try:
        orders   = [doc.to_dict() for doc in db.collection("orders").stream()]
        products = [doc.to_dict() for doc in db.collection("products").stream()]
        vendors  = [doc.to_dict() for doc in db.collection("vendors").stream()]
        reviews  = [doc.to_dict() for doc in db.collection("reviews").stream()]
    except Exception as e:
        print(f"[analytics] Firestore error: {e}. Falling back to SQLite.")
        _firestore_broken = True
        return get_analytics_dashboard_data(date_range)

    # Apply date_range filter to Firestore orders
    cutoff = _get_cutoff(date_range)
    if cutoff:
        filtered = []
        prev_filtered = []
        window_days = (datetime.utcnow() - cutoff).days or 30
        prev_start = cutoff - timedelta(days=window_days)
        for o in orders:
            try:
                created_str = o.get("createdAt", "")
                if created_str:
                    created_dt = datetime.fromisoformat(created_str.replace("Z", "+00:00")).replace(tzinfo=None)
                    if created_dt >= cutoff:
                        filtered.append(o)
                    elif created_dt >= prev_start:
                        prev_filtered.append(o)
            except Exception:
                filtered.append(o)  # include if unparseable
        prev_orders = prev_filtered
        orders = filtered
    else:
        prev_orders = []

    products_count = len(products)
    vendors_count  = len([
        v for v in vendors
        if v.get("isApproved") is True
        or v.get("verified") is True
        or v.get("status") in ("Approved", "approved", "active")
        or v.get("role") in ("Vendor", "vendor")
        or all(v.get(k) is None for k in ("isApproved", "verified", "status", "role"))
    ])

    kpis = calculate_kpis(orders, products_count, vendors_count, reviews)

    # Compute growth metrics
    try:
        revenue_growth = compute_growth(orders, prev_orders)
        current_count = len(orders)
        prev_count = len(prev_orders)
        growth_velocity = round(((current_count - prev_count) / max(prev_count, 1)) * 100, 1)
        paid_orders = kpis["paidOrdersCount"]
        total_orders_count = kpis["totalOrders"]
        conversion_rate = round((paid_orders / max(total_orders_count, 1)) * 100, 1)
        current_aov = kpis["aov"]
        prev_paid = sum(1 for o in prev_orders if o.get("paymentStatus") == "Paid" or o.get("status") == "Completed")
        prev_rev_sum = sum(float(o.get("total", o.get("price", 0))) for o in prev_orders if o.get("paymentStatus") == "Paid" or o.get("status") == "Completed")
        prev_aov = round(prev_rev_sum / prev_paid, 2) if prev_paid > 0 else 0
        aov_growth = round((current_aov - prev_aov) / max(prev_aov, 1) * 100, 1)
    except Exception:
        revenue_growth = 0
        growth_velocity = 0
        conversion_rate = 0
        aov_growth = 0

    prod_sales = {}
    for o in orders:
        name  = o.get("productName", "Unknown Product")
        price = float(o.get("price", o.get("total", 0)))
        if name not in prod_sales:
            prod_sales[name] = {"revenue": 0.0, "sales": 0, "category": o.get("category", "General")}
        prod_sales[name]["revenue"] += price
        prod_sales[name]["sales"]   += 1

    product_performance = sorted(
        [{"id": n.lower().replace(" ", "-"), "name": n, "category": s["category"],
          "revenue": round(s["revenue"], 2), "orders": s["sales"], "sales": s["sales"]}
         for n, s in prod_sales.items()],
        key=lambda x: x["revenue"], reverse=True,
    )[:5]

    geo = {}
    for o in orders:
        region = o.get("region", "Other")
        price  = float(o.get("price", o.get("total", 0)))
        if region not in geo:
            geo[region] = {"revenue": 0.0, "customers": set()}
        geo[region]["revenue"] += price
        if o.get("customerEmail"):
            geo[region]["customers"].add(o["customerEmail"])

    geo_analytics = [
        {"region": r, "customers": len(s["customers"]), "revenue": round(s["revenue"], 2),
         "growth": 0, "activeRate": 80}
        for r, s in geo.items()
    ]

    rev = kpis["totalRevenue"]
    # Build real daily timeline from actual Firestore order dates
    _fs_daily: dict = {}
    for o in orders:
        price_o = float(o.get("price", o.get("total", 0)))
        pay_s   = o.get("paymentStatus", "")
        stat_o  = o.get("status", "")
        if not (pay_s == "Paid" or stat_o == "Completed"):
            continue
        try:
            dt_o = datetime.fromisoformat(o.get("createdAt", "").replace("Z", "+00:00")).replace(tzinfo=None)
            dow  = dt_o.strftime("%a")
            _fs_daily[dow] = _fs_daily.get(dow, 0.0) + price_o
        except Exception:
            pass

    _all_dows_fs   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    timeline_daily = [{"label": d, "value": round(_fs_daily.get(d, 0.0), 2)} for d in _all_dows_fs]
    sparkline_vals  = [round(_fs_daily.get(d, 0.0), 2) for d in _all_dows_fs]

    return {
        "kpis": kpis,
        "revenueTrend": {
            "today":    round(_fs_daily.get(datetime.utcnow().strftime("%a"), 0.0), 2),
            "sparkline": sparkline_vals,
            "timeline": {
                "daily":   timeline_daily,
                "weekly":  [{"label": "Wk 1", "value": round(rev * .22, 2)},
                             {"label": "Wk 2", "value": round(rev * .28, 2)}],
                "monthly": [{"label": datetime.utcnow().strftime("%b"), "value": rev}],
            },
        },
        "productPerformance": product_performance,
        "customerAnalytics": {
            "returningCustomers":  kpis["activeCustomers"],
            "repeatPurchasesCount":kpis["completedOrdersCount"],
            "repeatPurchaseRate":  round((kpis["completedOrdersCount"] / max(kpis["totalOrders"], 1)) * 100, 1),
            "newCustomers":        kpis["activeCustomers"],
            "clv":                 round(kpis["aov"] * 1.5, 2),
            "clvTrend":            [round(kpis["aov"] * 0.5, 2), round(kpis["aov"] * 0.8, 2), round(kpis["aov"] * 1.2, 2), round(kpis["aov"] * 1.5, 2)],
            "totalCustomers":      kpis["activeCustomers"],
        },
        "trustMetrics": {
            "satisfactionRate": kpis["avgRating"],
            "refundRate":       kpis["refundRate"],
        },
        "geoAnalytics": geo_analytics,
        "growth": {
            "revenueGrowth":   revenue_growth,
            "aovGrowth":       aov_growth,
            "refundRateGrowth": round((-kpis["refundRate"]), 1) if kpis["refundRate"] > 0 else 0,
            "customerGrowth":  growth_velocity,
            "reviewGrowth":    0,
        },
        "forecast": {
            "nextQuarterRevenue": round(rev * 1.25, 2),
            "nextMonthRevenue":   round(rev * 0.35, 2),
            "confidenceScore":    75 if rev > 0 else 0,
            "forecastPath": [
                {"label": "M+1", "value": round(rev * 0.35, 2)},
                {"label": "M+2", "value": round(rev * 0.38, 2)},
                {"label": "M+3", "value": round(rev * 0.42, 2)},
            ],
        },
        "_meta": {"totalReviews": len(reviews)},
    }

def get_full_dashboard_data():
    global _firestore_broken
    if not firebase_connected or db is None or _firestore_broken:
        db_s = SessionLocal()
        try:
            sql_orders = db_s.query(OrderModel).all()
            sql_products = db_s.query(ProductModel).all()
            sql_vendors = db_s.query(UserModel).filter(UserModel.role.in_(["vendor", "Vendor"])).all()
            
            orders = []
            for o in sql_orders:
                customer = db_s.query(UserModel).filter(UserModel.id == o.user_id).first()
                cust_name = customer.name if customer else "Customer"
                cust_email = customer.email if customer else ""
                
                p_name = "Product"
                if o.items:
                    prod = db_s.query(ProductModel).filter(ProductModel.id == o.items[0].product_id).first()
                    p_name = prod.title if prod else "Product"

                orders.append({
                    "id": str(o.id),
                    "price": float(o.total_amount or 0.0),
                    "total": float(o.total_amount or 0.0),
                    "status": o.status or "completed",
                    "paymentStatus": "Paid" if (o.status or "").lower() == "completed" else "Pending",
                    "customerName": cust_name,
                    "customerEmail": cust_email,
                    "createdAt": o.created_at.isoformat() + "Z" if o.created_at else "",
                    "productName": p_name
                })

            products = [{"status": p.status, "category": p.category, "title": p.title} for p in sql_products]
            vendors = [{"isApproved": v.is_verified or v.is_active, "status": "active" if v.is_active else "disabled", "displayName": v.name, "role": v.role} for v in sql_vendors]

            active_products = len([p for p in products if p.get("status") in ("active", "published", "Published", "Active")])
            now = datetime.utcnow()
            day_ago = now - timedelta(days=1)

            total_revenue = orders_today = refunded = successful = 0
            unique_cust = set()

            for o in orders:
                price      = float(o.get("price", o.get("total", 0)))
                status     = o.get("status", "")
                pay_status = o.get("paymentStatus", "")
                email      = o.get("customerEmail", "")
                if email:
                    unique_cust.add(email)
                if pay_status == "Paid" or status == "Completed":
                    total_revenue += price
                    successful    += 1
                if status == "Refunded" or pay_status == "Refunded":
                    refunded += 1
                try:
                    if datetime.fromisoformat(o.get("createdAt", "").replace("Z", "+00:00")).replace(tzinfo=None) > day_ago:
                        orders_today += 1
                except Exception:
                    pass

            total_orders = len(orders)
            refund_rate  = round(refunded / total_orders * 100, 2) if total_orders > 0 else 0.0

            # Compute real KPI metrics for SQL branch of get_full_dashboard_data
            try:
                now_sql = datetime.utcnow()
                cutoff_30d = now_sql - timedelta(days=30)
                prev_30d_start = cutoff_30d - timedelta(days=30)
                curr_30d = [o for o in orders if _parse_order_dt(o) >= cutoff_30d]
                prev_30d = [o for o in orders if prev_30d_start <= _parse_order_dt(o) < cutoff_30d]
                sql_revenue_change = compute_growth(curr_30d, prev_30d)
                curr_count_30d = len(curr_30d)
                prev_count_30d = len(prev_30d)
                sql_growth_velocity = round(((curr_count_30d - prev_count_30d) / max(prev_count_30d, 1)) * 100, 1)
                sql_conversion_rate = round((successful / max(total_orders, 1)) * 100, 1)
            except Exception:
                sql_revenue_change = 0
                sql_growth_velocity = 0
                sql_conversion_rate = 0

            kpis = {
                "totalRevenue":        round(total_revenue, 2),
                "ordersToday":         orders_today,
                "conversionRate":      sql_conversion_rate,
                "activeProducts":      active_products or len(products),
                "refundRate":          refund_rate,
                "growthVelocity":      sql_growth_velocity,
                "revenueChange":       sql_revenue_change,
                "ordersChange":        round(((curr_count_30d - prev_count_30d) / max(prev_count_30d, 1)) * 100, 1),
                "activeProductsChange":0,
                "modalData": {
                    "totalRevenue":   [0, 0, 0, 0, 0, 0, round(total_revenue, 2)],
                    "ordersToday":    [0, 0, 0, 0, 0, 0, orders_today],
                    "conversionRate": [2.5, 2.7, 2.9, 3.0, 3.1, 3.2, sql_conversion_rate],
                    "activeProducts": [0, 0, 0, 0, 0, 0, active_products or len(products)],
                    "refundRate":     [0, 0, 0, 0, 0, 0, refund_rate],
                    "growthVelocity": [10, 12, 14, 15, 16, 17, sql_growth_velocity],
                },
            }

            sorted_orders = sorted(orders, key=lambda x: x.get("createdAt", ""), reverse=True)[:5]
            live_feed = []
            for o in sorted_orders:
                amt  = float(o.get("price", o.get("total", 0)))
                item = o.get("productName", "Product")
                user = o.get("customerName", "Customer")
                ts   = o.get("createdAt", "")
                try:
                    dt_feed = datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)
                    elapsed_min = int((datetime.utcnow() - dt_feed).total_seconds() / 60)
                    if elapsed_min < 60:
                        time_label = f"{elapsed_min} min ago"
                    elif elapsed_min < 1440:
                        time_label = f"{elapsed_min // 60}h ago"
                    else:
                        time_label = dt_feed.strftime("%b %d")
                except Exception:
                    time_label = "Recently"
                live_feed.append({
                    "id":       f"sale-{o['id']}",
                    "text":     f"{user} purchased {item}",
                    "category": "purchase",
                    "time":     time_label,
                    "value":    f"+?{round(amt)}",
                })

            prod_sales = {}
            for o in orders:
                name  = o.get("productName", "Unknown")
                price = float(o.get("price", o.get("total", 0)))
                if name not in prod_sales:
                    prod_sales[name] = {"sales": 0, "revenue": 0.0}
                if o.get("status") == "Completed" or o.get("paymentStatus") == "Paid":
                    prod_sales[name]["sales"]   += 1
                    prod_sales[name]["revenue"] += price

            product_perf = sorted(
                [{"id": n.lower().replace(" ", "-"), "name": n, "price": round(s["revenue"] / s["sales"], 2) if s["sales"] else 0,
                  "category": "Asset", "sales": s["sales"], "revenue": round(s["revenue"], 2)}
                 for n, s in prod_sales.items()],
                key=lambda x: x["revenue"], reverse=True,
            )[:5]

            leaderboard = []
            risk_panel = []

            cust_map = {}
            for o in orders:
                email = o.get("customerEmail", "")
                name  = o.get("customerName", "Customer")
                price = float(o.get("price", o.get("total", 0)))
                if email:
                    if email not in cust_map:
                        cust_map[email] = {"name": name, "purchases": 0, "spent": 0.0}
                    cust_map[email]["purchases"] += 1
                    cust_map[email]["spent"]     += price

            top_customers = [
                {"name": v["name"], "email": k, "purchases": v["purchases"], "totalSpent": round(v["spent"], 2)}
                for k, v in sorted(cust_map.items(), key=lambda x: x[1]["spent"], reverse=True)[:5]
            ]

            geo = {}
            for o in orders:
                region = o.get("region", "Other")
                geo[region] = geo.get(region, 0) + 1
            geo_distribution = [{"region": r, "sales": c} for r, c in geo.items()]

            # Build revenueChart from real daily order data (last 30 days)
            daily_rev: dict = {}
            weekly_rev: dict = {}
            monthly_rev: dict = {}
            now_chart = datetime.utcnow()
            for o in orders:
                price      = float(o.get("price", o.get("total", 0)))
                pay_status = o.get("paymentStatus", "")
                status_v   = o.get("status", "")
                if not (pay_status == "Paid" or status_v == "Completed"):
                    continue
                try:
                    dt = datetime.fromisoformat(o.get("createdAt", "").replace("Z", "+00:00")).replace(tzinfo=None)
                except Exception:
                    continue
                # Daily (last 30 days)
                day_key = dt.strftime("%b %d")
                daily_rev[day_key] = daily_rev.get(day_key, {"gross": 0.0, "net": 0.0, "label": day_key})
                daily_rev[day_key]["gross"] += price
                daily_rev[day_key]["net"]   += round(price * 0.95, 2)
                # Weekly (last 12 weeks)
                week_key = f"Wk {dt.isocalendar()[1]}"
                weekly_rev[week_key] = weekly_rev.get(week_key, {"gross": 0.0, "net": 0.0, "label": week_key})
                weekly_rev[week_key]["gross"] += price
                weekly_rev[week_key]["net"]   += round(price * 0.95, 2)
                # Monthly (last 12 months)
                mon_key = dt.strftime("%b %Y")
                monthly_rev[mon_key] = monthly_rev.get(mon_key, {"gross": 0.0, "net": 0.0, "label": dt.strftime("%b")})
                monthly_rev[mon_key]["gross"] += price
                monthly_rev[mon_key]["net"]   += round(price * 0.95, 2)

            def _sort_chart(d):
                return sorted(d.values(), key=lambda x: x["label"])

            revenue_chart = {
                "daily":   _sort_chart(daily_rev)[-30:],
                "weekly":  _sort_chart(weekly_rev)[-12:],
                "monthly": _sort_chart(monthly_rev)[-12:],
            }

            # Health score from real metrics (0-100)
            health_deductions = 0
            if refund_rate > 5:
                health_deductions += 20
            elif refund_rate > 2:
                health_deductions += 10
            if total_orders == 0:
                health_deductions += 15
            computed_health = max(0, 100 - health_deductions)
            health_status_label = "Optimal" if computed_health >= 90 else ("Good" if computed_health >= 70 else "Needs Attention")

            return {
                "kpis": kpis,
                "liveFeed":        live_feed,
                "productPerf":     product_perf,
                "leaderboard":     leaderboard,
                "riskPanel":       risk_panel,
                "revenueChart":    revenue_chart,
                "customerInsights":{"topCustomers": top_customers, "geoDistribution": geo_distribution},
                "insights": [
                    {"label": "Transactions", "text": f"Platform has processed {total_orders} transactions."},
                    {"label": "Catalog", "text": f"Catalog contains {active_products or len(products)} products."},
                ],
                "headerStats": {
                    "activeUsers":   len(unique_cust),
                    "greeting":      "Good day",
                    "marketStatus":  "Active",
                },
                "healthScore":  computed_health,
                "healthStatus": health_status_label,
                "_meta": {"fetchedAt": datetime.utcnow().isoformat() + "Z"},
            }
        finally:
            db_s.close()

    try:
        orders_docs  = list(db.collection("orders").stream())
        products_docs= list(db.collection("products").stream())
        vendors_docs = list(db.collection("vendors").stream())
        reviews_docs = list(db.collection("reviews").stream())
        reports_docs = list(db.collection("reports").stream())
    except Exception as e:
        print(f"[analytics] Firestore error in get_full_dashboard_data: {e}. Falling back to SQLite.")
        _firestore_broken = True
        return get_full_dashboard_data()

    orders   = [{"id": d.id, **d.to_dict()} for d in orders_docs]
    products = [d.to_dict() for d in products_docs]
    vendors  = [d.to_dict() for d in vendors_docs]
    reports  = [d.to_dict() for d in reports_docs]

    active_products = len([p for p in products if p.get("status") in ("active", "published", "Published", "Active")])
    now    = datetime.utcnow()
    day_ago= now - timedelta(days=1)

    total_revenue = orders_today = refunded = successful = 0
    unique_cust = set()

    for o in orders:
        price      = float(o.get("price", o.get("total", 0)))
        status     = o.get("status", "")
        pay_status = o.get("paymentStatus", "")
        email      = o.get("customerEmail", "")
        if email:
            unique_cust.add(email)
        if pay_status == "Paid" or status == "Completed":
            total_revenue += price
            successful    += 1
        if status == "Refunded" or pay_status == "Refunded":
            refunded += 1
        try:
            if datetime.fromisoformat(o.get("createdAt", "").replace("Z", "+00:00")).replace(tzinfo=None) > day_ago:
                orders_today += 1
        except Exception:
            pass

    total_orders = len(orders)
    refund_rate  = round(refunded / total_orders * 100, 2) if total_orders > 0 else 0.0

    # Compute real KPI metrics for Firestore branch of get_full_dashboard_data
    try:
        now_fs = datetime.utcnow()
        cutoff_30d_fs = now_fs - timedelta(days=30)
        prev_30d_start_fs = cutoff_30d_fs - timedelta(days=30)
        curr_30d_fs = [o for o in orders if _parse_order_dt(o) >= cutoff_30d_fs]
        prev_30d_fs = [o for o in orders if prev_30d_start_fs <= _parse_order_dt(o) < cutoff_30d_fs]
        fs_revenue_change = compute_growth(curr_30d_fs, prev_30d_fs)
        curr_cnt_fs = len(curr_30d_fs)
        prev_cnt_fs = len(prev_30d_fs)
        fs_growth_velocity = round(((curr_cnt_fs - prev_cnt_fs) / max(prev_cnt_fs, 1)) * 100, 1)
        fs_conversion_rate = round((successful / max(total_orders, 1)) * 100, 1)
    except Exception:
        fs_revenue_change = 0
        fs_growth_velocity = 0
        fs_conversion_rate = 0

    kpis = {
        "totalRevenue":        round(total_revenue, 2),
        "ordersToday":         orders_today,
        "conversionRate":      fs_conversion_rate,
        "activeProducts":      active_products or len(products),
        "refundRate":          refund_rate,
        "growthVelocity":      fs_growth_velocity,
        "revenueChange":       fs_revenue_change,
        "ordersChange":        round(((curr_cnt_fs - prev_cnt_fs) / max(prev_cnt_fs, 1)) * 100, 1),
        "activeProductsChange":0,
        "modalData": {
            "totalRevenue":   [0, 0, 0, 0, 0, 0, round(total_revenue, 2)],
            "ordersToday":    [0, 0, 0, 0, 0, 0, orders_today],
            "conversionRate": [2.5, 2.7, 2.9, 3.0, 3.1, 3.2, fs_conversion_rate],
            "activeProducts": [0, 0, 0, 0, 0, 0, active_products or len(products)],
            "refundRate":     [0, 0, 0, 0, 0, 0, refund_rate],
            "growthVelocity": [10, 12, 14, 15, 16, 17, fs_growth_velocity],
        },
    }
    sorted_orders = sorted(orders, key=lambda x: x.get("createdAt", ""), reverse=True)[:5]
    live_feed = []
    for o in sorted_orders:
        amt  = float(o.get("price", o.get("total", 0)))
        item = o.get("productName", "Product")
        user = o.get("customerName", "Customer")
        ts   = o.get("createdAt", "")
        try:
            dt_feed = datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)
            elapsed_min = int((datetime.utcnow() - dt_feed).total_seconds() / 60)
            if elapsed_min < 60:
                time_label = f"{elapsed_min} min ago"
            elif elapsed_min < 1440:
                time_label = f"{elapsed_min // 60}h ago"
            else:
                time_label = dt_feed.strftime("%b %d")
        except Exception:
            time_label = "Recently"
        live_feed.append({
            "id":       f"sale-{o['id']}",
            "text":     f"{user} purchased {item}",
            "category": "purchase",
            "time":     time_label,
            "value":    f"+?{round(amt)}",
        })

    prod_sales = {}
    for o in orders:
        name  = o.get("productName", "Unknown")
        price = float(o.get("price", o.get("total", 0)))
        if name not in prod_sales:
            prod_sales[name] = {"sales": 0, "revenue": 0.0}
        if o.get("status") == "Completed" or o.get("paymentStatus") == "Paid":
            prod_sales[name]["sales"]   += 1
            prod_sales[name]["revenue"] += price

    product_perf = sorted(
        [{"id": n.lower().replace(" ", "-"), "name": n, "price": round(s["revenue"] / s["sales"], 2) if s["sales"] else 0,
          "category": "Asset", "sales": s["sales"], "revenue": round(s["revenue"], 2)}
         for n, s in prod_sales.items()],
        key=lambda x: x["revenue"], reverse=True,
    )[:5]

    leaderboard = [
        {"name": v.get("storeName", v.get("displayName", "Vendor")),
         "sales": int(float(v.get("totalEarnings", 0)) / 100),
         "revenue": float(v.get("totalEarnings", 0)),
         "rank": i + 1}
        for i, v in enumerate(
            sorted(vendors, key=lambda x: float(x.get("totalEarnings", 0)), reverse=True)[:5]
        )
    ]

    risk_panel = [
        {"id": r.get("id", str(i)), "level": "critical" if r.get("severity") == "high" else "warning",
         "ip": "N/A", "event": r.get("title", "Report"), "time": "Recently"}
        for i, r in enumerate(reports[:3])
    ]

    cust_map = {}
    for o in orders:
        email = o.get("customerEmail", "")
        name  = o.get("customerName", "Customer")
        price = float(o.get("price", o.get("total", 0)))
        if email:
            if email not in cust_map:
                cust_map[email] = {"name": name, "purchases": 0, "spent": 0.0}
            cust_map[email]["purchases"] += 1
            cust_map[email]["spent"]     += price

    top_customers = [
        {"name": v["name"], "email": k, "purchases": v["purchases"], "totalSpent": round(v["spent"], 2)}
        for k, v in sorted(cust_map.items(), key=lambda x: x[1]["spent"], reverse=True)[:5]
    ]

    geo = {}
    for o in orders:
        region = o.get("region", "Other")
        geo[region] = geo.get(region, 0) + 1
    geo_distribution = [{"region": r, "sales": c} for r, c in geo.items()]

    # Build revenueChart from real Firestore order data
    fs_daily_rev: dict = {}
    fs_weekly_rev: dict = {}
    fs_monthly_rev: dict = {}
    for o in orders:
        price      = float(o.get("price", o.get("total", 0)))
        pay_status = o.get("paymentStatus", "")
        status_v   = o.get("status", "")
        if not (pay_status == "Paid" or status_v == "Completed"):
            continue
        try:
            dt = datetime.fromisoformat(o.get("createdAt", "").replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            continue
        day_key = dt.strftime("%b %d")
        fs_daily_rev[day_key] = fs_daily_rev.get(day_key, {"gross": 0.0, "net": 0.0, "label": day_key})
        fs_daily_rev[day_key]["gross"] += price
        fs_daily_rev[day_key]["net"]   += round(price * 0.95, 2)
        week_key = f"Wk {dt.isocalendar()[1]}"
        fs_weekly_rev[week_key] = fs_weekly_rev.get(week_key, {"gross": 0.0, "net": 0.0, "label": week_key})
        fs_weekly_rev[week_key]["gross"] += price
        fs_weekly_rev[week_key]["net"]   += round(price * 0.95, 2)
        mon_key = dt.strftime("%b %Y")
        fs_monthly_rev[mon_key] = fs_monthly_rev.get(mon_key, {"gross": 0.0, "net": 0.0, "label": dt.strftime("%b")})
        fs_monthly_rev[mon_key]["gross"] += price
        fs_monthly_rev[mon_key]["net"]   += round(price * 0.95, 2)

    def _fs_sort_chart(d):
        return sorted(d.values(), key=lambda x: x["label"])

    revenue_chart = {
        "daily":   _fs_sort_chart(fs_daily_rev)[-30:],
        "weekly":  _fs_sort_chart(fs_weekly_rev)[-12:],
        "monthly": _fs_sort_chart(fs_monthly_rev)[-12:],
    }

    # Health score computed from real metrics
    fs_health_deductions = 0
    if refund_rate > 5:
        fs_health_deductions += 20
    elif refund_rate > 2:
        fs_health_deductions += 10
    if total_orders == 0:
        fs_health_deductions += 15
    fs_computed_health = max(0, 100 - fs_health_deductions)
    fs_health_label = "Optimal" if fs_computed_health >= 90 else ("Good" if fs_computed_health >= 70 else "Needs Attention")

    return {
        "kpis": kpis,
        "liveFeed":        live_feed,
        "productPerf":     product_perf,
        "leaderboard":     leaderboard,
        "riskPanel":       risk_panel,
        "revenueChart":    revenue_chart,
        "customerInsights":{"topCustomers": top_customers, "geoDistribution": geo_distribution},
        "insights": [
            {"label": "Transactions", "text": f"Platform has processed {total_orders} transactions."},
            {"label": "Catalog",      "text": f"Catalog contains {active_products or len(products)} products."},
        ],
        "headerStats": {
            "activeUsers":   len(unique_cust),
            "greeting":      "Good day",
            "marketStatus":  "Active",
        },
        "healthScore":  fs_computed_health,
        "healthStatus": fs_health_label,
        "_meta": {"fetchedAt": datetime.utcnow().isoformat() + "Z"},
    }
