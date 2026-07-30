"""
MIGRATION SCRIPT: Product Ownership Architecture Refactoring
-------------------------------------------------------------
Adds `owner_type`, `created_by_role`, and `is_platform_product` columns to `products` table
if missing, and populates explicit ownership metadata for Platform products vs Vendor products.

Target Platform Product IDs:
  108, 109, 110, 111, 112, 115, 116, 117, 118, 119, 120, 121, 122
  + any products with vendor_id in ('lumora-creator', '', None) or created by admin users.

Idempotent: Safe to run multiple times on SQLite and PostgreSQL.
"""

import sys
import os
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import inspect, text
from app.db.database import engine, SessionLocal
from app.models.product import Product
from app.models.user import User

PLATFORM_PRODUCT_IDS = {108, 109, 110, 111, 112, 115, 116, 117, 118, 119, 120, 121, 122}
PLATFORM_VENDOR_SENTINELS = {'lumora-creator', '', None}

def run_migration():
    print("=" * 70)
    print("STARTING PRODUCT OWNERSHIP ARCHITECTURE MIGRATION")
    print("=" * 70)

    inspector = inspect(engine)
    existing_cols = {col['name'] for col in inspector.get_columns('products')}
    print(f"Existing `products` table columns count: {len(existing_cols)}")

    with engine.begin() as conn:
        # Add missing columns if needed
        if 'owner_type' not in existing_cols:
            print("Adding column `owner_type` (VARCHAR 20)...")
            conn.execute(text("ALTER TABLE products ADD COLUMN owner_type VARCHAR(20) DEFAULT 'VENDOR'"))
        
        if 'created_by_role' not in existing_cols:
            print("Adding column `created_by_role` (VARCHAR 20)...")
            conn.execute(text("ALTER TABLE products ADD COLUMN created_by_role VARCHAR(20) DEFAULT 'VENDOR'"))

        if 'is_platform_product' not in existing_cols:
            print("Adding column `is_platform_product` (BOOLEAN)...")
            is_sqlite = engine.dialect.name == 'sqlite'
            bool_type = "BOOLEAN DEFAULT 0" if is_sqlite else "BOOLEAN DEFAULT FALSE"
            conn.execute(text(f"ALTER TABLE products ADD COLUMN is_platform_product {bool_type}"))

    print("\nColumns verified/added successfully.")

    # Perform Data Migration
    db = SessionLocal()
    try:
        # Fetch all admin user IDs to identify admin-created products
        admin_users = db.query(User).filter(User.role == 'admin').all()
        admin_user_ids = {str(u.id) for u in admin_users}
        if hasattr(User, 'firebase_uid'):
            admin_user_ids.update({u.firebase_uid for u in admin_users if u.firebase_uid})

        print(f"Identified {len(admin_users)} admin user records for ownership matching.")

        products = db.query(Product).all()
        print(f"Total products to evaluate: {len(products)}")

        platform_count = 0
        vendor_count = 0

        for p in products:
            vid = str(p.vendor_id).strip() if p.vendor_id is not None else ""

            is_platform = (
                p.id in PLATFORM_PRODUCT_IDS or
                vid in PLATFORM_VENDOR_SENTINELS or
                vid in admin_user_ids
            )

            if is_platform:
                p.owner_type = "PLATFORM"
                p.created_by_role = "ADMIN"
                p.is_platform_product = True
                platform_count += 1
            else:
                p.owner_type = "VENDOR"
                p.created_by_role = "VENDOR"
                p.is_platform_product = False
                vendor_count += 1

        db.commit()
        print(f"\nMigration Completed Successfully:")
        print(f"  -> Platform Products updated (`owner_type='PLATFORM'`): {platform_count}")
        print(f"  -> Vendor Products updated   (`owner_type='VENDOR'`):   {vendor_count}")

    except Exception as e:
        db.rollback()
        print(f"\nERROR during migration: {e}")
        raise e
    finally:
        db.close()

    print("=" * 70)

if __name__ == "__main__":
    run_migration()
