import sys
import os

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)

from app.db.database import SessionLocal
from app.models.price_alert import PriceAlert
from app.models.product import Product
from app.models.user import User

def test_price_alerts():
    db = SessionLocal()
    try:
        # Get first user and first product
        user = db.query(User).first()
        product = db.query(Product).first()

        if not user or not product:
            print("Please seed the database before running tests.")
            return

        print(f"Testing with User ID: {user.id}, Product ID: {product.id}")

        # Check if an alert already exists
        existing = db.query(PriceAlert).filter(
            PriceAlert.user_id == user.id,
            PriceAlert.product_id == product.id
        ).first()

        if existing:
            print(f"Found existing price alert with ID: {existing.id}")
            db.delete(existing)
            db.commit()
            print("Deleted existing price alert for test cleanliness.")

        # Create new price alert
        alert = PriceAlert(
            user_id=user.id,
            product_id=product.id,
            original_price=product.price,
            target_price=product.price * 0.9,
            active=True
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)

        print(f"[SUCCESS] Created Price Alert. ID={alert.id}, UserID={alert.user_id}, ProductID={alert.product_id}, OriginalPrice={alert.original_price}, TargetPrice={alert.target_price}")

        # Query back
        queried = db.query(PriceAlert).filter(PriceAlert.id == alert.id).first()
        assert queried is not None
        assert queried.product_id == product.id
        assert queried.user_id == user.id
        print("[SUCCESS] Successfully queried back from SQLite database without type mismatch.")

        # Clean up
        db.delete(queried)
        db.commit()
        print("Cleaned up database test entry successfully.")

    except Exception as e:
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    test_price_alerts()
