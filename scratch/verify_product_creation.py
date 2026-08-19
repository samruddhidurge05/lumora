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
from app.models.product import Product
from app.models.user import User
from app.api.products_router import create_product, ProductCreate
from sqlalchemy import text

def test_product_creation_verification() -> None:
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.role == "admin").first()
        assert admin_user is not None, "Admin user must exist"

        print("="*70)
        print("EXPLICIT VERIFICATION OF PRODUCT CREATION WORKFLOW")
        print("="*70)

        count_before = db.query(Product).count()
        max_id_before = cast(int, db.execute(text("SELECT MAX(id) FROM products")).scalar() or 0)
        print(f"Products count BEFORE: {count_before}")
        print(f"MAX(id) BEFORE: {max_id_before}")

        prod_payload_1 = ProductCreate(
            title="Test Automated Verification Node 1",
            price=199.00,
            category="Graphics & UI",
            description="Verification test for product sequence auto-increment.",
            seller="System Admin",
            status="published"
        )

        res_1 = create_product(
            product_in=prod_payload_1,
            db=db,
            current_user=admin_user,
            _active=True
        )

        prod_id_1 = cast(int, res_1.id)
        expected_id_1 = max_id_before + 1
        print(f"\n[TEST A] Product 1 Created Successfully!")
        print(f"   Generated Product ID: {prod_id_1} (Expected: {expected_id_1})")
        assert prod_id_1 > max_id_before, f"Generated ID {prod_id_1} should be > previous MAX {max_id_before}"

        prod_payload_2 = ProductCreate(
            title="Test Automated Verification Node 2",
            price=299.00,
            category="3D Artifacts",
            description="Second verification test to confirm consecutive unique ID allocation.",
            seller="System Admin",
            status="published"
        )

        res_2 = create_product(
            product_in=prod_payload_2,
            db=db,
            current_user=admin_user,
            _active=True
        )

        prod_id_2 = cast(int, res_2.id)
        expected_id_2 = prod_id_1 + 1
        print(f"\n[TEST B] Product 2 Created Successfully!")
        print(f"   Generated Product ID: {prod_id_2} (Expected: {expected_id_2})")
        assert prod_id_2 == expected_id_2, f"Generated ID {prod_id_2} should be consecutive after {prod_id_1}"

        count_after = db.query(Product).count()
        max_id_after = cast(int, db.execute(text("SELECT MAX(id) FROM products")).scalar() or 0)
        print("\n" + "-"*70)
        print(f"Products count AFTER: {count_after} (+{count_after - count_before})")
        print(f"MAX(id) AFTER: {max_id_after}")
        print("="*70)

        db.query(Product).filter(Product.id.in_([prod_id_1, prod_id_2])).delete(synchronize_session=False)
        db.commit()

        db.execute(text("SELECT setval('products_id_seq', (SELECT MAX(id) FROM products))"))
        db.commit()

        final_max = cast(int, db.execute(text("SELECT MAX(id) FROM products")).scalar() or 0)
        final_seq = cast(int, db.execute(text("SELECT last_value FROM products_id_seq")).scalar() or 0)
        print(f"Post-test cleanup complete. MAX(id): {final_max}, Sequence last_value: {final_seq}")

        print("ALL VERIFICATION CHECKS PASSED WITH 0 ERRORS!")

    finally:
        db.close()

if __name__ == "__main__":
    test_product_creation_verification()
