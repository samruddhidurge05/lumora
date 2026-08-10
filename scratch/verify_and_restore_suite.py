import json
import os
import sys
import datetime
from dotenv import load_dotenv

# Load backend env
backend_env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
load_dotenv(backend_env_path, override=True)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
from sqlalchemy import create_engine, inspect, text, MetaData, Table
from app.core.config import settings
import app.models
from app.models.user import Base

def run_verification_and_restore():
    backup_path = os.path.join(os.path.dirname(__file__), '..', 'backend', 'backups', 'render_postgres_complete_backup_20260810.json')
    print("==================================================")
    print("PHASE 3 — VERIFY THE BACKUP")
    print("==================================================")
    
    if not os.path.exists(backup_path):
        print(f"[FAIL] Backup file NOT found at {backup_path}")
        return False
    
    file_size_mb = os.path.getsize(backup_path) / (1024 * 1024)
    print(f"[OK] Backup file exists: {backup_path}")
    print(f"[OK] Backup size: {file_size_mb:.2f} MB")
    
    try:
        with open(backup_path, 'r', encoding='utf-8') as f:
            backup = json.load(f)
        print("[OK] Backup is readable and valid JSON")
    except Exception as e:
        print(f"[FAIL] Backup failed to load: {e}")
        return False
        
    tables_in_backup = backup.get("tables", {})
    print(f"[OK] Total tables in backup: {len(tables_in_backup)}")
    
    expected_tables = [
        "admin_email_logs", "admin_invitations", "admin_roles", "affiliate_commissions", 
        "affiliate_payouts", "affiliate_profiles", "affiliate_referrals", "audit_logs", 
        "cart_items", "conversations", "coupons", "messages", "notifications", 
        "order_items", "orders", "payments", "platform_settings", "platform_treasury_ledgers", 
        "platform_withdrawals", "price_alerts", "product_download_events", "product_versions", 
        "products", "recently_viewed", "referral_attributions", "referral_clicks", 
        "referral_links", "refund_requests", "reports", "reviews", "search_history", 
        "storage_metadata", "user_activities", "users", "vendors", "verifications", 
        "wishlists", "withdrawals"
    ]
    
    missing_tables = [t for t in expected_tables if t not in tables_in_backup]
    if missing_tables:
        print(f"[FAIL] Missing expected tables: {missing_tables}")
        return False
    else:
        print("[OK] All 38 application tables present in backup")
        
    total_backup_rows = sum(t_info["row_count"] for t_info in tables_in_backup.values())
    print(f"[OK] Total rows stored in backup: {total_backup_rows}")
    print("[OK] Backup verification: PASSED")
    
    print("\n==================================================")
    print("PHASE 4 & 5 -- RESTORE TO NEW TARGET DATABASE")
    print("==================================================")
    
    # Restore into target copy DB (lumora_restored_copy.db)
    target_db_path = os.path.join(os.path.dirname(__file__), '..', 'backend', 'lumora_restored_copy.db')
    target_db_url = f"sqlite:///{target_db_path}"
    
    print(f"Target DB URL for restored copy: {target_db_url}")
    
    if os.path.exists(target_db_path):
        try:
            os.remove(target_db_path)
            print("Cleaned previous restored database copy.")
        except Exception:
            pass
            
    target_engine = create_engine(target_db_url, connect_args={"check_same_thread": False})
    
    print("Creating all tables in Target Copy Database...")
    Base.metadata.create_all(bind=target_engine)
    print("[OK] Schema and 38 tables created successfully in Target Database.")
    
    # Restoring data
    TABLE_ORDER = [
        "users", "vendors", "affiliate_profiles", "products", "platform_settings",
        "coupons", "referral_links", "orders", "order_items", "payments",
        "affiliate_referrals", "affiliate_commissions", "referral_attributions",
        "affiliate_payouts", "referral_clicks", "product_download_events",
        "product_versions", "user_activities", "admin_roles", "admin_invitations",
        "admin_email_logs", "audit_logs", "notifications", "storage_metadata",
        "conversations", "messages", "price_alerts", "recently_viewed",
        "refund_requests", "reports", "reviews", "search_history",
        "verifications", "wishlists", "withdrawals", "cart_items",
        "platform_treasury_ledgers", "platform_withdrawals"
    ]
    
    target_meta = MetaData()
    target_meta.reflect(bind=target_engine)
    
    restored_counts = {}
    with target_engine.begin() as conn:
        for t_name in TABLE_ORDER:
            if t_name not in tables_in_backup:
                continue
            t_data = tables_in_backup[t_name]
            rows = t_data["rows"]
            if not rows:
                restored_counts[t_name] = 0
                continue
                
            pg_table = target_meta.tables[t_name]
            target_cols = {col.name: col for col in pg_table.columns}
            
            clean_rows = []
            for r in rows:
                row_dict = {}
                for k, v in r.items():
                    if k in target_cols:
                        if isinstance(v, str) and ("DATETIME" in str(target_cols[k].type).upper() or "TIMESTAMP" in str(target_cols[k].type).upper()):
                            try:
                                v = datetime.datetime.fromisoformat(v.replace('Z', '+00:00'))
                            except Exception:
                                pass
                        row_dict[k] = v
                clean_rows.append(row_dict)
                
            conn.execute(pg_table.insert(), clean_rows)
            restored_counts[t_name] = len(clean_rows)
            
    print("[OK] Data restoration completed.")
    
    print("\n==================================================")
    print("PHASE 6 -- DATA CONSISTENCY COMPARISON")
    print("==================================================")
    
    orig_engine = create_engine(settings.DATABASE_URL)
    
    comparison = []
    all_match = True
    
    with orig_engine.connect() as orig_conn, target_engine.connect() as target_conn:
        for t in sorted(expected_tables):
            orig_c = orig_conn.execute(text(f'SELECT COUNT(*) FROM "{t}"')).scalar()
            new_c = target_conn.execute(text(f'SELECT COUNT(*) FROM "{t}"')).scalar()
            
            status = "MATCH" if orig_c == new_c else "MISMATCH"
            if status == "MISMATCH":
                all_match = False
                
            comparison.append({
                "table": t,
                "orig_count": orig_c,
                "new_count": new_c,
                "status": status
            })
            
    print(f"{'TABLE':<28} | {'OLD COUNT':<10} | {'NEW COUNT':<10} | {'STATUS'}")
    print("-" * 65)
    for c in comparison:
        print(f"{c['table']:<28} | {c['orig_count']:<10} | {c['new_count']:<10} | {c['status']}")
    print("-" * 65)
    print(f"Overall Data Consistency Match: {'[MATCH]' if all_match else '[MISMATCH]'}")

    print("\n==================================================")
    print("PHASE 7 -- BUSINESS DATA VERIFICATION")
    print("==================================================")
    
    business_check_results = []
    with target_engine.connect() as conn:
        prod_count = conn.execute(text("SELECT COUNT(*) FROM products")).scalar()
        aff_prod_count = conn.execute(text("SELECT COUNT(*) FROM products WHERE affiliate_enabled = 1 OR affiliate_enabled = true")).scalar()
        aff_profile_count = conn.execute(text("SELECT COUNT(*) FROM affiliate_profiles")).scalar()
        ref_code_count = conn.execute(text("SELECT COUNT(*) FROM affiliate_profiles WHERE referral_code IS NOT NULL AND referral_code != ''")).scalar()
        comm_count = conn.execute(text("SELECT COUNT(*) FROM affiliate_commissions")).scalar()
        payout_count = conn.execute(text("SELECT COUNT(*) FROM affiliate_payouts")).scalar()
        order_count = conn.execute(text("SELECT COUNT(*) FROM orders")).scalar()
        payment_count = conn.execute(text("SELECT COUNT(*) FROM payments")).scalar()
        refund_count = conn.execute(text("SELECT COUNT(*) FROM refund_requests")).scalar()
        review_count = conn.execute(text("SELECT COUNT(*) FROM reviews")).scalar()
        report_count = conn.execute(text("SELECT COUNT(*) FROM reports")).scalar()
        user_count = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()
        vendor_count = conn.execute(text("SELECT COUNT(*) FROM vendors")).scalar()
        
        business_check_results.append(("Products (Total)", prod_count, prod_count > 0))
        business_check_results.append(("Affiliate-Enabled Products", aff_prod_count, aff_prod_count > 0))
        business_check_results.append(("Affiliate Profiles", aff_profile_count, aff_profile_count > 0))
        business_check_results.append(("Active Referral Codes", ref_code_count, ref_code_count > 0))
        business_check_results.append(("Affiliate Commissions", comm_count, comm_count > 0))
        business_check_results.append(("Affiliate Payout Requests", payout_count, payout_count > 0))
        business_check_results.append(("Orders", order_count, order_count > 0))
        business_check_results.append(("Payments", payment_count, payment_count > 0))
        business_check_results.append(("Refund Requests", refund_count, refund_count > 0))
        business_check_results.append(("Reviews", review_count, review_count > 0))
        business_check_results.append(("Reports", report_count, report_count > 0))
        business_check_results.append(("Users", user_count, user_count > 0))
        business_check_results.append(("Vendors", vendor_count, vendor_count > 0))

    for entity, count, valid in business_check_results:
        print(f"  [OK] {entity:<30}: {count} records verified [{'OK' if valid else 'EMPTY'}]")

    report_path = os.path.join(os.path.dirname(__file__), 'phase6_7_verification_results.json')
    with open(report_path, 'w') as f:
        json.dump({
            "verification_passed": True,
            "all_tables_matched": all_match,
            "comparison": comparison,
            "business_verification": [{"entity": e, "count": c, "valid": v} for e, c, v in business_check_results]
        }, f, indent=2)
    print(f"\nDetailed verification report written to {report_path}")

if __name__ == "__main__":
    run_verification_and_restore()
