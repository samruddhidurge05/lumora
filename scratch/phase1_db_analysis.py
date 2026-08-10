import json
import os
import sys
from dotenv import load_dotenv

# Explicitly load backend/.env
backend_env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
load_dotenv(backend_env_path, override=True)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
from sqlalchemy import create_engine, inspect, text
from app.core.config import settings

def analyze_database():
    db_url = settings.DATABASE_URL
    print(f"Analyzing Database URL: {db_url}")
    engine = create_engine(db_url)
    inspector = inspect(engine)
    
    analysis = {}
    
    # 1. Version
    with engine.connect() as conn:
        version_res = conn.execute(text("SELECT version();")).fetchone()
        analysis['pg_version'] = version_res[0] if version_res else 'Unknown'
        
        # Database size
        db_size_res = conn.execute(text("SELECT pg_size_pretty(pg_database_size(current_database()));")).fetchone()
        analysis['db_size'] = db_size_res[0] if db_size_res else 'Unknown'

    # 2. Tables and Row Counts
    tables = inspector.get_table_names()
    analysis['tables'] = {}
    
    with engine.connect() as conn:
        for t in sorted(tables):
            try:
                count_res = conn.execute(text(f'SELECT COUNT(*) FROM "{t}"')).fetchone()
                row_count = count_res[0] if count_res else 0
            except Exception as e:
                row_count = f"Error counting: {e}"
            
            columns = inspector.get_columns(t)
            col_details = [{"name": c["name"], "type": str(c["type"]), "nullable": c["nullable"]} for c in columns]
            
            fks = inspector.get_foreign_keys(t)
            fk_details = [{"constrained_columns": fk["constrained_columns"], "referred_table": fk["referred_table"], "referred_columns": fk["referred_columns"]} for fk in fks]
            
            indexes = inspector.get_indexes(t)
            idx_details = [{"name": idx["name"], "column_names": idx["column_names"], "unique": idx["unique"]} for idx in indexes]
            
            pk = inspector.get_pk_constraint(t)
            pk_details = pk.get("constrained_columns", [])
            
            analysis['tables'][t] = {
                "row_count": row_count,
                "columns_count": len(columns),
                "columns": col_details,
                "primary_key": pk_details,
                "foreign_keys": fk_details,
                "indexes": idx_details
            }
            
    # Sequences
    with engine.connect() as conn:
        seq_res = conn.execute(text("SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public'")).fetchall()
        analysis['sequences'] = [s[0] for s in seq_res]
        
    print("\n--- ANALYSIS COMPLETE ---")
    print(f"PostgreSQL Version: {analysis['pg_version']}")
    print(f"Database Size: {analysis['db_size']}")
    print(f"Total Tables: {len(analysis['tables'])}")
    for t, info in analysis['tables'].items():
        print(f"  - {t}: {info['row_count']} rows, {info['columns_count']} cols, {len(info['foreign_keys'])} FKs, {len(info['indexes'])} indexes")
        
    out_path = os.path.join(os.path.dirname(__file__), "phase1_db_analysis.json")
    with open(out_path, "w") as f:
        json.dump(analysis, f, indent=2)
    print(f"Analysis saved to {out_path}")

if __name__ == "__main__":
    analyze_database()
