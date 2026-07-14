from app.shared.firebase.connection import db, firebase_connected
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException

def _map_report(doc):
    r = doc.to_dict()
    pid = r.get("productId") or r.get("product_id") or ""
    
    # Try to resolve product from SQLite database
    product_title = ""
    product_thumbnail = ""
    product_exists = False
    
    if pid:
        try:
            from app.db.session import SessionLocal
            from app.models.product import Product
            db_s = SessionLocal()
            try:
                # Try integer parsing since ID in SQLite is Integer
                numeric_pid = int(pid)
                prod = db_s.query(Product).filter(Product.id == numeric_pid).first()
                if prod:
                    product_title = prod.title
                    product_thumbnail = prod.thumbnail or ""
                    product_exists = True
            finally:
                db_s.close()
        except Exception:
            pass

    # Fallback to Firestore if not found in SQLite
    if pid and not product_exists:
        if firebase_connected and db is not None:
            try:
                prod_doc = db.collection("products").document(str(pid)).get()
                if prod_doc.exists:
                    prod_dict = prod_doc.to_dict()
                    product_thumbnail = prod_dict.get("thumbnail", "")
                    product_title = prod_dict.get("title") or prod_dict.get("name") or ""
                    product_exists = True
            except Exception:
                pass
        
        # If still not found anywhere, label as Deleted Product
        if not product_exists:
            product_title = "Deleted Product"
            product_thumbnail = ""

    # If pid is empty or we have a snapshot title we want to preserve
    if not product_title:
        product_title = r.get("productTitle") or r.get("productName") or "—"
    if not product_thumbnail:
        product_thumbnail = r.get("productThumbnail") or r.get("thumbnail") or ""

    return {
        "id":               doc.id,
        "title":            r.get("title", "Report issue"),
        "reporter":         r.get("reporter", "Anonymous"),
        "status":           r.get("status", "Pending"),
        "severity":         r.get("severity", "medium"),
        "category":         r.get("category", "General"),
        "createdAt":        r.get("createdAt") or r.get("created_at") or datetime.utcnow().isoformat() + "Z",
        "resolvedAt":       r.get("resolvedAt"),
        "assignee":         r.get("assignee", "Unassigned"),
        "description":      r.get("description", ""),
        "productId":        pid,
        "productTitle":     product_title,
        "productThumbnail": product_thumbnail,
        "user_id":          r.get("user_id", ""),
    }

def get_reports_list(page: int = 1, page_size: int = 50, status: str = None, search: str = None):
    if not firebase_connected or db is None:
        return {"total": 0, "page": page, "page_size": page_size, "items": []}

    try:
        all_reports = [_map_report(d) for d in db.collection("reports").stream()]
    except Exception as e:
        print(f"[reports] Firestore stream error in get_reports_list: {e}")
        all_reports = []

    # Filter by status (case-insensitive)
    if status:
        all_reports = [r for r in all_reports if r["status"].lower() == status.lower()]

    # Filter by search term (title, reporter, category, description)
    if search:
        term = search.lower()
        all_reports = [
            r for r in all_reports
            if term in r["title"].lower()
            or term in r["reporter"].lower()
            or term in r["category"].lower()
            or term in r["description"].lower()
        ]

    total = len(all_reports)
    start = (page - 1) * page_size
    items = all_reports[start: start + page_size]

    return {"total": total, "page": page, "page_size": page_size, "items": items}

