import os
import sys
import json

# Ensure UTF-8 output encoding for console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)

from dotenv import load_dotenv
load_dotenv(os.path.join(project_root, ".env"))

from app.db.session import SessionLocal
from app.shared.firebase.connection import db as fdb, firebase_connected
from app.models import (
    Product, Order, Payment, RefundRequest, Review, SQLReport, User,
    Vendor, VendorProfile, AffiliateProfile, AffiliateCommission, AffiliatePayout,
    ReferralLink, ReferralClick, ProductDownloadEvent, AuditLog, AdminInvitation,
    PlatformSetting, Notification, Coupon, Withdrawal, PlatformWithdrawal,
    WishlistItem, CartItem, AdminRole, Verification, UserActivity, RecentlyViewed,
    PriceAlert, SearchHistory, StorageMetadata, AffiliateReferral
)

def is_mock_or_test(record_dict):
    """Check if record is mock/demo/test data"""
    text_repr = json.dumps(record_dict, default=str).lower()
    mock_keywords = ["@example.com", "@lumora.io", "test.db", "sandbox", "dummy", "test user", "mock"]
    return any(kw in text_repr for kw in mock_keywords)

def inspect_all():
    print("=" * 120)
    print("DEEP FORENSIC INSPECTION OF DIFFERENCES & REAL PRODUCTION RECORDS")
    print("=" * 120)

    session = SessionLocal()

    # 1. REVIEWS (FS: 2, PG: 0)
    print("\n" + "="*80)
    print("1. REVIEWS (FS Count: 2, PG Count: 0)")
    print("="*80)
    fs_revs = list(fdb.collection("reviews").stream())
    for d in fs_revs:
        data = d.to_dict()
        print(f"  Firestore Doc [{d.id}]: {data}")

    # 2. REPORTS (FS: 6, PG: 0)
    print("\n" + "="*80)
    print("2. REPORTS (FS Count: 6, PG Count: 0)")
    print("="*80)
    fs_reps = list(fdb.collection("reports").stream())
    for d in fs_reps:
        data = d.to_dict()
        print(f"  Firestore Doc [{d.id}]: {data}")

    # 3. REFUND REQUESTS (FS: 5, PG: 1)
    print("\n" + "="*80)
    print("3. REFUND REQUESTS (FS Count: 5, PG Count: 1)")
    print("="*80)
    pg_refunds = session.query(RefundRequest).all()
    print("  PostgreSQL Refund Requests:")
    for r in pg_refunds:
        print(f"    PG ID #{r.id}: order_id={r.order_id}, user_id={r.user_id}, status={r.status}, reason_category={r.reason_category}, details={r.details}")
    fs_refunds = list(fdb.collection("refund_requests").stream())
    if not fs_refunds:
        fs_refunds = list(fdb.collection("refunds").stream())
    print(f"  Firestore Refund Requests ({len(fs_refunds)} docs):")
    for d in fs_refunds:
        print(f"    FS Doc [{d.id}]: {d.to_dict()}")

    # 4. DOWNLOAD EVENTS (FS: 7, PG: 1)
    print("\n" + "="*80)
    print("4. DOWNLOAD EVENTS (FS Count: 7, PG Count: 1)")
    print("="*80)
    pg_downloads = session.query(ProductDownloadEvent).all()
    print("  PostgreSQL Download Events:")
    for d in pg_downloads:
        print(f"    PG ID #{d.id}: order_id={d.order_id}, user_id={d.user_id}, product_id={d.product_id}, created_at={d.downloaded_at}")
    fs_downloads = list(fdb.collection("downloads").stream())
    print(f"  Firestore Download Events ({len(fs_downloads)} docs):")
    for d in fs_downloads:
        print(f"    FS Doc [{d.id}]: {d.to_dict()}")

    # 5. ORDERS (FS: 81, PG: 78)
    print("\n" + "="*80)
    print("5. ORDERS (FS Count: 81, PG Count: 78)")
    print("="*80)
    pg_order_ids = set(r.id for r in session.query(Order.id).all())
    fs_orders = list(fdb.collection("orders").stream())
    missing_in_pg_orders = []
    for d in fs_orders:
        data = d.to_dict()
        try:
            oid = int(d.id)
        except ValueError:
            oid = data.get("id") or data.get("order_id")
        if isinstance(oid, int) and oid not in pg_order_ids:
            missing_in_pg_orders.append((d.id, data))
        elif isinstance(oid, str) and oid.isdigit() and int(oid) not in pg_order_ids:
            missing_in_pg_orders.append((d.id, data))
        elif not oid:
            missing_in_pg_orders.append((d.id, data))
    print(f"  Orders in FS missing in PG ({len(missing_in_pg_orders)}):")
    for doc_id, odata in missing_in_pg_orders:
        print(f"    FS Doc [{doc_id}]: user_id={odata.get('user_id') or odata.get('userId')}, total={odata.get('total') or odata.get('amount')}, items={odata.get('items')}, created={odata.get('createdAt')}")

    # 6. PRODUCTS (FS: 223, PG: 195)
    print("\n" + "="*80)
    print("6. PRODUCTS (FS Count: 223, PG Count: 195)")
    print("="*80)
    pg_prod_ids = set(p.id for p in session.query(Product.id).all())
    fs_prods = list(fdb.collection("products").stream())
    missing_in_pg_prods = []
    for d in fs_prods:
        data = d.to_dict()
        try:
            pid = int(d.id)
        except ValueError:
            pid = data.get("id") or data.get("product_id")
        if isinstance(pid, int) and pid not in pg_prod_ids:
            missing_in_pg_prods.append((d.id, data))
        elif not pid:
            missing_in_pg_prods.append((d.id, data))
    print(f"  Products in FS missing in PG ({len(missing_in_pg_prods)}):")
    for doc_id, pdata in missing_in_pg_prods[:10]:
        print(f"    FS Doc [{doc_id}]: title={pdata.get('title') or pdata.get('name')}, status={pdata.get('status')}, price={pdata.get('price')}")
    if len(missing_in_pg_prods) > 10:
        print(f"    ... and {len(missing_in_pg_prods)-10} more missing product docs.")

    # 7. USERS / CUSTOMERS (FS: 189, PG: 89)
    print("\n" + "="*80)
    print("7. USERS / CUSTOMERS (FS Count: 189, PG Count: 89)")
    print("="*80)
    pg_emails = set(u.email.lower() for u in session.query(User.email).all() if u.email)
    fs_users = list(fdb.collection("customers").stream())
    if not fs_users:
        fs_users = list(fdb.collection("users").stream())
    missing_in_pg_users = []
    for d in fs_users:
        data = d.to_dict()
        email = (data.get("email") or "").lower().strip()
        if email and email not in pg_emails:
            missing_in_pg_users.append((d.id, data))
    print(f"  Users in FS missing in PG ({len(missing_in_pg_users)}):")
    for doc_id, udata in missing_in_pg_users[:15]:
        print(f"    FS Doc [{doc_id}]: email={udata.get('email')}, role={udata.get('role')}, name={udata.get('name') or udata.get('displayName')}")

    # 8. AFFILIATES (FS: 25, PG: 3)
    print("\n" + "="*80)
    print("8. AFFILIATES (FS Count: 25, PG Count: 3)")
    print("="*80)
    pg_affs = session.query(AffiliateProfile).all()
    print(f"  PostgreSQL Affiliate Profiles ({len(pg_affs)}):")
    for a in pg_affs:
        print(f"    PG ID #{a.id}: user_id={a.user_id}, referral_code={a.referral_code}, is_active={a.is_active}")
    fs_affs = list(fdb.collection("affiliates").stream())
    if not fs_affs:
        fs_affs = list(fdb.collection("affiliate_profiles").stream())
    print(f"  Firestore Affiliate Profiles ({len(fs_affs)}):")
    for d in fs_affs[:10]:
        print(f"    FS Doc [{d.id}]: {d.to_dict()}")

    # 9. NOTIFICATIONS (FS: 25, PG: 13)
    print("\n" + "="*80)
    print("9. NOTIFICATIONS (FS Count: 25, PG Count: 13)")
    print("="*80)
    pg_notifs = session.query(Notification).count()
    fs_notifs = list(fdb.collection("notifications").stream())
    print(f"  PG Notifications Count: {pg_notifs}, FS Notifications Count: {len(fs_notifs)}")

    session.close()

if __name__ == "__main__":
    inspect_all()
