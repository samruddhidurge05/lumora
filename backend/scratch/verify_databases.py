import sys
from sqlalchemy import create_engine, text
from contextlib import contextmanager

OLD_DB_URL = "postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni?sslmode=require"
NEW_DB_URL = "postgresql://lumoradb_user:fY8L9it8jnhUXADJVfT5snkdPg2vu105@dpg-d9svagv40ujc73dvo4ag-a.oregon-postgres.render.com/lumoradb_o3xd?sslmode=require"

def get_engine(url):
    return create_engine(url)

def verify_db():
    print("PHASE 1: CONNECTION")
    try:
        old_engine = get_engine(OLD_DB_URL)
        new_engine = get_engine(NEW_DB_URL)
        
        with old_engine.connect() as old_conn, new_engine.connect() as new_conn:
            print("Database connection: PASS")
            
            # PHASE 2: SCHEMA
            old_tables_res = old_conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).fetchall()
            new_tables_res = new_conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).fetchall()
            
            old_tables = sorted([r[0] for r in old_tables_res])
            new_tables = sorted([r[0] for r in new_tables_res])
            
            if old_tables == new_tables:
                print(f"Schema MATCH. Tables: {len(old_tables)}")
            else:
                print("Schema MISMATCH!")
                print(f"Old: {old_tables}")
                print(f"New: {new_tables}")
                return
            
            # PHASE 3: DATA LOSS VERIFICATION
            # We want to verify that every single row from the OLD DB is present in the NEW DB.
            data_loss_detected = False
            for table in old_tables:
                # Get column names to ensure consistent ordering
                cols_res = old_conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='{table}' ORDER BY column_name")).fetchall()
                cols = [c[0] for c in cols_res]
                col_str = ", ".join(cols)
                
                # Fetch all data
                old_data = old_conn.execute(text(f"SELECT {col_str} FROM {table}")).fetchall()
                new_data = new_conn.execute(text(f"SELECT {col_str} FROM {table}")).fetchall()
                
                # Check subset
                missing = 0
                for row in old_data:
                    # direct tuple equality check
                    if row not in new_data:
                        missing += 1
                        
                if missing > 0:
                    data_loss_detected = True
                    print(f"FAIL: Data LOSS in table: {table}. Missing {missing} old rows out of {len(old_data)}!")
                else:
                    print(f"Table {table}: NO LOSS (Old={len(old_data)}, New={len(new_data)})")
            
            if not data_loss_detected:
                print("\nALL OLD DATA IS PRESERVED IN NEW DATABASE!")
                
            # Checking Sequences
            print("\nPHASE 10: SEQUENCES")
            seq_res = old_conn.execute(text("SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public'")).fetchall()
            for (seq,) in seq_res:
                old_val = old_conn.execute(text(f"SELECT last_value FROM {seq}")).scalar()
                new_val = new_conn.execute(text(f"SELECT last_value FROM {seq}")).scalar()
                # print(f"Seq {seq}: Old={old_val}, New={new_val}")
                if old_val is not None and new_val is not None and new_val < old_val:
                    print(f"FAIL: SEQUENCE REGRESSION: {seq} (Old={old_val}, New={new_val})")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_db()