def get_reports_analytics_data():
    if not firebase_connected or db is None:
        today = datetime.utcnow()
        reports_per_day = []
        for i in range(4, -1, -1):
            d = today - timedelta(days=i)
            reports_per_day.append({
                "label": d.strftime("%a"),
                "date":  d.strftime("%Y-%m-%d"),
                "count": 0,
            })
        return {
            "total":              0,
            "openCount":          0,
            "resolvedCount":      0,
            "criticalCount":      0,
            "rejectedCount":      0,
            "avgResolutionHours": 0,
            "reportsPerDay":      reports_per_day,
            "mostReportedProducts": [],
            "categoryBreakdown": [],
            "insights": [
                {"type": "info", "text": "No reports submitted yet."}
            ],
            "reports": [],
        }

    try:
        docs = list(db.collection("reports").stream())
        reports_list = [_map_report(d) for d in docs]
    except Exception as e:
        print(f"[reports] Firestore stream error in get_reports_analytics_data: {e}")
        docs = []
        reports_list = []

    total = resolved = open_count = rejected = critical = 0
    resolution_hours = []
    category_counts  = {}
    product_counts   = {}
    daily_counts     = {}

    for r in reports_list:
        total += 1
        status   = r["status"]
        severity = r["severity"]
        category = r["category"]

        status_lower = status.lower() if status else ""
        if status_lower == "pending":    open_count += 1
        elif status_lower == "resolved": resolved   += 1
        elif status_lower == "rejected": rejected   += 1
        if severity == "high":     critical   += 1

        category_counts[category] = category_counts.get(category, 0) + 1

        pid = r["productId"]
        if pid:
            if pid not in product_counts:
                product_counts[pid] = {"title": r["productTitle"], "count": 0}
            product_counts[pid]["count"] += 1

        if status_lower == "resolved" and r["createdAt"] and r["resolvedAt"]:
            try:
                c = datetime.fromisoformat(r["createdAt"].replace("Z", "+00:00"))
                s = datetime.fromisoformat(r["resolvedAt"].replace("Z", "+00:00"))
                resolution_hours.append((s - c).total_seconds() / 3600)
            except Exception:
                pass

        try:
            daily_counts[r["createdAt"][:10]] = daily_counts.get(r["createdAt"][:10], 0) + 1
        except Exception:
            pass

    avg_hours = round(sum(resolution_hours) / len(resolution_hours), 1) if resolution_hours else 0

    today = datetime.utcnow()
    reports_per_day = []
    for i in range(4, -1, -1):
        d = today - timedelta(days=i)
        reports_per_day.append({
            "label": d.strftime("%a"),
            "date":  d.strftime("%Y-%m-%d"),
            "count": daily_counts.get(d.strftime("%Y-%m-%d"), 0),
        })

    return {
        "total":              total,
        "openCount":          open_count,
        "resolvedCount":      resolved,
        "criticalCount":      critical,
        "rejectedCount":      rejected,
        "avgResolutionHours": avg_hours,
        "reportsPerDay":      reports_per_day,
        "mostReportedProducts": sorted(
            [{"productId": k, "title": v["title"], "count": v["count"]} for k, v in product_counts.items()],
            key=lambda x: x["count"], reverse=True,
        ),
        "categoryBreakdown": sorted(
            [{"category": k, "count": v} for k, v in category_counts.items()],
            key=lambda x: x["count"], reverse=True,
        ),
        "insights": [
            {
                "type": "critical" if critical > 2 else "warning",
                "text": f"{critical} critical priority reports are unresolved.",
            },
            {
                "type": "info",
                "text": f"Average resolution time: {avg_hours} hours.",
            },
        ],
        "reports": reports_list,
    }

def update_report_status(report_id: str, status: str, note: str = None):
    if not firebase_connected or db is None:
        return {"success": True, "id": report_id, "status": status}
    update_data = {"status": status, "updatedAt": datetime.now(timezone.utc).isoformat() + "Z"}
    if status in ("Resolved", "Rejected"):
        update_data["resolvedAt"] = datetime.now(timezone.utc).isoformat() + "Z"
    if note:
        update_data["resolution_note"] = note
    db.collection("reports").document(report_id).update(update_data)
    return {"success": True, "id": report_id, "status": status}

def assign_report_moderator(report_id: str, assignee: str):
    if not firebase_connected or db is None:
        return {"success": True, "id": report_id, "assignee": assignee}
    db.collection("reports").document(report_id).update({
        "assignee":  assignee,
        "updatedAt": datetime.utcnow().isoformat() + "Z",
    })
    return {"success": True, "id": report_id, "assignee": assignee}

def remove_report(report_id: str):
    if not firebase_connected or db is None:
        return {"success": True, "id": report_id}
    db.collection("reports").document(report_id).delete()
    return {"success": True, "id": report_id}
