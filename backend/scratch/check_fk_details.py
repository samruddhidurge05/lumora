import os
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

env_file = backend_dir / ".env"
if env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=str(env_file), override=True)

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

def check_fk_details():
    db_url = os.getenv("DATABASE_URL")
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        # Query postgres foreign keys on order_items
        query = text("""
            SELECT
                tc.constraint_name, 
                kcu.column_name, 
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                rc.delete_rule
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.referential_constraints AS rc
                  ON tc.constraint_name = rc.constraint_name
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.table_name='order_items';
        """)
        fks = db.execute(query).fetchall()
        print("Foreign Keys on order_items in Render PostgreSQL:")
        for row in fks:
            print(f"  - Constraint: {row[0]}, Column: {row[1]} -> Foreign Table: {row[2]}.{row[3]}, OnDelete: {row[4]}")

    finally:
        db.close()

if __name__ == "__main__":
    check_fk_details()
