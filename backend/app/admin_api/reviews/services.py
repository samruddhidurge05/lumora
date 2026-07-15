from app.shared.firebase.connection import db, firebase_connected
from fastapi import HTTPException
from app.db.session import SessionLocal
from app.models.review import Review as ReviewModel
from app.models.user import User as UserModel
from app.models.product import Product as ProductModel
from sqlalchemy import or_, func


def get_paginated_reviews(page: int, page_size: int, sentiment: str | None, search: str | None):
    # Clamp
    page = max(1, page)
    page_size = max(1, min(200, page_size))

    if firebase_connected and db is not None:
        from firebase_admin import firestore
        try:
            query_ref = db.collection("reviews")
            if sentiment == "positive":
                query_ref = query_ref.where("rating", ">", 3)
            elif sentiment == "neutral":
                query_ref = query_ref.where("rating", "==", 3)
            elif sentiment == "negative":
                query_ref = query_ref.where("rating", "<", 3)

            try:
                total = query_ref.count().get()[0][0].value
            except Exception:
                total = len(list(query_ref.stream()))

            # Order by createdAt or date descending and offset/limit
            paginated_query = query_ref.order_by("createdAt", direction=firestore.Query.DESCENDING).offset((page - 1) * page_size).limit(page_size)
            docs = list(paginated_query.stream())
            items = []
            for doc in docs:
                r = doc.to_dict()
                rating = int(r.get("rating", 5))
                if rating > 3:
                    sent = "positive"
                elif rating == 3:
                    sent = "neutral"
                else:
                    sent = "negative"

                items.append({
                    "id":        doc.id,
                    "customer":  r.get("customer", "Anonymous"),
                    "comment":   r.get("comment", ""),
                    "product":   r.get("product", "General Product"),
                    "sentiment": sent,
                    "rating":    rating,
                    "date":      r.get("date") or r.get("createdAt") or "recently",
                    "verified":  bool(r.get("verified", True)),
                    "flagged":   bool(r.get("flagged", False)),
                })

            if search:
                term = search.lower()
                items = [
                    it for it in items
                    if term in it["comment"].lower() or term in it["customer"].lower() or term in it["product"].lower()
                ]
                total = len(items)

            return {"total": total, "page": page, "page_size": page_size, "items": items}
        except Exception as e:
            print(f"[firestore-reviews] Paginated query failed ({e}), falling back to SQLite query")

    db_s = SessionLocal()
    try:
        q = db_s.query(ReviewModel).join(UserModel, ReviewModel.user_id == UserModel.id, isouter=True)\
                                   .join(ProductModel, ReviewModel.product_id == ProductModel.id, isouter=True)

        # Sentiment filter (rating-based)
        if sentiment == "positive":
            q = q.filter(ReviewModel.rating > 3)
        elif sentiment == "neutral":
            q = q.filter(ReviewModel.rating == 3)
        elif sentiment == "negative":
            q = q.filter(ReviewModel.rating < 3)

        # Search filter
        if search:
            pattern = f"%{search}%"
            q = q.filter(
                or_(
                    ReviewModel.comment.ilike(pattern),
                    UserModel.name.ilike(pattern),
                    ProductModel.title.ilike(pattern),
                )
            )

        total = q.count()
        offset = (page - 1) * page_size
        rows = q.order_by(ReviewModel.created_at.desc()).offset(offset).limit(page_size).all()

        items = []
        for r in rows:
            rating = int(r.rating or 5)
            if rating > 3:
                sent = "positive"
            elif rating == 3:
                sent = "neutral"
            else:
                sent = "negative"

            items.append({
                "id":        str(r.id),
                "customer":  r.user.name if r.user else "Anonymous",
                "comment":   r.comment or "",
                "product":   r.product.title if r.product else "Product",
                "sentiment": sent,
                "rating":    rating,
                "date":      r.created_at.isoformat() + "Z" if r.created_at else "recently",
                "verified":  bool(r.verified),
                "flagged":   False,
            })

        return {"total": total, "page": page, "page_size": page_size, "items": items}
    finally:
        db_s.close()

_firestore_broken = False

