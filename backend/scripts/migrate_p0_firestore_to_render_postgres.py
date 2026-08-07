import os
import sys
from datetime import datetime, timezone

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)

from dotenv import load_dotenv
load_dotenv(os.path.join(project_root, ".env"))

from app.db.session import SessionLocal
from app.shared.firebase.connection import db as fdb, firebase_connected
from app.models import (
    Review, SQLReport, RefundRequest, AffiliateProfile, User, Product, Order
)

def parse_iso_datetime(dt_str):
    if not dt_str:
        return datetime.utcnow()
    if isinstance(dt_str, datetime):
        return dt_str.replace(tzinfo=None)
    try:
        clean_str = str(dt_str).replace('Z', '+00:00')
        return datetime.fromisoformat(clean_str).replace(tzinfo=None)
    except Exception:
        return datetime.utcnow()

def migrate_data():
    print("=" * 100)
    print("P0 FIRESTORE TO RENDER POSTGRESQL PRODUCTION DATA MIGRATION")
    print("=" * 100)

    if not firebase_connected or fdb is None:
        print("CRITICAL ERROR: Firestore connection failed!")
        return

    session = SessionLocal()

    records_migrated = {
        "reviews": 0,
        "reports": 0,
        "refund_requests": 0,
        "affiliate_profiles": 0
    }
    records_skipped = {
        "reviews": 0,
        "reports": 0,
        "refund_requests": 0,
        "affiliate_profiles": 0
    }

    try:
        # ==========================================
        # 1. MIGRATE REVIEWS
        # ==========================================
        print("\n--- 1. Migrating Reviews ---")
        fs_reviews = list(fdb.collection("reviews").stream())
        for d in fs_reviews:
            data = d.to_dict() or {}
            
            # Check ID
            try:
                rev_id = int(d.id)
            except ValueError:
                rev_id = data.get("id")
            
            user_id = data.get("user_id") or data.get("userId")
            product_id = data.get("product_id") or data.get("productId")
            
            if isinstance(user_id, str) and user_id.isdigit():
                user_id = int(user_id)
            if isinstance(product_id, str) and product_id.isdigit():
                product_id = int(product_id)

            # Check if user and product exist in PG
            user_exists = session.query(User).filter(User.id == user_id).first() if user_id else None
            prod_exists = session.query(Product).filter(Product.id == product_id).first() if product_id else None

            if not user_exists or not prod_exists:
                print(f"  [Skipped Review] Doc ID: {d.id} (user_id: {user_id}, product_id: {product_id} not found in PG)")
                records_skipped["reviews"] += 1
                continue

            # Check if review already exists in PG
            existing = None
            if rev_id and isinstance(rev_id, int):
                existing = session.query(Review).filter(Review.id == rev_id).first()
            if not existing:
                existing = session.query(Review).filter(
                    Review.user_id == user_id,
                    Review.product_id == product_id,
                    Review.comment == data.get("comment")
                ).first()

            if existing:
                print(f"  [Already Exists] Review ID #{existing.id}")
                records_skipped["reviews"] += 1
            else:
                created_at = parse_iso_datetime(data.get("createdAt") or data.get("created_at"))
                new_rev = Review(
                    id=rev_id if isinstance(rev_id, int) else None,
                    user_id=user_id,
                    product_id=product_id,
                    rating=float(data.get("rating", 5.0)),
                    comment=data.get("comment", ""),
                    reply=data.get("reply", ""),
                    verified=bool(data.get("verified", True)),
                    created_at=created_at,
                    updated_at=created_at
                )
                session.add(new_rev)
                session.flush()
                print(f"  [Restored Review] ID #{new_rev.id}: user_id={user_id}, product_id={product_id}, rating={new_rev.rating}")
                records_migrated["reviews"] += 1

        # ==========================================
        # 2. MIGRATE REPORTS
        # ==========================================
        print("\n--- 2. Migrating Reports ---")
        fs_reports = list(fdb.collection("reports").stream())
        for d in fs_reports:
            data = d.to_dict() or {}

            user_id = str(data.get("user_id") or data.get("userId") or "0")
            product_id = str(data.get("product_id") or data.get("productId") or "0")
            category = data.get("category", "general")
            desc = data.get("description", "")
            title = data.get("title", f"Report: {category}")
            status = data.get("status", "Pending")
            reporter = data.get("reporter") or data.get("reporterEmail") or "System User"
            severity = data.get("severity", "medium")
            assignee = data.get("assignee", "Unassigned")
            created_at = parse_iso_datetime(data.get("createdAt") or data.get("created_at"))
            resolved_at = parse_iso_datetime(data.get("resolvedAt")) if data.get("resolvedAt") else None

            # Check if report already exists in PG
            existing = session.query(SQLReport).filter(
                SQLReport.user_id == user_id,
                SQLReport.product_id == product_id,
                SQLReport.description == desc
            ).first()

            if existing:
                print(f"  [Already Exists] Report ID #{existing.id}")
                records_skipped["reports"] += 1
            else:
                new_rep = SQLReport(
                    user_id=user_id,
                    product_id=product_id,
                    category=category,
                    description=desc,
                    status=status,
                    reporter=reporter,
                    title=title,
                    severity=severity,
                    assignee=assignee,
                    created_at=created_at,
                    resolved_at=resolved_at
                )
                session.add(new_rep)
                session.flush()
                print(f"  [Restored Report] ID #{new_rep.id}: user_id={user_id}, product_id={product_id}, title={title}")
                records_migrated["reports"] += 1

        # ==========================================
        # 3. MIGRATE REFUND REQUESTS
        # ==========================================
        print("\n--- 3. Migrating Refund Requests ---")
        fs_refunds = list(fdb.collection("refund_requests").stream())
        if not fs_refunds:
            fs_refunds = list(fdb.collection("refunds").stream())

        for d in fs_refunds:
            data = d.to_dict() or {}
            
            try:
                ref_id = int(d.id)
            except ValueError:
                ref_id = data.get("id")

            # Parse order ID
            ord_str = str(data.get("orderId") or data.get("order_id") or "")
            order_id = None
            if ord_str.startswith("ORD-") and ord_str[4:].isdigit():
                order_id = int(ord_str[4:])
            elif ord_str.isdigit():
                order_id = int(ord_str)

            user_id = data.get("customerId") or data.get("user_id") or data.get("userId")
            if isinstance(user_id, str) and user_id.isdigit():
                user_id = int(user_id)

            order_obj = session.query(Order).filter(Order.id == order_id).first() if order_id else None
            user_obj = session.query(User).filter(User.id == user_id).first() if user_id else None

            if not order_obj or not user_obj:
                print(f"  [Skipped Refund] Doc ID: {d.id} (order_id: {order_id}, user_id: {user_id} not found in PG)")
                records_skipped["refund_requests"] += 1
                continue

            existing = None
            if ref_id and isinstance(ref_id, int):
                existing = session.query(RefundRequest).filter(RefundRequest.id == ref_id).first()
            if not existing:
                existing = session.query(RefundRequest).filter(
                    RefundRequest.order_id == order_id,
                    RefundRequest.user_id == user_id
                ).first()

            if existing:
                print(f"  [Already Exists] Refund Request ID #{existing.id}")
                records_skipped["refund_requests"] += 1
            else:
                created_at = parse_iso_datetime(data.get("createdAt") or data.get("created_at"))
                updated_at = parse_iso_datetime(data.get("updatedAt") or data.get("updated_at"))
                amount = float(data.get("amount") or order_obj.total_amount or 0.0)

                new_ref = RefundRequest(
                    id=ref_id if isinstance(ref_id, int) else None,
                    order_id=order_id,
                    user_id=user_id,
                    reason_category=data.get("reasonCategory") or data.get("reason_category") or "other",
                    details=data.get("details") or data.get("reason") or "Refund request submitted",
                    status=data.get("status", "PENDING").upper(),
                    requested_amount=amount,
                    currency="INR",
                    payment_id=f"pay_migrated_{order_id}",
                    admin_notes=data.get("adminNotes"),
                    created_at=created_at,
                    updated_at=updated_at,
                    product_name=data.get("productName") or "Purchased Product",
                    order_total=order_obj.total_amount,
                    payment_method=order_obj.payment_method or "razorpay",
                    purchase_date=order_obj.created_at
                )
                session.add(new_ref)
                session.flush()
                print(f"  [Restored Refund] ID #{new_ref.id}: order_id={order_id}, user_id={user_id}, status={new_ref.status}")
                records_migrated["refund_requests"] += 1

        # ==========================================
        # 4. MIGRATE AFFILIATE PROFILES
        # ==========================================
        print("\n--- 4. Migrating Affiliate Profiles ---")
        fs_affs = list(fdb.collection("affiliates").stream())
        for d in fs_affs:
            data = d.to_dict() or {}
            email = (data.get("email") or "").strip().lower()
            code = data.get("affiliateCode") or data.get("code") or data.get("referral_code")

            if not email:
                print(f"  [Skipped Aff Profile] Doc ID: {d.id} (No email present)")
                records_skipped["affiliate_profiles"] += 1
                continue

            user_obj = session.query(User).filter(User.email.ilike(email)).first()
            if not user_obj:
                print(f"  [Skipped Aff Profile] Doc ID: {d.id} (Email '{email}' not found in PG users)")
                records_skipped["affiliate_profiles"] += 1
                continue

            # Check if affiliate profile already exists for this user
            existing_prof = session.query(AffiliateProfile).filter(AffiliateProfile.user_id == user_obj.id).first()
            if existing_prof:
                print(f"  [Already Exists] Affiliate profile for user_id={user_obj.id} ({email})")
                records_skipped["affiliate_profiles"] += 1
            else:
                # Check code uniqueness
                if code:
                    code_exists = session.query(AffiliateProfile).filter(AffiliateProfile.referral_code == code).first()
                    if code_exists:
                        code = f"AFF{user_obj.id:04d}"

                created_at = parse_iso_datetime(data.get("createdAt") or data.get("created_at"))
                new_aff = AffiliateProfile(
                    user_id=user_obj.id,
                    referral_code=code or f"AFF{user_obj.id:04d}",
                    commission_rate=float(data.get("commissionRate") or 20.0),
                    total_earnings=float(data.get("totalCommission") or 0.0),
                    total_clicks=int(data.get("totalClicks") or 0),
                    total_sales=int(data.get("totalConversions") or 0),
                    display_name=data.get("fullName") or user_obj.name,
                    status=data.get("status", "active"),
                    is_active=True,
                    created_at=created_at
                )
                session.add(new_aff)
                session.flush()
                print(f"  [Restored Affiliate Profile] ID #{new_aff.id}: user_id={user_obj.id}, code={new_aff.referral_code}, email={email}")
                records_migrated["affiliate_profiles"] += 1

        session.commit()
        print("\n" + "=" * 100)
        print("MIGRATION COMPLETED SUCCESSFULLY AND COMMITTED TO RENDER POSTGRESQL!")
        print("=" * 100)
        print("Summary of Records Migrated:")
        for k, v in records_migrated.items():
            print(f"  - {k}: {v} migrated ({records_skipped[k]} skipped/already existing)")

    except Exception as e:
        session.rollback()
        print(f"\n[ERROR] Migration failed and was rolled back: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    migrate_data()
