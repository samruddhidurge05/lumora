import sqlite3
import json
import datetime
from sqlalchemy import create_engine, text, MetaData, Table, inspect
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.config import settings
import app.models

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

pg_table = pg_meta.tables["payments"]
pg_cols = {col.name: col for col in pg_table.columns}

sqlite_cursor.execute("SELECT * FROM payments")
rows = sqlite_cursor.fetchall()
print(f"Total payments rows in SQLite: {len(rows)}")

batch_rows = []
for row in rows:
    row_dict = dict(row)
    clean_dict = {}
    for col_name, val in row_dict.items():
        if col_name not in pg_cols: continue
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
    batch_rows.append(clean_dict)

with pg_engine.begin() as conn:
    try:
        conn.execute(pg_table.insert(), batch_rows)
        print("SUCCESS payments bulk insert!")
    except Exception as e:
        print("ERROR payments bulk insert:", e)

sqlite_conn.close()
