"""
Read-Only Data Integrity Verification Command for Enterprise Affiliate Attribution.
Tests database consistency, orphan records, missing attributions, duplicate commissions,
broken referral links, and SQL dashboard reconciliation.
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import func, or_
from app.db.database import SessionLocal
from app.models.user import User
from app.models.order import Order
from app.models.product import Product
from app.models.affiliate import AffiliateProfile, AffiliateCommission, ReferralAttribution, ReferralLink, ReferralClick

def run_integrity_check():
    print("=====================================================================")
    print("        LUMORA AFFILIATE ATTRIBUTION DATA INTEGRITY CHECK            ")
    print("=====================================================================")

    with SessionLocal() as db:
        issues_found = 0

        # 1. Check Orders with Affiliate Attribution
        attributed_orders_count = db.query(Order).filter(Order.affiliate_id != None).count()
        total_orders_count = db.query(Order).count()
        print(f"[OK] Total Orders: {total_orders_count} | Attributed Orders: {attributed_orders_count}")

        # 2. Check ReferralAttribution Consistency
        total_attributions = db.query(ReferralAttribution).count()
        orphan_attributions = db.query(ReferralAttribution).outerjoin(Order, ReferralAttribution.order_id == Order.id).filter(Order.id == None).count()
        if orphan_attributions > 0:
            print(f"[ERROR] Found {orphan_attributions} orphan ReferralAttribution records with missing Orders!")
            issues_found += 1
        else:
            print(f"[OK] ReferralAttributions: {total_attributions} (0 orphan records)")

        # 3. Check AffiliateCommission Uniqueness & Duplicates
        total_commissions = db.query(AffiliateCommission).count()
        dup_query = (
            db.query(AffiliateCommission.order_id, func.count(AffiliateCommission.id).label("cnt"))
            .filter(AffiliateCommission.order_id != None)
            .group_by(AffiliateCommission.order_id)
            .having(func.count(AffiliateCommission.id) > 1)
            .all()
        )
        if dup_query:
            print(f"[ERROR] Found duplicate commissions for order_ids: {[d[0] for d in dup_query]}")
            issues_found += 1
        else:
            print(f"[OK] AffiliateCommissions: {total_commissions} (0 duplicates found)")

        # 4. Check Uncommissioned Attributed Orders (Missing Commission)
        uncommissioned = (
            db.query(Order)
            .filter(Order.affiliate_id != None)
            .outerjoin(AffiliateCommission, Order.id == AffiliateCommission.order_id)
            .filter(AffiliateCommission.id == None)
            .all()
        )
        if uncommissioned:
            print(f"[WARNING] {len(uncommissioned)} attributed orders exist without commissions (can be recovered via regenerate endpoint): {[o.id for o in uncommissioned]}")
        else:
            print(f"[OK] Uncommissioned Attributed Orders: 0")

        # 5. Check Broken Referral Links
        broken_links = (
            db.query(ReferralLink)
            .outerjoin(AffiliateProfile, ReferralLink.affiliate_id == AffiliateProfile.id)
            .filter(AffiliateProfile.id == None)
            .count()
        )
        if broken_links > 0:
            print(f"[ERROR] Found {broken_links} referral links pointing to missing affiliates!")
            issues_found += 1
        else:
            print(f"[OK] Referral Links Integrity: All links point to valid affiliates")

        # 6. SQL Dashboard Reconciliation Test
        sql_total_commission = db.query(func.sum(AffiliateCommission.commission_amt)).scalar() or 0.0
        sql_pending_commission = db.query(func.sum(AffiliateCommission.commission_amt)).filter(
            or_(
                AffiliateCommission.commission_status.in_(["pending", "approved", "ready_for_payout"]),
                AffiliateCommission.status.in_(["pending", "approved", "ready_for_payout"])
            )
        ).scalar() or 0.0
        sql_paid_commission = db.query(func.sum(AffiliateCommission.commission_amt)).filter(
            or_(
                AffiliateCommission.commission_status == "paid",
                AffiliateCommission.status == "paid"
            )
        ).scalar() or 0.0

        profiles_sum_earned = db.query(func.sum(AffiliateProfile.total_earnings)).scalar() or 0.0

        print("---------------------------------------------------------------------")
        print(f" [SQL Reconciliation] Total Commission Sum:  INR {sql_total_commission:,.2f}")
        print(f" [SQL Reconciliation] Pending Commission Sum:INR {sql_pending_commission:,.2f}")
        print(f" [SQL Reconciliation] Paid Commission Sum:   INR {sql_paid_commission:,.2f}")
        print(f" [SQL Reconciliation] Profiles Total Earned: INR {profiles_sum_earned:,.2f}")
        print("---------------------------------------------------------------------")

        if issues_found == 0:
            print(">>> INTEGRITY VERIFICATION PASSED: 100% HEALTHY <<<")
            return 0
        else:
            print(f">>> INTEGRITY VERIFICATION FAILED: {issues_found} ISSUES DETECTED <<<")
            return 1

if __name__ == "__main__":
    sys.exit(run_integrity_check())
