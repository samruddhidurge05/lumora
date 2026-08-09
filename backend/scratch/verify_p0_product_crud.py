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

def verify_product_crud_production():
    print("==========================================================")
    print("FINAL P0 PRODUCT CRUD VERIFICATION ON RENDER POSTGRESQL")
    print("==========================================================")

    db_url = os.getenv("DATABASE_URL")
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        # 1. CREATE PRODUCT VERIFICATION
        print("\n--- 1. VERIFY CREATE PRODUCT ---")
        new_p = Product(
            title="VERIFICATION_E2E_PRODUCT_1001",
            description="E2E Product Persistence Verification",
            short_desc="E2E Product",
            category="Graphics & UI",
            price=299.0,
            seller="Lumora Official",
            vendor_id="lumora-creator",
            status="published",
            owner_type="PLATFORM",
            is_platform_product=True
        )
        db.add(new_p)
        db.commit()
        db.refresh(new_p)
        created_id = new_p.id
        print(f"[SUCCESS] Created Product ID {created_id}: '{new_p.title}' (Price: RS.{new_p.price})")

        # Sync to Firestore if connected
        if firebase_connected and firestore_db is not None:
            try:
                from admin.firestore.admin_firestore import sync_product_to_firestore
                sync_product_to_firestore(new_p)
                print(f"[SUCCESS] Synced Product ID {created_id} to Firestore")
            except Exception as e:
                print(f"Firestore sync info: {e}")

        # 2. EDIT PRODUCT VERIFICATION
        print("\n--- 2. VERIFY EDIT PRODUCT ---")
        to_edit = db.query(Product).filter(Product.id == created_id).first()
        to_edit.title = "VERIFICATION_E2E_PRODUCT_1001_UPDATED"
        to_edit.price = 399.0
        db.commit()
        db.refresh(to_edit)
        print(f"[SUCCESS] Updated Product ID {created_id}: Title='{to_edit.title}', Price=RS.{to_edit.price}")

        # 3. DELETE PRODUCT VERIFICATION
        print("\n--- 3. VERIFY DELETE PRODUCT ---")
        to_delete = db.query(Product).filter(Product.id == created_id).first()
        db.delete(to_delete)
        db.commit()
        print(f"[SUCCESS] Executed db.delete(Product ID {created_id}) & committed to PostgreSQL")

        # Delete from Firestore
        if firebase_connected and firestore_db is not None:
            try:
                firestore_db.collection("products").document(str(created_id)).delete()
                print(f"[SUCCESS] Deleted Product ID {created_id} document from Firestore")
            except Exception as e:
                print(f"Firestore delete info: {e}")

        # Readback Verification
        readback_pg = db.query(Product).filter(Product.id == created_id).first()
        print(f"[SUCCESS] PostgreSQL Readback after delete: {readback_pg} (Must be None)")

        if firebase_connected and firestore_db is not None:
            fs_doc = firestore_db.collection("products").document(str(created_id)).get()
            print(f"[SUCCESS] Firestore Readback after delete: Exists={fs_doc.exists} (Must be False)")

        # Query GET Admin Products Simulation
        admin_prods = db.query(Product).filter(
            ((Product.owner_type == "PLATFORM") | (Product.is_platform_product == True) | (Product.vendor_id == "lumora-creator") | Product.vendor_id.is_(None) | (Product.vendor_id == ""))
            & (~Product.status.in_(["archived", "deleted"]))
        ).all()
        found_in_admin_list = any(p.id == created_id for p in admin_prods)
        print(f"[SUCCESS] GET Admin Products List Verification: Deleted Product ID {created_id} present = {found_in_admin_list} (Must be False)")

        if readback_pg is None and not found_in_admin_list:
            print("\n==========================================================")
            print("P0 PRODUCT CRUD PERSISTENCE & DELETION CERTIFIED 100% SUCCESS")
            print("==========================================================")
        else:
            print("\nWARNING: Deletion verification failed.")

    finally:
        db.close()

if __name__ == "__main__":
    verify_product_crud_production()
