import sys
import os
from typing import cast
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))

env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=str(env_path), override=True)

from app.db.session import SessionLocal
from sqlalchemy import text

def sync_all_sequences() -> None:
    db = SessionLocal()
    try:
        bind = db.get_bind() if hasattr(db, "get_bind") else getattr(db, "bind", None)
        dialect_name = bind.dialect.name if bind and hasattr(bind, "dialect") else "unknown"
        if hasattr(bind, "url"):
            db_url_str = str(bind.url)
        elif hasattr(bind, "engine") and hasattr(bind.engine, "url"):
            db_url_str = str(bind.engine.url)
        else:
            db_url_str = "unknown"
        print(f"Connected DB Dialect: {dialect_name}")
        print(f"Connected DB URL: {db_url_str}")

        if dialect_name != "postgresql":
            print("[SKIP] Dialect is not PostgreSQL. Sequence synchronization not required.")
            return

        seq_tables_query = text("""
            SELECT table_name, column_name, pg_get_serial_sequence(table_name, column_name) as seq_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND column_name = 'id'
              AND pg_get_serial_sequence(table_name, column_name) IS NOT NULL;
        """)
        
        rows = db.execute(seq_tables_query).fetchall()
        print(f"\nFound {len(rows)} PostgreSQL sequences to audit:\n" + "-"*60)

        for row in rows:
            table_name = str(row[0])
            col_name = str(row[1])
            seq_name = str(row[2])
            
            max_id = cast(int, db.execute(text(f'SELECT COALESCE(MAX("{col_name}"), 0) FROM "{table_name}"')).scalar() or 0)
            curr_val = cast(int, db.execute(text(f"SELECT last_value FROM {seq_name}")).scalar() or 0)

            print(f"Table: {table_name:25s} | MAX(id): {max_id:6d} | Sequence Current: {curr_val}")

            if curr_val < max_id:
                sync_sql = text("SELECT setval(:seq, :max_id)")
                db.execute(sync_sql, {"seq": seq_name, "max_id": max_id})
                db.commit()
                
                new_val = db.execute(text(f"SELECT last_value FROM {seq_name}")).scalar()
                print(f"   [FIXED] Updated {seq_name} from {curr_val} -> {new_val}")
            else:
                print(f"   [OK] Sequence is already aligned.")

        prod_max = cast(int, db.execute(text('SELECT MAX(id) FROM products')).scalar() or 0)
        prod_seq_val = cast(int, db.execute(text("SELECT last_value FROM public.products_id_seq")).scalar() or 0)
        print("\n" + "="*60)
        print("PRODUCTS TABLE SYNC VERIFICATION:")
        print(f"  MAX(id): {prod_max}")
        print(f"  Sequence products_id_seq current value: {prod_seq_val}")
        print(f"  Next value that will be generated: {prod_seq_val + 1}")
        print("="*60)

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Sequence synchronization failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    sync_all_sequences()
