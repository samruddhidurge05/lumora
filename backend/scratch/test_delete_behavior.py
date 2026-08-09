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
from app.models.order import OrderItem

def test_delete_investigation():
    db_url = os.getenv("DATABASE_URL")
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    print("==========================================================")
    print("TESTING PRODUCT DELETION BEHAVIOR IN RENDER POSTGRESQL")
    print("==========================================================")

    try:
        # Check products with orders
        prods_with_orders = db.execute(text(
            "SELECT DISTINCT product_id FROM order_items"
        )).fetchall()
        prod_ids_with_orders = {p[0] for p in prods_with_orders}
        print(f"Products with orders count: {len(prod_ids_with_orders)}")

        # Pick a product WITH orders to test dry-run delete behavior in a nested transaction
        test_id_with_orders = list(prod_ids_with_orders)[0] if prod_ids_with_orders else None
        if test_id_with_orders:
            target = db.query(Product).filter(Product.id == test_id_with_orders).first()
            print(f"\nTest A: Attempting hard delete on Product ID {test_id_with_orders} ('{target.title}') which HAS order_items...")
            nested = db.begin_nested()
            try:
                db.delete(target)
                db.flush()
                print("SUCCESS (unexpected)")
            except Exception as e:
                print(f"EXPECTED FAILURE: {type(e).__name__} - {e}")
            finally:
                nested.rollback()

        # Pick a product WITHOUT orders
        all_prod_ids = {p[0] for p in db.execute(text("SELECT id FROM products")).fetchall()}
        prods_without_orders = list(all_prod_ids - prod_ids_with_orders)
        print(f"\nProducts WITHOUT orders count: {len(prods_without_orders)}")

        if prods_without_orders:
            test_id_no_orders = prods_without_orders[0]
            target_no_orders = db.query(Product).filter(Product.id == test_id_no_orders).first()
            print(f"Sample Product WITHOUT orders: ID {test_id_no_orders} ('{target_no_orders.title}', status='{target_no_orders.status}')")

    finally:
        db.close()

if __name__ == "__main__":
    test_delete_investigation()
