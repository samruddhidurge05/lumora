import sys
import os
import datetime
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))

OLD_DB_URL = "postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni?sslmode=require"
NEW_DB_URL = "postgresql://lumoradb_user:fY8L9it8jnhUXADJVfT5snkdPg2vu105@dpg-d9svagv40ujc73dvo4ag-a.oregon-postgres.render.com/lumoradb_o3xd?sslmode=require"

from sqlalchemy import create_engine, inspect, text, MetaData
from app.models import Base

def debug_insert():
    src_eng = create_engine(OLD_DB_URL, pool_pre_ping=True)
    tgt_eng = create_engine(NEW_DB_URL, pool_pre_ping=True)

    Base.metadata.create_all(bind=tgt_eng)

    tgt_meta = MetaData()
    tgt_meta.reflect(bind=tgt_eng)

    tables = ["users", "vendors", "affiliate_profiles", "products", "orders", "order_items", "payments", "refund_requests"]

    for t_name in tables:
        try:
            with src_eng.connect() as src_conn:
                rows = [dict(r._mapping) for r in src_conn.execute(text(f'SELECT * FROM "{t_name}"')).fetchall()]
            print(f"Restoring {t_name} ({len(rows)} rows)...")
            pg_table = tgt_meta.tables[t_name]
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

            with tgt_eng.begin() as conn:
                conn.execute(text(f'DELETE FROM "{t_name}" CASCADE'))
                if clean_rows:
                    conn.execute(pg_table.insert(), clean_rows)
            print(f"  [SUCCESS] {t_name}: Restored {len(clean_rows)} rows")

        except Exception as e:
            print(f"  [FAILED] {t_name}: {e}")

if __name__ == "__main__":
    debug_insert()
