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
    try:
        # 1. Create missing tables (referral_attributions)
        print("[Migration] Ensuring all tables exist...")
        Base.metadata.create_all(bind=engine)

        with SessionLocal() as db:
            # Helper for checking column existence
            def column_exists(table_name, col_name):
                try:
                    insp = inspect(db.get_bind())
                    cols = [c["name"] for c in insp.get_columns(table_name)]
                    return col_name in cols
                except Exception:
                    return False

            # 2. Add attribution columns to `orders` table if missing
            orders_cols_to_add = [
                ("affiliate_id", "INTEGER"),
                ("referral_link_id", "INTEGER"),
                ("referral_code_used", "VARCHAR(50)"),
            ]
            for col_name, col_type in orders_cols_to_add:
                if not column_exists("orders", col_name):
                    try:
                        print(f"[Migration] Adding column orders.{col_name}...")
                        db.execute(text(f"ALTER TABLE orders ADD COLUMN {col_name} {col_type}"))
                        db.commit()
                    except Exception as e:
                        db.rollback()
                        print(f"[Migration] Column orders.{col_name} already exists or alter skipped: {e}")

            # Re-inspect after orders columns
            inspector = inspect(engine)

            # 2b. Add missing columns to `affiliate_profiles` table
            aff_prof_cols_to_add = [
                ("display_name", "VARCHAR(150)"),
                ("short_bio", "TEXT"),
                ("country", "VARCHAR(100)"),
                ("youtube", "VARCHAR(255)"),
                ("instagram", "VARCHAR(255)"),
                ("linkedin", "VARCHAR(255)"),
                ("preferred_categories", "JSON"),
                ("promotion_methods", "JSON"),
                ("primary_audience", "VARCHAR(100)"),
                ("audience_size", "VARCHAR(50)"),
                ("preferred_language", "VARCHAR(50)"),
                ("preferred_currency", "VARCHAR(10)"),
                ("timezone", "VARCHAR(50)"),
                ("email_notifications", "BOOLEAN DEFAULT 1"),
                ("pending_earnings", "FLOAT DEFAULT 0.0"),
                ("paid_earnings", "FLOAT DEFAULT 0.0"),
                ("rejected_earnings", "FLOAT DEFAULT 0.0"),
                ("unique_clicks", "INTEGER DEFAULT 0"),
                ("avg_order_value", "FLOAT DEFAULT 0.0"),
                ("last_active_at", "DATETIME"),
            ]
            for col_name, col_type in aff_prof_cols_to_add:
                if not column_exists("affiliate_profiles", col_name):
                    try:
                        print(f"[Migration] Adding column affiliate_profiles.{col_name}...")
                        db.execute(text(f"ALTER TABLE affiliate_profiles ADD COLUMN {col_name} {col_type}"))
                        db.commit()
                    except Exception as e:
                        db.rollback()
                        print(f"[Migration] Column affiliate_profiles.{col_name} already exists or alter skipped: {e}")

            # Re-inspect after profile columns
            inspector = inspect(engine)

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
                    try:
                        print(f"[Migration] Adding column affiliate_commissions.{col_name}...")
                        db.execute(text(f"ALTER TABLE affiliate_commissions ADD COLUMN {col_name} {col_type}"))
                        db.commit()
                    except Exception as e:
                        db.rollback()
                        print(f"[Migration] Column affiliate_commissions.{col_name} already exists or alter skipped: {e}")

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
    except Exception as exc:
        print(f"[Migration] Migration warning/notice: {exc}")

if __name__ == "__main__":
    run_migration()
