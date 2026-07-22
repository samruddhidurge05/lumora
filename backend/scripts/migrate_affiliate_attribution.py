"""
Idempotent Database Migration Script for Enterprise Affiliate Attribution & Analytics.
Safe for SQLite and PostgreSQL. Does NOT destroy or alter existing data.
"""

import sys
import os

# Add parent directory to path so imports work when run standalone
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import inspect, text
from app.db.database import engine, SessionLocal
from app.models.user import Base
from app.models.order import Order
from app.models.affiliate import AffiliateProfile, AffiliateCommission, ReferralAttribution, ReferralLink, ReferralClick

def run_migration():
    print("[Migration] Starting safe idempotent database migration for Affiliate Attribution...")
    inspector = inspect(engine)

    # 1. Create missing tables (referral_attributions)
    print("[Migration] Ensuring all tables exist...")
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        # Helper for checking column existence
        def column_exists(table_name, col_name):
            cols = [c["name"] for c in inspector.get_columns(table_name)]
            return col_name in cols

        # 2. Add attribution columns to `orders` table if missing
        orders_cols_to_add = [
            ("affiliate_id", "INTEGER"),
            ("referral_link_id", "INTEGER"),
            ("referral_code_used", "VARCHAR(50)"),
        ]
        for col_name, col_type in orders_cols_to_add:
            if not column_exists("orders", col_name):
                print(f"[Migration] Adding column orders.{col_name}...")
                db.execute(text(f"ALTER TABLE orders ADD COLUMN {col_name} {col_type}"))

        # 3. Add attribution columns to `affiliate_commissions` table if missing
        comm_cols_to_add = [
            ("referral_attribution_id", "INTEGER"),
            ("referral_link_id", "INTEGER"),
            ("device_type", "VARCHAR(50)"),
            ("browser", "VARCHAR(100)"),
            ("ip_address", "VARCHAR(45)"),
            ("referral_url_used", "VARCHAR(500)"),
        ]
        for col_name, col_type in comm_cols_to_add:
            if not column_exists("affiliate_commissions", col_name):
                print(f"[Migration] Adding column affiliate_commissions.{col_name}...")
                db.execute(text(f"ALTER TABLE affiliate_commissions ADD COLUMN {col_name} {col_type}"))

        db.commit()

        # 4. Non-destructive backfill for existing AffiliateCommission records
        print("[Migration] Performing idempotent backfill for existing commission records...")
        existing_commissions = db.query(AffiliateCommission).all()
        backfilled_count = 0

        for comm in existing_commissions:
            if not comm.order_id:
                continue

            # Update Order attribution if missing
            order = db.query(Order).filter(Order.id == comm.order_id).first()
            if order and not order.affiliate_id:
                order.affiliate_id = comm.affiliate_id
                aff = db.query(AffiliateProfile).filter(AffiliateProfile.id == comm.affiliate_id).first()
                if aff:
                    order.referral_code_used = aff.referral_code

            # Check if ReferralAttribution already exists for this order
            existing_attr = db.query(ReferralAttribution).filter(ReferralAttribution.order_id == comm.order_id).first()
            if not existing_attr and order:
                aff = db.query(AffiliateProfile).filter(AffiliateProfile.id == comm.affiliate_id).first()
                code = aff.referral_code if aff else "AFF-UNKNOWN"
                
                attr = ReferralAttribution(
                    order_id=comm.order_id,
                    customer_id=order.user_id,
                    affiliate_id=comm.affiliate_id,
                    affiliate_code=code,
                    product_id=comm.product_id,
                    commission_id=comm.id,
                    status="commissioned",
                    created_at=comm.created_at or order.created_at
                )
                db.add(attr)
                db.flush()
                comm.referral_attribution_id = attr.id
                backfilled_count += 1

        db.commit()
        print(f"[Migration] Successfully backfilled {backfilled_count} ReferralAttribution records.")
        print("[Migration] Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
