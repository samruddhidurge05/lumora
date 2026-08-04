import os
import sys
import sqlite3
import datetime
import json
from sqlalchemy import create_engine, text, MetaData, Table, inspect

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
import app.models
from app.models.user import Base

SQLITE_DB_PATH = "test.db"
sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
sqlite_conn.row_factory = sqlite3.Row
sqlite_cursor = sqlite_conn.cursor()

pg_url = settings.DATABASE_URL
if pg_url.startswith("postgres://"):
    pg_url = pg_url.replace("postgres://", "postgresql://", 1)
if "sslmode" not in pg_url:
    delimiter = "&" if "?" in pg_url else "?"
    pg_url = f"{pg_url}{delimiter}sslmode=require"

pg_engine = create_engine(pg_url)
pg_meta = MetaData()
pg_meta.reflect(bind=pg_engine)

failed_tables = ["products", "orders", "order_items", "payments", "affiliate_commissions", "referral_attributions", "product_download_events", "user_activities"]

for table_name in failed_tables:
    print(f"\n--- Testing Table: {table_name} ---")
    if table_name not in pg_meta.tables:
        print(f"Table {table_name} not in PG meta!")
        continue
    pg_table = pg_meta.tables[table_name]
    pg_cols = {col.name: col for col in pg_table.columns}

    sqlite_cursor.execute(f"SELECT * FROM \"{table_name}\" LIMIT 1")
    row = sqlite_cursor.fetchone()
    if not row:
        print("Empty table in SQLite")
        continue

    row_dict = dict(row)
    clean_dict = {}
    for col_name, val in row_dict.items():
        if col_name not in pg_cols:
            continue
        col_type = str(pg_cols[col_name].type).upper()
        if val is not None:
            if "BOOLEAN" in col_type:
                if isinstance(val, int): val = bool(val)
                elif isinstance(val, str): val = val.lower() in ('true', '1', 't', 'yes')
            elif "DATETIME" in col_type or "TIMESTAMP" in col_type:
                if isinstance(val, str):
                    val_str = val.replace('Z', '+00:00')
                    try: val = datetime.datetime.fromisoformat(val_str)
                    except ValueError:
                        try: val = datetime.datetime.strptime(val_str, "%Y-%m-%d %H:%M:%S")
                        except ValueError: pass
            elif "JSON" in col_type:
                if isinstance(val, str):
                    try: val = json.loads(val)
                    except Exception: pass
        clean_dict[col_name] = val

    print("Sample record keys:", list(clean_dict.keys()))
    with pg_engine.begin() as conn:
        try:
            conn.execute(pg_table.insert().values(**clean_dict))
            print("SUCCESS single row insert!")
        except Exception as e:
            print("ERROR inserting single row:", e)

sqlite_conn.close()
