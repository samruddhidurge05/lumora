import sys
import os

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)

from app.db.database import engine
from app.models.user import Base
import app.models # ensure all models are imported so they are registered in metadata
import sqlite3

def fix_schema():
    db_path = os.path.join(project_root, "test.db")
    print(f"Connecting to SQLite database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Drop price_alerts
        print("Dropping price_alerts table...")
        cursor.execute("DROP TABLE IF EXISTS price_alerts;")
        
        # Drop recently_viewed
        print("Dropping recently_viewed table...")
        cursor.execute("DROP TABLE IF EXISTS recently_viewed;")
        
        conn.commit()
        print("Dropped tables successfully.")
    except Exception as e:
        print(f"Error dropping tables: {e}")
    finally:
        conn.close()

    # Recreate tables using SQLAlchemy
    print("Recreating tables via SQLAlchemy...")
    Base.metadata.create_all(bind=engine)
    print("Done!")

if __name__ == "__main__":
    fix_schema()
