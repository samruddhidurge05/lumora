import os
import sys
import json

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

def run_comprehensive_audit():
    print("=" * 120)
    print("READ-ONLY PRODUCTION FORENSIC PARITY AUDIT: FIRESTORE <---> RENDER POSTGRESQL")
    print("=" * 120)

    if not firebase_connected or fdb is None:
        print("CRITICAL: Firestore is not connected! Cannot perform comparison.")
        return

    session = SessionLocal()

    modules_to_check = [
        # (Module Name, PG Model, Firestore Collection Name(s), PK/ID field in PG)
        ("Products", Product, ["products"], "id"),
        ("Orders", Order, ["orders"], "id"),
        ("Payments", Payment, ["payments"], "id"),
        ("Refund Requests", RefundRequest, ["refund_requests", "refunds"], "id"),
        ("Reviews", Review, ["reviews"], "id"),
        ("Reports", SQLReport, ["reports"], "id"),
        ("Customers", User, ["users", "customers"], "id"),
        ("Vendors", Vendor, ["vendors", "vendor_profiles"], "id"),
        ("Affiliates", AffiliateProfile, ["affiliates", "affiliate_profiles"], "id"),
        ("Affiliate Commissions", AffiliateCommission, ["affiliate_commissions", "commissions"], "id"),
        ("Affiliate Payouts", AffiliatePayout, ["affiliate_payouts", "payouts"], "id"),
        ("Referral Links", ReferralLink, ["referral_links"], "id"),
        ("Referral Clicks", ReferralClick, ["referral_clicks"], "id"),
        ("Referral Attribution / Campaigns", AffiliateReferral, ["affiliate_referrals", "campaigns"], "id"),
        ("Download Events", ProductDownloadEvent, ["product_download_events", "download_events", "downloads"], "id"),
        ("Audit Logs", AuditLog, ["audit_logs"], "id"),
        ("Admin Invitations", AdminInvitation, ["admin_invitations", "invitations"], "id"),
        ("Platform Settings", PlatformSetting, ["platform_settings", "settings"], "id"),
        ("Support Tickets", None, ["support_tickets", "tickets"], "id"),
        ("Notifications", Notification, ["notifications"], "id"),
        ("Promotions / Coupons", Coupon, ["coupons", "promotions"], "id"),
        ("Withdrawals (Vendor)", Withdrawal, ["withdrawals"], "id"),
        ("Withdrawals (Platform)", PlatformWithdrawal, ["platform_withdrawals"], "id"),
        ("Admin Roles", AdminRole, ["admin_roles"], "id"),
    ]

    report_summary = []

    for item in modules_to_check:
        mod_name = item[0]
        pg_model = item[1]
        fs_collections = item[2]

        # 1. Query PostgreSQL count
        pg_count = 0
        pg_samples = []
        if pg_model is not None:
            try:
                if mod_name == "Customers":
                    # Also get role breakdown
                    pg_count = session.query(User).count()
                    cust_cnt = session.query(User).filter(User.role == "customer").count()
                    vend_cnt = session.query(User).filter(User.role == "vendor").count()
                    aff_cnt = session.query(User).filter(User.role == "affiliate").count()
                    admin_cnt = session.query(User).filter(User.role == "admin").count()
                    mod_name_disp = f"Users (All: {pg_count} | Cust: {cust_cnt}, Vend: {vend_cnt}, Aff: {aff_cnt}, Admin: {admin_cnt})"
                else:
                    pg_count = session.query(pg_model).count()
                    mod_name_disp = mod_name

                if pg_count > 0:
                    pg_samples = [str(getattr(r, "id", r)) for r in session.query(pg_model).limit(3).all()]
            except Exception as e:
                mod_name_disp = mod_name
                pg_count = f"Error: {e}"
        else:
            mod_name_disp = mod_name
            pg_count = "N/A (No PG Model)"

        # 2. Query Firestore collection(s) count
        fs_total_docs = 0
        found_fs_col = None
        fs_docs_sample = []

        for col_name in fs_collections:
            try:
                docs = list(fdb.collection(col_name).stream())
                if len(docs) > 0 or found_fs_col is None:
                    if len(docs) > 0:
                        fs_total_docs += len(docs)
                        found_fs_col = col_name
                        fs_docs_sample.extend([d.id for d in docs[:3]])
            except Exception as e:
                pass

        if found_fs_col is None:
            found_fs_col = fs_collections[0]

        # Analysis for migration need
        fs_only = False
        pg_complete = False
        fs_ignoreable = False
        mig_required = False

        if isinstance(pg_count, int):
            if fs_total_docs > 0 and pg_count == 0:
                fs_only = True
                pg_complete = False
                fs_ignoreable = False
                mig_required = True
            elif fs_total_docs > pg_count:
                fs_only = False
                pg_complete = False
                fs_ignoreable = False
                mig_required = True
            elif pg_count >= fs_total_docs:
                fs_only = False
                pg_complete = True
                fs_ignoreable = True
                mig_required = False
            if fs_total_docs == 0 and pg_count == 0:
                fs_only = False
                pg_complete = True
                fs_ignoreable = True
                mig_required = False
        else:
            mig_required = "UNKNOWN"

        report_summary.append({
            "module": mod_name,
            "disp_name": mod_name_disp,
            "fs_collection": found_fs_col,
            "fs_count": fs_total_docs,
            "pg_count": pg_count,
            "fs_only": "YES" if fs_only else "NO",
            "pg_complete": "YES" if pg_complete else "NO",
            "fs_ignoreable": "YES" if fs_ignoreable else "NO",
            "mig_required": "YES" if mig_required else "NO",
            "fs_sample": fs_docs_sample,
            "pg_sample": pg_samples
        })

    session.close()

    print("\n" + "=" * 140)
    print(f"| {'Module':<32} | {'Firestore Col':<22} | {'FS Count':<10} | {'PG Count':<25} | {'FS Only?':<9} | {'PG Comp?':<9} | {'Mig Req?':<9} |")
    print("=" * 140)
    for r in report_summary:
        print(f"| {r['disp_name']:<32} | {r['fs_collection']:<22} | {r['fs_count']:<10} | {str(r['pg_count']):<25} | {r['fs_only']:<9} | {r['pg_complete']:<9} | {r['mig_required']:<9} |")
    print("=" * 140)

    print("\n--- DETAILED FIRESTORE SAMPLES FOR CANDIDATE MIGRATION MODULES ---")
    for r in report_summary:
        if r['mig_required'] == "YES" or r['fs_count'] > 0:
            print(f"\n[Module: {r['module']}] (FS Col: {r['fs_collection']}, FS Count: {r['fs_count']}, PG Count: {r['pg_count']})")
            docs = list(fdb.collection(r['fs_collection']).stream())
            for d in docs:
                data = d.to_dict()
                print(f"  - Doc ID: {d.id} => {data}")

if __name__ == "__main__":
    run_comprehensive_audit()