def _compute_sentiment_trend(reviews_list: list) -> list:
    """
    Group reviews by day (last 6 days that have data) and return
    a list of positive-percentage values — one per day bucket.
    If there are fewer than 2 days of data, returns [] so the frontend
    shows the "Not enough data" empty state instead of a flat line.
    """
    from collections import defaultdict
    import datetime

    buckets = defaultdict(lambda: {"pos": 0, "total": 0})
    for rev in reviews_list:
        raw_date = rev.get("date") or rev.get("createdAt") or ""
        if isinstance(raw_date, str) and raw_date:
            try:
                dt = datetime.datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
                day_key = dt.strftime("%Y-%m-%d")
            except ValueError:
                continue
        elif hasattr(raw_date, "strftime"):
            day_key = raw_date.strftime("%Y-%m-%d")
        else:
            continue
        buckets[day_key]["total"] += 1
        if rev.get("sentiment") == "positive":
            buckets[day_key]["pos"] += 1

    if len(buckets) < 2:
        return []

    sorted_days = sorted(buckets.keys())[-6:]
    return [
        round(buckets[d]["pos"] / buckets[d]["total"] * 100) if buckets[d]["total"] > 0 else 0
        for d in sorted_days
    ]


def _compute_sentiment_trend_sql(reviews_sql: list) -> list:
    """Same bucketing logic for SQLite review model objects."""
    import datetime
    from collections import defaultdict

    buckets = defaultdict(lambda: {"pos": 0, "total": 0})
    for r in reviews_sql:
        if r.created_at:
            day_key = r.created_at.strftime("%Y-%m-%d")
        else:
            continue
        buckets[day_key]["total"] += 1
        if (r.rating or 5) > 3:
            buckets[day_key]["pos"] += 1

    if len(buckets) < 2:
        return []

    sorted_days = sorted(buckets.keys())[-6:]
    return [
        round(buckets[d]["pos"] / buckets[d]["total"] * 100) if buckets[d]["total"] > 0 else 0
        for d in sorted_days
    ]

