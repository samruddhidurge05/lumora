import os
import sys

# Ensure backend root is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models import (
    User, Product, Order, Payment, RefundRequest, Review, SQLReport,
    AuditLog, PlatformWithdrawal, AffiliateProfile, AffiliateReferral,
    AffiliateCommission, AdminInvitation, PlatformSetting, ProductDownloadEvent
)

def run_db_audit():
    db: Session = SessionLocal()
    try:
        tables_data = [
            ("Users (Customers/Vendors/Admins)", User, db.query(User).count()),
            ("Products", Product, db.query(Product).count()),
            ("Orders", Order, db.query(Order).count()),
            ("Payments", Payment, db.query(Payment).count()),
            ("Refund Requests", RefundRequest, db.query(RefundRequest).count()),
            ("Reviews", Review, db.query(Review).count()),
            ("Reports (SQLReport)", SQLReport, db.query(SQLReport).count()),
            ("Audit Logs", AuditLog, db.query(AuditLog).count()),
            ("Platform Withdrawals", PlatformWithdrawal, db.query(PlatformWithdrawal).count()),
            ("Affiliate Profiles", AffiliateProfile, db.query(AffiliateProfile).count()),
            ("Affiliate Referrals", AffiliateReferral, db.query(AffiliateReferral).count()),
            ("Affiliate Commissions", AffiliateCommission, db.query(AffiliateCommission).count()),
            ("Admin Invitations", AdminInvitation, db.query(AdminInvitation).count()),
            ("Platform Settings", PlatformSetting, db.query(PlatformSetting).count()),
            ("Product Download Events", ProductDownloadEvent, db.query(ProductDownloadEvent).count()),
        ]

        print("=== DATABASE TABLE ROW COUNTS & ENTITY PARITY ===")
        for name, model, count in tables_data:
            print(f"{name:<35}: {count} rows (Model: {model.__name__}, Table: {model.__tablename__})")

        print("\n=== SPECIFIC QUERY VERIFICATIONS ===")
        # Promoters filter: Affiliates with requested payout / pending earnings
        affiliates_with_payouts = db.query(AffiliateProfile).filter(AffiliateProfile.pending_earnings > 0).count()
        payout_req_count = db.query(PlatformWithdrawal).count()
        print(f"Affiliates with Pending Earnings > 0 : {affiliates_with_payouts}")
        print(f"Total Platform Withdrawals Recorded : {payout_req_count}")

        # Relationship integrity checks
        orders = db.query(Order).all()
        valid_orders = 0
        for o in orders:
            # Verify customer & item link
            cust = db.query(User).filter(User.id == o.user_id).first() if o.user_id else None
            items = o.items
            if cust and len(items) > 0:
                valid_orders += 1
        print(f"Verified Orders with Customer & OrderItems: {valid_orders}/{len(orders)}")

    finally:
        db.close()

if __name__ == "__main__":
    run_db_audit()
