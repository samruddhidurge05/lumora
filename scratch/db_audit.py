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

def run_audit():
    db = SessionLocal()
    try:
        bind = db.get_bind()
        print("=== DATABASE AUDIT RESULTS ===")
        print(f"DB Dialect: {bind.dialect.name}")

        # Products table audit
        prod_count = db.execute(text("SELECT COUNT(*) FROM products")).scalar()
        max_id = db.execute(text("SELECT MAX(id) FROM products")).scalar()
        print(f"Products count: {prod_count}")
        print(f"MAX(id) in products: {max_id}")

        if bind.dialect.name == "postgresql":
            seq_name = db.execute(text("SELECT pg_get_serial_sequence('products', 'id')")).scalar()
            if seq_name:
                curr_seq = db.execute(text(f"SELECT last_value, is_called FROM {seq_name}")).fetchone()
                print(f"Sequence name: {seq_name}")
                print(f"Sequence state (last_value, is_called): {curr_seq}")

        # Check for duplicate IDs
        duplicates = db.execute(text("SELECT id, COUNT(*) FROM products GROUP BY id HAVING COUNT(*) > 1")).fetchall()
        print(f"Duplicate IDs in products: {len(duplicates)}")

        # Entity counts across tables
        tables = [
            "users", "orders", "order_items", "payments", "downloads", "reviews", 
            "wishlist", "vendors", "affiliate_profiles", "affiliate_referrals", 
            "referral_links", "referral_clicks", "referral_attributions", 
            "affiliate_commissions", "payouts", "admin_roles", "audit_logs"
        ]
        print("\n=== PORTAL & FINANCIAL DATA COUNTS ===")
        for t in tables:
            try:
                cnt = db.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
                print(f"{t}: {cnt}")
            except Exception as e:
                print(f"{t}: Error - {e}")

    finally:
        db.close()

if __name__ == "__main__":
    run_audit()
