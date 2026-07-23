import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import SessionLocal
from app.models.user import User
from app.models.order import Order
from app.models.affiliate import AffiliateProfile, AffiliateCommission, ReferralLink, ReferralAttribution, AffiliatePayout
from admin.routes.affiliates import (
    get_affiliate_kpis,
    list_affiliates,
    get_customer_attributions,
    get_commissions_ledger,
    get_payout_queue,
    get_product_affiliate_performance,
    get_affiliate_activity_timeline
)
from unittest.mock import MagicMock

def verify_live_affiliate_dashboard():
    db = SessionLocal()
    try:
        admin_mock = MagicMock(id=1, role="admin")
        print("=== 1. DATABASE RECORD COUNTS ===")
        print(f"Users (role='affiliate'): {db.query(User).filter(User.role == 'affiliate').count()}")
        print(f"AffiliateProfile records: {db.query(AffiliateProfile).count()}")
        print(f"ReferralLink records: {db.query(ReferralLink).count()}")
        print(f"ReferralAttribution records: {db.query(ReferralAttribution).count()}")
        print(f"AffiliateCommission records: {db.query(AffiliateCommission).count()}")
        print(f"AffiliatePayout records: {db.query(AffiliatePayout).count()}")
        print(f"Orders (total): {db.query(Order).count()}")
        print(f"Orders (with affiliate_id or referral_code_used): {db.query(Order).filter((Order.affiliate_id.isnot(None)) | (Order.referral_code_used.isnot(None))).count()}")

        print("\n=== 2. ENDPOINT INVOCATION RESULTS ===")
        
        print("\n--- GET /api/admin/affiliates/kpis ---")
        kpis = get_affiliate_kpis(db=db, admin_user=admin_mock)
        print("KPIs Response:", kpis)

        print("\n--- GET /api/admin/affiliates/ ---")
        affiliates = list_affiliates(db=db, admin_user=admin_mock)
        print(f"Total Affiliates Listed: {len(affiliates)}")
        if affiliates:
            print("First Affiliate Sample:", affiliates[0])

        print("\n--- GET /api/admin/affiliates/customer-attributions ---")
        cust_attrs = get_customer_attributions(page=1, page_size=50, search=None, db=db, admin_user=admin_mock)
        print(f"Customer Attributions Total: {cust_attrs.get('total')}, Count: {len(cust_attrs.get('items', []))}")
        if cust_attrs.get('items'):
            print("First Customer Attribution Sample:", cust_attrs['items'][0])

        print("\n--- GET /api/admin/affiliates/commissions ---")
        ledger = get_commissions_ledger(page=1, page_size=50, db=db, admin_user=admin_mock)
        print(f"Commissions Ledger Total: {ledger.get('total')}, Count: {len(ledger.get('items', []))}")
        if ledger.get('items'):
            print("First Commission Item Sample:", ledger['items'][0])

        print("\n--- GET /api/admin/affiliates/payouts ---")
        payouts = get_payout_queue(page=1, page_size=50, db=db, admin_user=admin_mock)
        print(f"Payout Queue Total: {payouts.get('total')}, Count: {len(payouts.get('items', []))}")
        if payouts.get('items'):
            print("First Payout Item Sample:", payouts['items'][0])

        print("\n--- GET /api/admin/affiliates/products/performance ---")
        perf = get_product_affiliate_performance(page=1, page_size=50, db=db, admin_user=admin_mock)
        print(f"Product Performance Total: {perf.get('total')}, Count: {len(perf.get('items', []))}")

        print("\n--- GET /api/admin/affiliates/activity ---")
        timeline = get_affiliate_activity_timeline(page=1, page_size=50, db=db, admin_user=admin_mock)
        print(f"Activity Timeline Total: {timeline.get('total')}, Count: {len(timeline.get('items', []))}")

    finally:
        db.close()

if __name__ == "__main__":
    verify_live_affiliate_dashboard()
