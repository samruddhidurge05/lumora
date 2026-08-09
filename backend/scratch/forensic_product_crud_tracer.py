import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# Explicitly load backend/.env FIRST
env_file = backend_dir / ".env"
if env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=str(env_file), override=True)

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from app.models.product import Product
from app.models.order import OrderItem, Order
from app.shared.firebase.connection import db as firestore_db, firebase_connected

def run_product_forensics():
    db_url = os.getenv("DATABASE_URL")
    print("==========================================================")
    print("P0 PRODUCT CRUD FORENSIC INVESTIGATION")
    print("==========================================================")
    print(f"Connecting to Database: {db_url.split('@')[-1] if '@' in db_url else db_url}")
    
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # 1. Database Schema Check
        print("\n--- 1. RENDER POSTGRESQL SCHEMA VERIFICATION ---")
        inspector = inspect(engine)
        product_cols = [c['name'] for c in inspector.get_columns('products')]
        print(f"Products Table Columns ({len(product_cols)}): {product_cols}")
        
        has_is_deleted = 'is_deleted' in product_cols
        has_deleted_at = 'deleted_at' in product_cols
        print(f"Has 'is_deleted' column: {has_is_deleted}")
        print(f"Has 'deleted_at' column: {has_deleted_at}")
        
        # 2. Row Count & Status Distribution in Render PostgreSQL
        print("\n--- 2. RENDER POSTGRESQL ROW COUNT & STATUS BREAKDOWN ---")
        total_products = db.query(Product).count()
        print(f"Total Products in Render PostgreSQL: {total_products}")
        
        statuses = db.execute(text("SELECT status, COUNT(*) FROM products GROUP BY status")).fetchall()
        print("Status distribution in DB:")
        for status_val, count in statuses:
            print(f"  - status = '{status_val}': {count} products")
            
        owner_types = db.execute(text("SELECT owner_type, COUNT(*) FROM products GROUP BY owner_type")).fetchall()
        print("Owner Type distribution in DB:")
        for ot, count in owner_types:
            print(f"  - owner_type = '{ot}': {count} products")
            
        # 3. Foreign Key Constraints & Dependencies
        print("\n--- 3. FOREIGN KEY RELATIONSHIP & DEPENDENCY VERIFICATION ---")
        fk_order_items = db.execute(text("SELECT COUNT(DISTINCT product_id) FROM order_items")).scalar()
        print(f"Unique product_ids referenced in order_items: {fk_order_items}")
        
        # List products that have associated orders vs those that don't
        prods_with_orders = db.execute(text("SELECT p.id, p.title, COUNT(oi.id) as order_count FROM products p JOIN order_items oi ON p.id = oi.product_id GROUP BY p.id, p.title")).fetchall()
        print(f"Products with associated OrderItems ({len(prods_with_orders)}):")
        for pid, ptitle, ocnt in prods_with_orders[:15]:
            print(f"  - Product ID {pid}: '{ptitle}' ({ocnt} order items)")
            
        # Check foreign keys on order_items table schema
        fks = inspector.get_foreign_keys('order_items')
        print(f"\nOrderItems Foreign Keys ({len(fks)}):")
        for fk in fks:
            print(f"  - Constrained: {fk['constrained_columns']} -> Referred: {fk['referred_table']}.{fk['referred_columns']} (ondelete={fk.get('ondelete')})")
            
        # 4. Check Firestore Mirror Status
        print("\n--- 4. FIRESTORE MIRROR VERIFICATION ---")
        if firebase_connected and firestore_db is not None:
            try:
                fs_docs = list(firestore_db.collection('products').stream())
                print(f"Firestore 'products' Collection Document Count: {len(fs_docs)}")
                fs_ids = [d.id for d in fs_docs]
                print(f"Sample Firestore Document IDs: {fs_ids[:10]}")
            except Exception as e:
                print(f"Firestore query error: {e}")
        else:
            print("Firestore is NOT connected in this environment.")
            
        # 5. Check Admin GET /admin/products behavior
        print("\n--- 5. ADMIN GET ENDPOINT QUERY SIMULATION ---")
        admin_user_ids = [str(u[0]) for u in db.execute(text("SELECT id FROM users WHERE role = 'admin'")).fetchall()]
        
        # Simulate query in list_admin_products (backend/app/admin_api/products/routes.py)
        all_admin_prods = db.query(Product).filter(
            (Product.owner_type == "PLATFORM") |
            (Product.is_platform_product == True) |
            (Product.vendor_id == "lumora-creator") |
            Product.vendor_id.is_(None) |
            (Product.vendor_id == "")
        ).all()
        
        print(f"Total Platform Products returned by list_admin_products: {len(all_admin_prods)}")
        archived_in_admin_list = [p for p in all_admin_prods if p.status in ('archived', 'Archived', 'deleted', 'Deleted')]
        print(f"Archived/Deleted products returned in list_admin_products: {len(archived_in_admin_list)}")
        for ap in archived_in_admin_list:
            print(f"  - Product ID {ap.id}: '{ap.title}' (status='{ap.status}')")

    finally:
        db.close()

if __name__ == "__main__":
    run_product_forensics()
