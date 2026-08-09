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
from app.models.product import Product

def test_actual_commit_delete():
    db_url = os.getenv("DATABASE_URL")
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    print("==========================================================")
    print("TESTING REAL POSTGRESQL DELETE TRANSACTION WITH COMMIT")
    print("==========================================================")

    try:
        # Get product with orders
        row = db.execute(text("SELECT DISTINCT product_id FROM order_items LIMIT 1")).fetchone()
        if row:
            pid = row[0]
            print(f"Testing deletion of Product ID {pid} (which HAS order_items)...")
            try:
                # Start transaction
                p = db.query(Product).filter(Product.id == pid).first()
                db.delete(p)
                db.commit()
                print("Commit succeeded! (Wait, was it deleted?)")
            except Exception as e:
                print(f"COMMIT FAILED WITH EXCEPTION:\n  {type(e).__name__}: {e}")
                db.rollback()

    finally:
        db.close()

if __name__ == "__main__":
    test_actual_commit_delete()
