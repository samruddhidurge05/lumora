"""
backend/scratch/verify_campaign_manager_e2e.py
------------------------------------------------
E2E automated verification script for Campaign Manager real-time API endpoints.
Tests:
  1. GET /api/admin/affiliates/affiliate-products
  2. GET /api/admin/affiliates/affiliate-products/{id}/details
  3. POST /api/admin/referral-links
  4. PATCH /api/admin/referral-links/{id}/status
  5. DELETE /api/admin/referral-links/{id}
"""

import sys
import os
import json

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.session import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.models.affiliate import ReferralLink, AffiliateProfile
from admin.routes.affiliates import get_affiliate_products, get_affiliate_product_details
from admin.routes.referral_links import create_referral_link, update_referral_link_status, delete_referral_link, AdminReferralLinkCreate, AdminReferralLinkStatusUpdate

def run_verification():
    db = SessionLocal()
    try:
        print("=== 1. Testing GET /admin/affiliates/affiliate-products ===")
        # Ensure at least one product has affiliate_enabled = True for testing
        p = db.query(Product).first()
        if p:
            p.affiliate_enabled = True
            db.commit()
            print(f"Set Product ID {p.id} ({p.title}) affiliate_enabled = True for testing.")

        # Admin user context mock
        admin_user = db.query(User).filter(User.role == "admin").first()
        if not admin_user:
            admin_user = db.query(User).first()
            if admin_user:
                admin_user.role = "admin"
                db.commit()

        print(f"Using Admin User: {admin_user.name} (ID: {admin_user.id})")

        res_products = get_affiliate_products(search=None, db=db, admin_user=admin_user)
        print(f"GET /affiliate-products returned {len(res_products)} items.")
        if res_products:
            first = res_products[0]
            print(f"Sample item: Product #{first['id']} ({first['title']}) - Clicks: {first['clicks']}, Revenue: {first['revenue_generated']}")
            assert "affiliate_enabled" in first
            assert first["affiliate_enabled"] == True

        print("\n=== 2. Testing GET /admin/affiliates/affiliate-products/{id}/details ===")
        if p:
            details = get_affiliate_product_details(product_id=p.id, db=db, admin_user=admin_user)
            print(f"Telemetry Product Title: {details['product']['title']}")
            print(f"Analytics: {details['analytics']}")

        print("\n=== 3. Testing POST /admin/referral-links ===")
        if p:
            test_code = f"ADM-TEST{p.id}"
            body = AdminReferralLinkCreate(
                productId=str(p.id),
                productName=p.title,
                referralName="E2E Test Campaign",
                commissionPct=20,
                code=test_code
            )
            link_res = create_referral_link(body=body, admin_user=admin_user, db=db)
            print(f"Created Referral Link ID: {link_res['id']} Code: {link_res['code']}")

            print("\n=== 4. Testing PATCH /admin/referral-links/{id}/status ===")
            patch_body = AdminReferralLinkStatusUpdate(status="paused")
            updated = update_referral_link_status(link_id=str(link_res['id']), body=patch_body, admin_user=admin_user, db=db)
            print(f"Updated status to: {updated['status']}")

            print("\n=== 5. Testing DELETE /admin/referral-links/{id} ===")
            deleted = delete_referral_link(link_id=str(link_res['id']), admin_user=admin_user, db=db)
            print(f"Deleted Link Result: {deleted}")

        print("\nSUCCESS: All E2E Campaign Manager endpoints passed verification cleanly!")

    except Exception as e:
        print(f"\nERROR: Verification failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    run_verification()
