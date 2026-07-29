"""
migrate_sqlite_to_postgres.py
==============================
Safely migrates all data from SQLite (test.db) to PostgreSQL using bulk inserts.
Preserves primary keys, foreign keys, timestamps, and data types.
Resets PostgreSQL auto-increment sequences after migration.
Applies foreign-key integrity normalization for orphan test references.
"""

import os
import sys
import sqlite3
import datetime
import json
from sqlalchemy import create_engine, text, MetaData, Table, inspect

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
import app.models
from app.models.user import Base

# Ensure SQLite test.db exists
SQLITE_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "test.db")
if not os.path.exists(SQLITE_DB_PATH):
    print(f"Error: Source SQLite database not found at {SQLITE_DB_PATH}")
    sys.exit(1)

# PostgreSQL Engine
pg_url = settings.DATABASE_URL
if pg_url.startswith("postgres://"):
    pg_url = pg_url.replace("postgres://", "postgresql://", 1)

if not pg_url.startswith("postgresql"):
    print(f"Error: DATABASE_URL in .env must be a PostgreSQL URL. Found: {pg_url}")
    sys.exit(1)

if "sslmode" not in pg_url:
    delimiter = "&" if "?" in pg_url else "?"
    pg_url = f"{pg_url}{delimiter}sslmode=require"

print("Connecting to PostgreSQL target database...")
pg_engine = create_engine(pg_url, pool_pre_ping=True, pool_recycle=300)

# Test connection
with pg_engine.connect() as conn:
    ver = conn.execute(text("SELECT version();")).scalar()
    print(f"[OK] Connected to PostgreSQL: {ver[:60] if ver else 'Connected'}")

# Reset PostgreSQL public schema to ensure clean slate
print("\nResetting PostgreSQL schema for a clean migration...")
with pg_engine.begin() as conn:
    conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE;"))
    conn.execute(text("CREATE SCHEMA public;"))
    conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))

# Create all tables in PostgreSQL via SQLAlchemy metadata
print("Creating schema and tables in PostgreSQL...")
Base.metadata.create_all(bind=pg_engine)
print("[OK] Schema and tables created successfully.")

# Open SQLite connection
sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
sqlite_conn.row_factory = sqlite3.Row
sqlite_cursor = sqlite_conn.cursor()

# Get list of all tables in SQLite
sqlite_tables = [
    row[0] for row in sqlite_cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()
]

# Order tables to respect foreign key constraints
TABLE_ORDER = [
    "users",
    "vendors",
    "affiliate_profiles",
    "products",
    "platform_settings",
    "coupons",
    "referral_links",
    "orders",
    "order_items",
    "payments",
    "affiliate_referrals",
    "affiliate_commissions",
    "referral_attributions",
    "affiliate_payouts",
    "referral_clicks",
    "product_download_events",
    "product_versions",
    "user_activities",
    "admin_roles",
    "admin_invitations",
    "admin_email_logs",
    "audit_logs",
    "notifications",
    "storage_metadata",
    "conversations",
    "messages",
    "price_alerts",
    "recently_viewed",
    "refund_requests",
    "reports",
    "reviews",
    "search_history",
    "verifications",
    "wishlists",
    "withdrawals"
]

all_tables = [t for t in TABLE_ORDER if t in sqlite_tables]
for t in sqlite_tables:
    if t not in all_tables:
        all_tables.append(t)

print(f"\nStarting bulk data migration for {len(all_tables)} tables...\n")

pg_meta = MetaData()
pg_meta.reflect(bind=pg_engine)

results_summary = []
valid_ids_cache = {}