def get_reviews_dashboard_data():
    global _firestore_broken
    if not firebase_connected or db is None or _firestore_broken:
        db_s = SessionLocal()
        try:
            docs = db_s.query(ReviewModel).order_by(ReviewModel.created_at.desc()).all()
            latest_reviews = []
            ratings = []
            positive_count = neutral_count = negative_count = 0

            for r in docs:
                rating = int(r.rating or 5)
                ratings.append(rating)

                if rating == 3:
                    sentiment = "neutral"
                    neutral_count += 1
                elif rating < 3:
                    sentiment = "negative"
                    negative_count += 1
                else:
                    sentiment = "positive"
                    positive_count += 1

                p_title = r.product.title if r.product else "Product"
                u_name = r.user.name if r.user else "Anonymous"

                latest_reviews.append({
                    "id":       str(r.id),
                    "customer": u_name,
                    "comment":  r.comment or "",
                    "product":  p_title,
                    "sentiment":sentiment,
                    "rating":   rating,
                    "date":     r.created_at.isoformat() + "Z" if r.created_at else "recently",
                    "verified": bool(r.verified),
                    "flagged":  False,
                })

            total    = len(ratings)
            avg      = round(sum(ratings) / total, 2) if total > 0 else 0
            pos_pct  = round(positive_count / total * 100) if total > 0 else 0
            neu_pct  = round(neutral_count  / total * 100) if total > 0 else 0
            neg_pct  = round(negative_count / total * 100) if total > 0 else 0

            prod_map = {}
            for rev in latest_reviews:
                p = rev["product"]
                if p not in prod_map:
                    prod_map[p] = {"ratings": [], "count": 0}
                prod_map[p]["ratings"].append(rev["rating"])
                prod_map[p]["count"] += 1

            product_satisfaction = [
                {
                    "name":         name,
                    "rating":       round(sum(v["ratings"]) / len(v["ratings"]), 1),
                    "reviewsCount": v["count"],
                    "trustScore":   min(99, round((sum(v["ratings"]) / len(v["ratings"])) / 5 * 100)),
                }
                for name, v in prod_map.items()
            ]

            return {
                "averageRating":      avg,
                "totalReviews":       total,
                "positivePercentage": pos_pct,
                "neutralPercentage":  neu_pct,
                "negativePercentage": neg_pct,
                "sentimentTrend":     _compute_sentiment_trend_sql(docs),                "latestReviews":      latest_reviews,
                "productSatisfaction":product_satisfaction,
                "voiceHighlights": {
                    "positive":     next((r["comment"] for r in latest_reviews if r["sentiment"] == "positive"), ""),
                    "constructive": next((r["comment"] for r in latest_reviews if r["sentiment"] == "neutral"),  ""),
                    "requests":     next((r["comment"] for r in latest_reviews if r["sentiment"] == "negative"), ""),
                },
            }
        finally:
            db_s.close()

    try:
        docs = list(db.collection("reviews").stream())
    except Exception as e:
        print(f"[reviews] Firestore error: {e}. Falling back to SQLite.")
        _firestore_broken = True
        return get_reviews_dashboard_data()

    latest_reviews = []
    ratings = []
    positive_count = neutral_count = negative_count = 0

    for doc in docs:
        r = doc.to_dict()
        rating = int(r.get("rating", 5))
        ratings.append(rating)

        if rating == 3:
            sentiment = "neutral"
            neutral_count += 1
        elif rating < 3:
            sentiment = "negative"
            negative_count += 1
        else:
            sentiment = "positive"
            positive_count += 1

        latest_reviews.append({
            "id":       doc.id,
            "customer": r.get("customer", "Anonymous"),
            "comment":  r.get("comment", ""),
            "product":  r.get("product", "General Product"),
            "sentiment":sentiment,
            "rating":   rating,
            "date":     r.get("date", r.get("createdAt", "recently")),
            "verified": bool(r.get("verified", True)),
            "flagged":  bool(r.get("flagged", False)),
        })

    total    = len(ratings)
    avg      = round(sum(ratings) / total, 2) if total > 0 else 0
    pos_pct  = round(positive_count / total * 100) if total > 0 else 0
    neu_pct  = round(neutral_count  / total * 100) if total > 0 else 0
    neg_pct  = round(negative_count / total * 100) if total > 0 else 0

    prod_map = {}
    for rev in latest_reviews:
        p = rev["product"]
        if p not in prod_map:
            prod_map[p] = {"ratings": [], "count": 0}
        prod_map[p]["ratings"].append(rev["rating"])
        prod_map[p]["count"] += 1

    product_satisfaction = [
        {
            "name":         name,
            "rating":       round(sum(v["ratings"]) / len(v["ratings"]), 1),
            "reviewsCount": v["count"],
            "trustScore":   min(99, round((sum(v["ratings"]) / len(v["ratings"])) / 5 * 100)),
        }
        for name, v in prod_map.items()
    ]

    return {
        "averageRating":      avg,
        "totalReviews":       total,
        "positivePercentage": pos_pct,
        "neutralPercentage":  neu_pct,
        "negativePercentage": neg_pct,
        "sentimentTrend":     _compute_sentiment_trend(latest_reviews),
        "latestReviews":      latest_reviews,
        "productSatisfaction":product_satisfaction,
        "voiceHighlights": {
            "positive":     next((r["comment"] for r in latest_reviews if r["sentiment"] == "positive"), ""),
            "constructive": next((r["comment"] for r in latest_reviews if r["sentiment"] == "neutral"),  ""),
            "requests":     next((r["comment"] for r in latest_reviews if r["sentiment"] == "negative"), ""),
        },
    }

def moderate_review(review_id: str, action: str):
    db_s = SessionLocal()
    try:
        review = db_s.query(ReviewModel).filter(ReviewModel.id == int(review_id)).first()
        if review:
            if action == "delete":
                db_s.delete(review)
            db_s.commit()
    finally:
        db_s.close()

    if firebase_connected and db is not None:
        ref = db.collection("reviews").document(review_id)
        if action == "flag":
            ref.update({"flagged": True})
        elif action == "unflag":
            ref.update({"flagged": False})
        elif action == "delete":
            ref.delete()
        else:
            raise HTTPException(status_code=400, detail=f"Unknown moderation action: {action}")
    return {"success": True, "action": action, "id": review_id}
