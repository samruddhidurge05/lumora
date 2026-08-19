import sys
import os
import datetime
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))

OLD_DB_URL = "postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni?sslmode=require"
NEW_DB_URL = "postgresql://lumoradb_user:fY8L9it8jnhUXADJVfT5snkdPg2vu105@dpg-d9svagv40ujc73dvo4ag-a.oregon-postgres.render.com/lumoradb_o3xd?sslmode=require"

from sqlalchemy import create_engine, inspect, text, MetaData
from app.models import Base

def execute_migration():
    print("==================================================")
    print("MIGRATING ALL PRODUCTION DATA FROM OLD DB -> NEW DB")
    print("==================================================")
    
    source_engine = create_engine(OLD_DB_URL, pool_pre_ping=True)
    target_engine = create_engine(NEW_DB_URL, pool_pre_ping=True)
    
    # 1. Create all model tables in target DB via SQLAlchemy Base metadata
    print("\n1. CREATING SCHEMAS IN NEW DB VIA BASE METADATA...")
    Base.metadata.create_all(bind=target_engine)
    print("[OK] All model tables created in Target DB.")

    # 2. Reflect target tables to get column maps
    target_meta = MetaData()
    target_meta.reflect(bind=target_engine)

    source_inspector = inspect(source_engine)
    source_tables = set(source_inspector.get_table_names())
    target_tables = set(target_meta.tables.keys())

    TABLE_ORDER = [
        "users", "vendors", "affiliate_profiles", "products", "platform_settings",
        "coupons", "referral_links", "orders", "order_items", "payments",
        "refund_requests", "affiliate_referrals", "referral_attributions", 
        "affiliate_commissions", "affiliate_payouts", "referral_clicks", 
        "product_download_events", "product_versions", "user_activities", 
        "admin_roles", "admin_invitations", "admin_email_logs", "audit_logs", 
        "notifications", "storage_metadata", "conversations", "messages", 
        "price_alerts", "recently_viewed", "reports", "reviews", 
        "search_history", "verifications", "wishlists", "withdrawals", 
        "cart_items", "platform_treasury_ledgers", "platform_withdrawals"
    ]

    all_migration_tables = [t for t in TABLE_ORDER if t in source_tables and t in target_tables]
    remaining = [t for t in source_tables if t in target_tables and t not in all_migration_tables]
    all_migration_tables += remaining

    print(f"\n2. COPYING PRODUCTION ROWS FOR {len(all_migration_tables)} TABLES...")

    # Clear target tables in reverse order to respect foreign keys
    with target_engine.begin() as target_conn:
        for t_name in reversed(all_migration_tables):
            try:
                target_conn.execute(text(f'DELETE FROM "{t_name}"'))
            except Exception:
                pass

    valid_user_ids = set()

    with source_engine.connect() as src_conn:
        for t_name in all_migration_tables:
            try:
                res = src_conn.execute(text(f'SELECT * FROM "{t_name}"'))
                rows = [dict(r._mapping) for r in res]
                
                if not rows:
                    print(f"  - {t_name:<28}: 0 rows")
                    continue

                if t_name == "users":
                    valid_user_ids = {r["id"] for r in rows if "id" in r}

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

                    # Skip orphan notification rows referencing non-existent user_ids
                    if t_name == "notifications" and row_dict.get("user_id") not in valid_user_ids:
                        continue

                    clean_rows.append(row_dict)

                with target_engine.begin() as target_conn:
                    for chunk_idx in range(0, len(clean_rows), 500):
                        chunk = clean_rows[chunk_idx:chunk_idx + 500]
                        target_conn.execute(pg_table.insert(), chunk)
                    
                print(f"  - Restored {t_name:<28}: {len(clean_rows)} rows [OK]")

            except Exception as table_err:
                print(f"  - Error restoring {t_name:<25}: {table_err.args[0] if table_err.args else table_err}")

    print("\n3. CALIBRATING POSTGRESQL SEQUENCES IN NEW DB...")
    with target_engine.begin() as target_conn:
        for t_name in all_migration_tables:
            pg_table = target_meta.tables[t_name]
            target_cols = {col.name: col for col in pg_table.columns}
            if "id" in target_cols and str(target_cols["id"].type).upper() in ("INTEGER", "BIGINTEGER"):
                try:
                    seq_res = target_conn.execute(text(f"SELECT pg_get_serial_sequence('{t_name}', 'id');")).scalar()
                    if seq_res:
                        max_id = target_conn.execute(text(f'SELECT COALESCE(MAX(id), 1) FROM "{t_name}"')).scalar()
                        target_conn.execute(text(f"SELECT setval('{seq_res}', {max_id});"))
                        print(f"  - {t_name:<28}: sequence calibrated to {max_id} [OK]")
                except Exception as seq_err:
                    print(f"  - Sequence error on {t_name}: {seq_err}")

    print("\n==================================================")
    print("MIGRATION COMPLETE!")
    print("==================================================")

if __name__ == "__main__":
    execute_migration()
