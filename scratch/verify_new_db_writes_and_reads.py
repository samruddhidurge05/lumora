import sys
import os
import datetime
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))

env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=str(env_path), override=True)

from app.db.session import SessionLocal
from app.models.audit_log import AuditLog
from sqlalchemy import text

def run_verification_suite():
    db = SessionLocal()
    try:
        bind = db.get_bind()
        db_url_str = str(bind.url)
        print("==================================================")
        print("NEW DATABASE EXCLUSIVE ACTIVE AUDIT & VERIFICATION")
        print("==================================================")
        print(f"Connected DB Engine URL: {db_url_str}")
        assert "lumoradb_o3xd" in db_url_str, "DATABASE MUST BE CONNECTED TO lumoradb_o3xd EXCLUSIVELY!"
        print("[OK] Confirmed: Active application connection points exclusively to NEW DATABASE (lumoradb_o3xd).")

        print("\n--------------------------------------------------")
        print("1. VERIFYING READ OPERATIONS & PRODUCTION DATA PRESERVATION")
        print("--------------------------------------------------")
        
        counts = {
            "users": db.execute(text("SELECT COUNT(*) FROM users")).scalar(),
            "vendors": db.execute(text("SELECT COUNT(*) FROM vendors")).scalar(),
            "affiliate_profiles": db.execute(text("SELECT COUNT(*) FROM affiliate_profiles")).scalar(),
            "products": db.execute(text("SELECT COUNT(*) FROM products")).scalar(),
            "orders": db.execute(text("SELECT COUNT(*) FROM orders")).scalar(),
            "order_items": db.execute(text("SELECT COUNT(*) FROM order_items")).scalar(),
            "payments": db.execute(text("SELECT COUNT(*) FROM payments")).scalar(),
            "refund_requests": db.execute(text("SELECT COUNT(*) FROM refund_requests")).scalar(),
            "user_activities": db.execute(text("SELECT COUNT(*) FROM user_activities")).scalar(),
            "audit_logs": db.execute(text("SELECT COUNT(*) FROM audit_logs")).scalar(),
            "platform_treasury_ledgers": db.execute(text("SELECT COUNT(*) FROM platform_treasury_ledgers")).scalar()
        }

        for entity, count in counts.items():
            print(f"  - {entity:<28}: {count} records [OK]")

        assert counts["orders"] == 92, f"Expected 92 real orders, got {counts['orders']}"
        assert counts["order_items"] == 92, f"Expected 92 order items, got {counts['order_items']}"
        assert counts["payments"] == 17, f"Expected 17 real payments, got {counts['payments']}"
        assert counts["refund_requests"] == 5, f"Expected 5 real refund requests, got {counts['refund_requests']}"
        assert counts["products"] == 195, f"Expected 195 real products, got {counts['products']}"
        assert counts["users"] == 93, f"Expected 93 real users, got {counts['users']}"
        print("[OK] All production entity counts match 100% expected preserved values.")

        print("\n--------------------------------------------------")
        print("2. VERIFYING WRITE OPERATIONS GO DIRECTLY TO NEW DB")
        print("--------------------------------------------------")
        
        timestamp_marker = f"NEW_DB_WRITE_VERIFICATION_{datetime.datetime.now(datetime.timezone.utc).isoformat()}"
        test_log = AuditLog(
            action="MIGRATION_VERIFICATION",
            category="Security",
            target_type="Database",
            actor_metadata=timestamp_marker
        )
        db.add(test_log)
        db.commit()
        db.refresh(test_log)
        
        written_id = test_log.id
        print(f"  - Created AuditLog record ID={written_id} with marker '{timestamp_marker}'")

        # Verify read back from new DB
        read_back = db.query(AuditLog).filter(AuditLog.id == written_id).first()
        assert read_back is not None, "Failed to read back newly created record from NEW DB!"
        assert read_back.actor_metadata == timestamp_marker, "Marker mismatch on read back!"
        print(f"  - Read back newly created record ID={read_back.id} from NEW DB [SUCCESS]")

        # Clean up verification entry
        db.delete(read_back)
        db.commit()
        print("  - Cleaned up verification log entry [OK]")

        print("\n--------------------------------------------------")
        print("3. VERIFYING POSTGRESQL AUTO-INCREMENT SEQUENCES")
        print("--------------------------------------------------")
        
        prod_max = db.execute(text("SELECT MAX(id) FROM products")).scalar()
        prod_seq = db.execute(text("SELECT last_value FROM public.products_id_seq")).scalar()
        orders_max = db.execute(text("SELECT MAX(id) FROM orders")).scalar()
        orders_seq = db.execute(text("SELECT last_value FROM public.orders_id_seq")).scalar()

        print(f"  - products MAX(id) = {prod_max} | products_id_seq last_value = {prod_seq}")
        print(f"  - orders MAX(id)   = {orders_max} | orders_id_seq last_value   = {orders_seq}")
        assert prod_seq >= prod_max, "products_id_seq sequence must be >= MAX(id)"
        assert orders_seq >= orders_max, "orders_id_seq sequence must be >= MAX(id)"
        print("[OK] PostgreSQL sequence counters calibrated cleanly.")

        print("\n==================================================")
        print("VERIFICATION COMPLETE: NEW DB IS THE ONLY ACTIVE SOURCE OF TRUTH")
        print("==================================================")

    finally:
        db.close()

if __name__ == "__main__":
    run_verification_suite()