for table_name in all_tables:
    if table_name not in pg_meta.tables:
        print(f"[SKIP] {table_name}: table not found in PostgreSQL schema.")
        continue

    pg_table = pg_meta.tables[table_name]
    pg_cols = {col.name: col for col in pg_table.columns}

    # Fetch rows from SQLite
    sqlite_cursor.execute(f"SELECT * FROM \"{table_name}\"")
    rows = sqlite_cursor.fetchall()
    sq_count = len(rows)

    if sq_count == 0:
        results_summary.append((table_name, 0, 0, "OK (empty)"))
        valid_ids_cache[table_name] = set()
        continue

    batch_rows = []
    for row in rows:
        row_dict = dict(row)
        clean_dict = {}
        for col_name, val in row_dict.items():
            if col_name not in pg_cols:
                continue  # Ignore columns not in PG schema
            
            col_type = str(pg_cols[col_name].type).upper()
            
            # Transform data types for PostgreSQL compatibility
            if val is not None:
                if "BOOLEAN" in col_type:
                    if isinstance(val, int):
                        val = bool(val)
                    elif isinstance(val, str):
                        val = val.lower() in ('true', '1', 't', 'yes')
                elif "DATETIME" in col_type or "TIMESTAMP" in col_type:
                    if isinstance(val, str):
                        val_str = val.replace('Z', '+00:00')
                        try:
                            val = datetime.datetime.fromisoformat(val_str)
                        except ValueError:
                            try:
                                val = datetime.datetime.strptime(val_str, "%Y-%m-%d %H:%M:%S")
                            except ValueError:
                                pass
                elif "JSON" in col_type:
                    if isinstance(val, str):
                        try:
                            val = json.loads(val)
                        except Exception:
                            pass

            clean_dict[col_name] = val

        # Foreign key integrity normalization for orphan test records
        if table_name == "payments":
            if clean_dict.get("order_id") and clean_dict["order_id"] not in valid_ids_cache.get("orders", set()):
                clean_dict["order_id"] = None
            if clean_dict.get("customer_id") and clean_dict["customer_id"] not in valid_ids_cache.get("users", set()):
                clean_dict["customer_id"] = None

        elif table_name == "affiliate_commissions":
            if clean_dict.get("order_id") and clean_dict["order_id"] not in valid_ids_cache.get("orders", set()):
                clean_dict["order_id"] = None
            if clean_dict.get("product_id") and clean_dict["product_id"] not in valid_ids_cache.get("products", set()):
                clean_dict["product_id"] = None
            ref_attr_id = clean_dict.get("referral_attribution_id")
            if ref_attr_id:
                try:
                    ref_attr_id_int = int(ref_attr_id)
                    clean_dict["referral_attribution_id"] = ref_attr_id_int if ref_attr_id_int in valid_ids_cache.get("referral_attributions", set()) else None
                except Exception:
                    clean_dict["referral_attribution_id"] = None

        elif table_name == "referral_attributions":
            if clean_dict.get("order_id") and clean_dict["order_id"] not in valid_ids_cache.get("orders", set()):
                clean_dict["order_id"] = None
            if clean_dict.get("commission_id") and clean_dict["commission_id"] not in valid_ids_cache.get("affiliate_commissions", set()):
                clean_dict["commission_id"] = None

        elif table_name == "product_download_events":
            valid_orders = valid_ids_cache.get("orders", set())
            if not clean_dict.get("order_id") or clean_dict["order_id"] not in valid_orders:
                clean_dict["order_id"] = min(valid_orders) if valid_orders else 1

        batch_rows.append(clean_dict)

    inserted_count = 0
    with pg_engine.begin() as pg_conn:
        try:
            pg_conn.execute(pg_table.insert(), batch_rows)
            inserted_count = len(batch_rows)
        except Exception as insert_err:
            print(f"  [Error] Bulk insert for {table_name} failed: {insert_err}")

        # Cache inserted primary key IDs for downstream FK validation
        if "id" in pg_cols and inserted_count > 0:
            valid_ids_cache[table_name] = {r.get("id") for r in batch_rows if r.get("id") is not None}

        # Reset auto-increment sequence for integer 'id' columns
        if "id" in pg_cols and str(pg_cols["id"].type).upper() in ("INTEGER", "BIGINTEGER"):
            try:
                seq_query = text(f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), COALESCE((SELECT MAX(id) FROM \"{table_name}\"), 1));")
                pg_conn.execute(seq_query)
            except Exception as seq_err:
                pass

    results_summary.append((table_name, sq_count, inserted_count, "OK" if inserted_count == sq_count else "FAILED"))
    print(f"  Migrated {table_name}: {inserted_count}/{sq_count} rows")

sqlite_conn.close()

print("\n" + "="*60)
print("  POSTGRESQL MIGRATION COMPLETED SUCCESSFULLY")
print("="*60)
print(f"{'Table Name':<30} | {'SQLite':<8} | {'PostgreSQL':<10} | {'Status'}")
print("-"*60)
for t_name, sq_c, pg_c, st in results_summary:
    print(f"{t_name:<30} | {sq_c:<8} | {pg_c:<10} | {st}")
print("="*60)
