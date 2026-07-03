from app.shared.firebase.connection import db, firebase_connected
from datetime import datetime, timedelta
from fastapi import HTTPException
from app.db.session import SessionLocal
from app.models.order import Order as OrderModel
from app.models.product import Product as ProductModel
from app.models.user import User as UserModel
from app.models.review import Review as ReviewModel

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

def get_analytics_dashboard_data():
    if not firebase_connected or db is None:
        db_s = SessionLocal()
        try:
            sql_orders = db_s.query(OrderModel).all()
            sql_products = db_s.query(ProductModel).all()
            sql_vendors = db_s.query(UserModel).filter(UserModel.role.in_(["vendor", "Vendor"])).all()
            sql_reviews = db_s.query(ReviewModel).all()

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

            products = [{"status": p.status, "category": p.category, "title": p.title} for p in sql_products]
            vendors = [{"isApproved": v.is_verified or v.is_active, "status": "active" if v.is_active else "disabled", "role": v.role} for v in sql_vendors]
            reviews = [{"rating": r.rating} for r in sql_reviews]

            products_count = len(products)
            vendors_count = len(vendors)
            kpis = calculate_kpis(orders, products_count, vendors_count, reviews)

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
            timeline_daily = [
                {"label": d, "value": round(rev * w, 2)}
                for d, w in [("Mon", .10), ("Tue", .12), ("Wed", .15), ("Thu", .11),
                             ("Fri", .18), ("Sat", .20), ("Sun", .14)]
            ]

            return {
                "kpis": kpis,
                "revenueTrend": {
                    "today":    round(rev * 0.15, 2),
                    "sparkline":[100, 150, 120, 200, 250, 220, 300],
                    "timeline": {
                        "daily":   timeline_daily,
                        "weekly":  [{"label": "Wk 1", "value": round(rev * .22, 2)},
                                     {"label": "Wk 2", "value": round(rev * .28, 2)}],
                        "monthly": [{"label": "Jun",  "value": rev}],
                    },
                },
                "productPerformance": product_performance,
                "customerAnalytics": {
                    "returningCustomers":  int(kpis["activeCustomers"] * 0.35),
                    "repeatPurchasesCount":int(kpis["activeCustomers"] * 0.25),
                    "repeatPurchaseRate":  35,
                    "newCustomers":        int(kpis["activeCustomers"] * 0.65),
                    "clv":                 round(kpis["aov"] * 1.5, 2),
                    "clvTrend":            [100, 110, 115, round(kpis["aov"] * 1.5, 2)],
                    "totalCustomers":      kpis["activeCustomers"],
                },
                "trustMetrics": {
                    "satisfactionRate": kpis["avgRating"],
                    "refundRate":       kpis["refundRate"],
                },
                "geoAnalytics": geo_analytics,
                "growth": {
                    "revenueGrowth":   12,
                    "aovGrowth":       4,
                    "refundRateGrowth":-1,
                    "customerGrowth":  8,
                    "reviewGrowth":    5,
                },
                "forecast": {
                    "nextQuarterRevenue": round(rev * 1.25, 2),
                    "nextMonthRevenue":   round(rev * 0.45, 2),
                    "confidenceScore":    90,
                    "forecastPath": [
                        {"label": "Jul", "value": round(rev * 0.42, 2)},
                        {"label": "Aug", "value": round(rev * 0.45, 2)},
                        {"label": "Sep", "value": round(rev * 0.48, 2)},
                    ],
                },
                "_meta": {"totalReviews": len(reviews)},
            }
        finally:
            db_s.close()

    orders   = [doc.to_dict() for doc in db.collection("orders").stream()]
    products = [doc.to_dict() for doc in db.collection("products").stream()]
    vendors  = [doc.to_dict() for doc in db.collection("vendors").stream()]
    reviews  = [doc.to_dict() for doc in db.collection("reviews").stream()]

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
    timeline_daily = [
        {"label": d, "value": round(rev * w, 2)}
        for d, w in [("Mon", .10), ("Tue", .12), ("Wed", .15), ("Thu", .11),
                     ("Fri", .18), ("Sat", .20), ("Sun", .14)]
    ]

    return {
        "kpis": kpis,
        "revenueTrend": {
            "today":    round(rev * 0.15, 2),
            "sparkline":[100, 150, 120, 200, 250, 220, 300],
            "timeline": {
                "daily":   timeline_daily,
                "weekly":  [{"label": "Wk 1", "value": round(rev * .22, 2)},
                             {"label": "Wk 2", "value": round(rev * .28, 2)}],
                "monthly": [{"label": "Jun",  "value": rev}],
            },
        },
        "productPerformance": product_performance,
        "customerAnalytics": {
            "returningCustomers":  int(kpis["activeCustomers"] * 0.35),
            "repeatPurchasesCount":int(kpis["activeCustomers"] * 0.25),
            "repeatPurchaseRate":  35,
            "newCustomers":        int(kpis["activeCustomers"] * 0.65),
            "clv":                 round(kpis["aov"] * 1.5, 2),
            "clvTrend":            [100, 110, 115, round(kpis["aov"] * 1.5, 2)],
            "totalCustomers":      kpis["activeCustomers"],
        },
        "trustMetrics": {
            "satisfactionRate": kpis["avgRating"],
            "refundRate":       kpis["refundRate"],
        },
        "geoAnalytics": geo_analytics,
        "growth": {
            "revenueGrowth":   12,
            "aovGrowth":       4,
            "refundRateGrowth":-1,
            "customerGrowth":  8,
            "reviewGrowth":    5,
        },
        "forecast": {
            "nextQuarterRevenue": round(rev * 1.25, 2),
            "nextMonthRevenue":   round(rev * 0.45, 2),
            "confidenceScore":    90,
            "forecastPath": [
                {"label": "Jul", "value": round(rev * 0.42, 2)},
                {"label": "Aug", "value": round(rev * 0.45, 2)},
                {"label": "Sep", "value": round(rev * 0.48, 2)},
            ],
        },
        "_meta": {"totalReviews": len(reviews)},
    }

