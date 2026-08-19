import sys
import os
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))

env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=str(env_path), override=True)

from app.db.session import SessionLocal
from sqlalchemy import text

def run_table_audit():
    db = SessionLocal()
    try:
        bind = db.get_bind()
        print("=== DATABASE TABLE & SEQUENCE INTEGRITY AUDIT ===")
        print(f"DB Dialect: {bind.dialect.name}")

        # Products analysis
        prod_count = db.execute(text("SELECT COUNT(*) FROM products")).scalar()
        max_id = db.execute(text("SELECT MAX(id) FROM products")).scalar()
        print(f"products COUNT: {prod_count}")
        print(f"products MAX(id): {max_id}")

        if bind.dialect.name == "postgresql":
            seq_name = db.execute(text("SELECT pg_get_serial_sequence('products', 'id')")).scalar()
            print(f"Sequence name for products.id: {seq_name}")
            if seq_name:
                curr_seq = db.execute(text(f"SELECT last_value, is_called FROM {seq_name}")).fetchone()
                print(f"Sequence state (last_value, is_called): {curr_seq}")

        # Check all tables safely
        tables = [
            "users", "vendors", "products", "product_versions", "product_media", 
            "orders", "order_items", "payments", "refund_requests", 
            "affiliate_profiles", "affiliate_referrals", "referral_links", 
            "referral_clicks", "referral_attributions", "affiliate_commissions", "payouts",
            "admin_roles", "admin_invitations", "audit_logs", "notifications",
            "platform_settings", "platform_treasury_ledgers", "reviews", "wishlists",
            "product_download_events", "conversations", "messages", "coupons"
        ]

        print("\n=== COMPLETE TABLE RECORD COUNTS ===")
        for t in tables:
            try:
                cnt = db.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
                print(f"{t}: {cnt}")
            except Exception as e:
                db.rollback()
                print(f"{t}: Exception - {e.args[0] if e.args else e}")

    finally:
        db.close()

if __name__ == "__main__":
    run_table_audit()
