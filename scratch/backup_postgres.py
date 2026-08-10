import json
import os
import sys
import datetime
from dotenv import load_dotenv

# Load backend env
backend_env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
load_dotenv(backend_env_path, override=True)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
from sqlalchemy import create_engine, inspect, text
from app.core.config import settings

def custom_serializer(obj):
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    if isinstance(obj, bytes):
        return obj.decode('utf-8', errors='ignore')
    raise TypeError(f"Type {type(obj)} not serializable")

def create_complete_backup():
    db_url = settings.DATABASE_URL
    print(f"[Phase 2] Connecting to Render PostgreSQL: {db_url[:50]}...")
    engine = create_engine(db_url)
    inspector = inspect(engine)
    
    backup_data = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source_db_url": db_url,
        "pg_version": "",
        "tables": {},
        "sequences": {}
    }
    
    with engine.connect() as conn:
        ver = conn.execute(text("SELECT version();")).scalar()
        backup_data["pg_version"] = ver
        
        # Get sequences
        seqs = conn.execute(text("SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public'")).fetchall()
        for s in seqs:
            seq_name = s[0]
            try:
                curr_val = conn.execute(text(f"SELECT last_value FROM {seq_name}")).scalar()
                backup_data["sequences"][seq_name] = curr_val
            except Exception:
                backup_data["sequences"][seq_name] = None

    tables = sorted(inspector.get_table_names())
    print(f"[Phase 2] Found {len(tables)} tables to backup.")
    
    total_rows = 0
    with engine.connect() as conn:
        for t in tables:
            # Columns
            columns = inspector.get_columns(t)
            col_info = [{"name": c["name"], "type": str(c["type"]), "nullable": c["nullable"], "default": str(c["default"]) if c.get("default") else None} for c in columns]
            
            # Constraints & Indexes
            pk = inspector.get_pk_constraint(t).get("constrained_columns", [])
            fks = inspector.get_foreign_keys(t)
            fk_info = [{"constrained_columns": fk["constrained_columns"], "referred_table": fk["referred_table"], "referred_columns": fk["referred_columns"]} for fk in fks]
            indexes = inspector.get_indexes(t)
            idx_info = [{"name": idx["name"], "column_names": idx["column_names"], "unique": idx["unique"]} for idx in indexes]
            
            # Fetch data rows
            res = conn.execute(text(f'SELECT * FROM "{t}"'))
            rows = [dict(row._mapping) for row in res]
            
            backup_data["tables"][t] = {
                "columns": col_info,
                "primary_key": pk,
                "foreign_keys": fk_info,
                "indexes": idx_info,
                "row_count": len(rows),
                "rows": rows
            }
            total_rows += len(rows)
            print(f"  - Dumped {t}: {len(rows)} rows")
            
    backup_dir = os.path.join(os.path.dirname(__file__), '..', 'backend', 'backups')
    os.makedirs(backup_dir, exist_ok=True)
    
    json_path = os.path.join(backup_dir, 'render_postgres_complete_backup_20260810.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(backup_data, f, default=custom_serializer, indent=2)
        
    print(f"\n[Phase 2 Complete] Exported {len(tables)} tables, {total_rows} total rows to:")
    print(f"  {json_path} (Size: {os.path.getsize(json_path) / (1024*1024):.2f} MB)")
    return json_path

if __name__ == "__main__":
    create_complete_backup()
