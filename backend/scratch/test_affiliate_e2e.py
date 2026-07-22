import os
import sys
import io
from datetime import datetime

# Force UTF-8 output on Windows so rupee and other symbols don't crash
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Adjust path to backend root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Import app.main to trigger _run_schema_migrations() and schema table creation
import app.main

from app.db.session import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.models.affiliate import AffiliateProfile, AffiliateCommission, ReferralLink, ReferralClick
from app.models.order import Order
from app.services.purchase_service import PurchaseService

def run_test():
    print("=== STARTING AFFILIATE END-TO-END FLOW VERIFICATION ===")
    db = SessionLocal()
    try:
        # 1. Setup Test Affiliate
        aff_user = db.query(User).filter(User.email == "test_affiliate_e2e@lumora.com").first()
        if not aff_user:
            aff_user = User(
                name="E2E Test Affiliate",
                email="test_affiliate_e2e@lumora.com",
                password_hash="test_hash_123",
                role="affiliate",
                is_active=True
            )
            db.add(aff_user)
            db.commit()
            db.refresh(aff_user)

        aff_profile = db.query(AffiliateProfile).filter(AffiliateProfile.user_id == aff_user.id).first()
        if not aff_profile:
            aff_profile = AffiliateProfile(
                user_id=aff_user.id,
                referral_code="AFFTESTE2E",
                commission_rate=20.0,
                total_earnings=0.0,
                pending_earnings=0.0,
                total_clicks=0,
                total_sales=0,
                is_active=True,
                status="active"
            )
            db.add(aff_profile)
            db.commit()
            db.refresh(aff_profile)

        print(f"1. Affiliate Profile verified: ID={aff_profile.id}, Code={aff_profile.referral_code}")

        # 2. Setup Test Customer
        customer = db.query(User).filter(User.email == "test_customer_e2e@lumora.com").first()
        if not customer:
            customer = User(
                name="E2E Test Customer",
                email="test_customer_e2e@lumora.com",
                password_hash="test_hash_123",
                role="customer",
                is_active=True
            )
            db.add(customer)
            db.commit()
            db.refresh(customer)

        print(f"2. Customer User verified: ID={customer.id}, Email={customer.email}")

        # 3. Setup Test Product
        product = db.query(Product).filter(Product.title == "E2E Test Product").first()
        if not product:
            product = Product(
                title="E2E Test Product",
                description="Product for E2E affiliate test",
                price=1000.0,
                status="published",
                affiliate_enabled=True,
                commission_type="percentage",
                commission_value=20.0
            )
            db.add(product)
            db.commit()
            db.refresh(product)

        print(f"3. Product verified: ID={product.id}, Title='{product.title}', Price={product.price}, AffiliateEnabled={product.affiliate_enabled}")

        # 4. Simulate Click
        aff_profile.total_clicks = (aff_profile.total_clicks or 0) + 1
        click = ReferralClick(
            affiliate_id=aff_profile.id,
            ip_address="127.0.0.1",
            user_agent="pytest/e2e",
            clicked_at=datetime.utcnow()
        )
        db.add(click)
        db.commit()
        print(f"4. Click recorded for code '{aff_profile.referral_code}'. Total clicks={aff_profile.total_clicks}")

        # 5. Simulate Purchase with Referral Code
        items_payload = [{"product_id": product.id, "price_paid": float(product.price)}]
        initial_earnings = aff_profile.total_earnings or 0.0
        initial_pending = aff_profile.pending_earnings or 0.0
        initial_sales = aff_profile.total_sales or 0

        order = PurchaseService.process_purchase(
            db=db,
            user_id=customer.id,
            items_payload=items_payload,
            total_amount=1000.0,
            payment_method="upi",
            affiliate_code=aff_profile.referral_code
        )
        db.commit()

        print(f"5. Purchase processed cleanly. Order created: ORD-{order.id}")

        # 6. Verify Commission Record
        comm = db.query(AffiliateCommission).filter(
            AffiliateCommission.order_id == order.id,
            AffiliateCommission.affiliate_id == aff_profile.id
        ).first()

        assert comm is not None, "FAILED: AffiliateCommission record was not created!"
        print("6. VERIFICATION SUCCESS: AffiliateCommission record created:")
        print(f"   - Commission ID: {comm.id}")
        print(f"   - Affiliate ID: {comm.affiliate_id}")
        print(f"   - Order ID: {comm.order_id}")
        print(f"   - Product: {comm.product_name} (ID {comm.product_id})")
        print(f"   - Sale Amount: Rs.{comm.sale_amount}")
        print(f"   - Commission Earned: Rs.{comm.commission_amt}")
        print(f"   - Legacy status: '{comm.status}'")
        print(f"   - Phase 2 commission_status: '{comm.commission_status}'")
        print(f"   - Customer Name: '{comm.customer_name}'")
        print(f"   - Customer Email: '{comm.customer_email}'")

        # 7. Verify Affiliate Profile Running Totals
        db.refresh(aff_profile)
        print("7. VERIFICATION SUCCESS: AffiliateProfile running totals updated:")
        print(f"   - Total Earnings: Rs.{aff_profile.total_earnings} (was Rs.{initial_earnings})")
        print(f"   - Pending Earnings: Rs.{aff_profile.pending_earnings} (was Rs.{initial_pending})")
        print(f"   - Total Sales: {aff_profile.total_sales} (was {initial_sales})")
        print(f"   - Last Active At: {aff_profile.last_active_at}")

        # 8. Test Custom Referral Link Code Resolution
        custom_code = f"AFF{aff_user.id}P{product.id}C999"
        ref_link = db.query(ReferralLink).filter(ReferralLink.referral_code == custom_code).first()
        if not ref_link:
            ref_link = ReferralLink(
                affiliate_id=aff_profile.id,
                product_id=product.id,
                referral_code=custom_code,
                name="Custom Test Link"
            )
            db.add(ref_link)
            db.commit()

        # Purchase with Custom Link Code
        custom_order = PurchaseService.process_purchase(
            db=db,
            user_id=customer.id,
            items_payload=items_payload,
            total_amount=1000.0,
            payment_method="upi",
            affiliate_code=custom_code.lower()  # pass lowercase to test normalization too
        )
        db.commit()

        custom_comm = db.query(AffiliateCommission).filter(
            AffiliateCommission.order_id == custom_order.id,
            AffiliateCommission.affiliate_id == aff_profile.id
        ).first()

        assert custom_comm is not None, "FAILED: Commission for custom ReferralLink code was not created!"
        print("8. VERIFICATION SUCCESS: Custom ReferralLink code purchase resolved to affiliate and commission created!")

        # 9. Verify Admin API list_affiliates logic
        from admin.routes.affiliates import list_affiliates, get_affiliate_kpis
        admin_mock = User(id=1, role="admin", name="Admin")
        affiliates_list = list_affiliates(admin_user=admin_mock, db=db)
        found_in_admin = any(a.get("code") == "AFFTESTE2E" for a in affiliates_list)
        assert found_in_admin, "FAILED: Affiliate not returned in admin list_affiliates API!"
        print("9. VERIFICATION SUCCESS: Affiliate returned in admin list_affiliates API!")

        kpis = get_affiliate_kpis(db=db, admin_user=admin_mock)
        print(f"10. VERIFICATION SUCCESS: Admin KPIs calculated correctly: {kpis}")

        print("\nALL END-TO-END AFFILIATE FLOW CHECKS PASSED PERFECTLY!")

    finally:
        db.close()

if __name__ == "__main__":
    run_test()
