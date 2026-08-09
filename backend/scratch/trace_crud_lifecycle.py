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
from app.shared.firebase.connection import db as firestore_db, firebase_connected

def trace_full_crud_lifecycle():
    db_url = os.getenv("DATABASE_URL")
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    print("==========================================================")
    print("STEP-BY-STEP PRODUCT CRUD LIFECYCLE FORENSIC TRACE")
    print("==========================================================")

    test_product_id = None
    try:
        # A. CREATE PRODUCT TEST
        print("\n--- A. CREATE PRODUCT TRACE ---")
        new_p = Product(
            title="FORENSIC_TEST_PRODUCT_TEMP_123",
            description="Temporary product created for forensic testing",
            short_desc="Forensic Test Short",
            category="Graphics & UI",
            price=99.0,
            seller="Lumora Official",
            vendor_id="lumora-creator",
            status="published",
            owner_type="PLATFORM",
            is_platform_product=True
        )
        db.add(new_p)
        db.commit()
        db.refresh(new_p)
        test_product_id = new_p.id
        print(f"Created Product ID {test_product_id}: '{new_p.title}' in PostgreSQL")

        # Verify in DB
        found_in_db = db.query(Product).filter(Product.id == test_product_id).first()
        print(f"PostgreSQL Readback: Found ID {found_in_db.id} (title='{found_in_db.title}', status='{found_in_db.status}')")

        # B. EDIT PRODUCT TEST
        print("\n--- B. EDIT PRODUCT TRACE ---")
        found_in_db.title = "FORENSIC_TEST_PRODUCT_UPDATED_456"
        found_in_db.price = 149.0
        db.commit()
        db.refresh(found_in_db)
        print(f"Updated Product ID {test_product_id}: Title='{found_in_db.title}', Price={found_in_db.price}")

        # C. DELETE PRODUCT TRACE
        print("\n--- C. DELETE PRODUCT TRACE ---")
        db.delete(found_in_db)
        db.commit()
        print(f"Executed db.delete(Product ID {test_product_id}) and committed to PostgreSQL.")

        # Readback after delete
        after_delete = db.query(Product).filter(Product.id == test_product_id).first()
        print(f"PostgreSQL Readback after delete: {after_delete}")

    except Exception as e:
        db.rollback()
        print(f"CRUD Trace Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    trace_full_crud_lifecycle()