def get_full_dashboard_data():
    if not firebase_connected or db is None:
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

            kpis = {
                "totalRevenue":        round(total_revenue, 2),
                "ordersToday":         orders_today,
                "conversionRate":      3.2,
                "activeProducts":      active_products or len(products),
                "refundRate":          refund_rate,
                "growthVelocity":      18,
                "revenueChange":       12,
                "ordersChange":        8,
                "activeProductsChange":4,
                "modalData": {
                    "totalRevenue":   [0, 0, 0, 0, 0, 0, round(total_revenue, 2)],
                    "ordersToday":    [0, 0, 0, 0, 0, 0, orders_today],
                    "conversionRate": [2.5, 2.7, 2.9, 3.0, 3.1, 3.2, 3.2],
                    "activeProducts": [0, 0, 0, 0, 0, 0, active_products or len(products)],
                    "refundRate":     [0, 0, 0, 0, 0, 0, refund_rate],
                    "growthVelocity": [10, 12, 14, 15, 16, 17, 18],
                },
            }

            sorted_orders = sorted(orders, key=lambda x: x.get("createdAt", ""), reverse=True)[:5]
            live_feed = [
                {"id": f"sale-{o['id']}", "type": "sale", "user": o.get("customerName", "Customer"),
                 "item": o.get("productName", "Product"), "time": "Recently", "value": float(o.get("price", o.get("total", 0)))}
                for o in sorted_orders
            ]
            for i, v in enumerate(vendors[:3]):
                live_feed.append({
                    "id": f"signup-{i}", "type": "signup",
                    "user": v.get("storeName", v.get("displayName", "Vendor")),
                    "item": "Creator Account", "time": "Recently", "value": None,
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

            return {
                "kpis": kpis,
                "liveFeed":        live_feed,
                "productPerf":     product_perf,
                "leaderboard":     leaderboard,
                "riskPanel":       risk_panel,
                "customerInsights":{"topCustomers": top_customers, "geoDistribution": geo_distribution},
                "insights": [
                    f"Platform has processed {total_orders} transactions.",
                    f"Catalog contains {active_products or len(products)} products.",
                ],
                "headerStats": {
                    "activeUsers":   len(unique_cust),
                    "greeting":      "Good day",
                    "marketStatus":  "Active",
                },
                "healthScore":  98,
                "healthStatus": "Optimal",
            }
        finally:
            db_s.close()

    orders_docs  = list(db.collection("orders").stream())
    products_docs= list(db.collection("products").stream())
    vendors_docs = list(db.collection("vendors").stream())
    reviews_docs = list(db.collection("reviews").stream())
    reports_docs = list(db.collection("reports").stream())

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

    kpis = {
        "totalRevenue":        round(total_revenue, 2),
        "ordersToday":         orders_today,
        "conversionRate":      3.2,
        "activeProducts":      active_products or len(products),
        "refundRate":          refund_rate,
        "growthVelocity":      18,
        "revenueChange":       12,
        "ordersChange":        8,
        "activeProductsChange":4,
        "modalData": {
            "totalRevenue":   [0, 0, 0, 0, 0, 0, round(total_revenue, 2)],
            "ordersToday":    [0, 0, 0, 0, 0, 0, orders_today],
            "conversionRate": [2.5, 2.7, 2.9, 3.0, 3.1, 3.2, 3.2],
            "activeProducts": [0, 0, 0, 0, 0, 0, active_products or len(products)],
            "refundRate":     [0, 0, 0, 0, 0, 0, refund_rate],
            "growthVelocity": [10, 12, 14, 15, 16, 17, 18],
        },
    }

    sorted_orders = sorted(orders, key=lambda x: x.get("createdAt", ""), reverse=True)[:5]
    live_feed = [
        {"id": f"sale-{o['id']}", "type": "sale", "user": o.get("customerName", "Customer"),
         "item": o.get("productName", "Product"), "time": "Recently", "value": float(o.get("price", o.get("total", 0)))}
        for o in sorted_orders
    ]
    for i, v in enumerate(vendors[:3]):
        live_feed.append({
            "id": f"signup-{i}", "type": "signup",
            "user": v.get("storeName", v.get("displayName", "Vendor")),
            "item": "Creator Account", "time": "Recently", "value": None,
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

    return {
        "kpis": kpis,
        "liveFeed":        live_feed,
        "productPerf":     product_perf,
        "leaderboard":     leaderboard,
        "riskPanel":       risk_panel,
        "customerInsights":{"topCustomers": top_customers, "geoDistribution": geo_distribution},
        "insights": [
            f"Platform has processed {total_orders} transactions.",
            f"Catalog contains {active_products or len(products)} products.",
        ],
        "headerStats": {
            "activeUsers":   len(unique_cust),
            "greeting":      "Good day",
            "marketStatus":  "Active",
        },
        "healthScore":  98,
        "healthStatus": "Optimal",
    }
