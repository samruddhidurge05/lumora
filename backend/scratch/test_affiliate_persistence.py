"""
backend/scratch/test_affiliate_persistence.py
-----------------------------------------------
Verify that toggling product affiliate status immediately updates PostgreSQL
and reflects in Campaign Manager GET /admin/affiliates/affiliate-products API.
"""

import sys
import os

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.session import SessionLocal
from app.models.user import User
from app.models.product import Product
from admin.routes.products import update_product, ProductUpdate, patch_product_affiliate, AffiliatePatch
from admin.routes.affiliates import get_affiliate_products

def run_test():
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.role == "admin").first() or db.query(User).first()
        p = db.query(Product).first()
        if not p:
            print("No product found in DB!")
            return

        pid = p.id
        print(f"Testing Product #{pid} ({p.title})")

        # Step 1: Enable Affiliate via API handler
        patch_body = AffiliatePatch(affiliate_enabled=True, commission_mode="percentage", commission_value=25.0)
        patch_product_affiliate(product_id=pid, body=patch_body, db=db, admin_user=admin_user)

        # Refresh from DB
        db.refresh(p)
        print(f"Step 1: DB value after enable -> affiliate_enabled: {p.affiliate_enabled}")
        assert p.affiliate_enabled == True

        # Query Campaign Manager API endpoint
        aff_prods = get_affiliate_products(search=None, db=db, admin_user=admin_user)
        found_ids = [item["id"] for item in aff_prods]
        print(f"Step 1: Campaign Manager endpoint returns product IDs: {found_ids}")
        assert pid in found_ids

        # Step 2: Disable Affiliate via API handler
        patch_body_disable = AffiliatePatch(affiliate_enabled=False)
        patch_product_affiliate(product_id=pid, body=patch_body_disable, db=db, admin_user=admin_user)

        db.refresh(p)
        print(f"Step 2: DB value after disable -> affiliate_enabled: {p.affiliate_enabled}")
        assert p.affiliate_enabled == False

        # Query Campaign Manager API endpoint again
        aff_prods_after = get_affiliate_products(search=None, db=db, admin_user=admin_user)
        found_ids_after = [item["id"] for item in aff_prods_after]
        print(f"Step 2: Campaign Manager endpoint returns product IDs: {found_ids_after}")
        assert pid not in found_ids_after

        # Re-enable product so it stays enabled in DB
        patch_product_affiliate(product_id=pid, body=patch_body, db=db, admin_user=admin_user)
        print(f"Re-enabled Product #{pid} for production testing.")

        print("\nSUCCESS: Product affiliate toggling and Campaign Manager instant reflection verified 100%!")

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    run_test()
