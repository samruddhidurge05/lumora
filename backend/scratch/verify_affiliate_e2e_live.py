"""
Verification script for Admin Affiliate Wiring & Live Backend Data.
"""

import sys
import os
from datetime import datetime

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import SessionLocal, engine
from app.models.user import User, Base
from app.models.product import Product
from app.models.order import Order
from app.models.affiliate import AffiliateProfile, AffiliateCommission, ReferralAttribution
from app.services.purchase_service import PurchaseService

def main():
    print("=== STARTING AFFILIATE END-TO-END VERIFICATION ===")
    
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Setup Test Affiliate User + Profile
        aff_email = "test_affiliate_live_verification@lumora.dev"
        aff_user = db.query(User).filter(User.email == aff_email).first()
        if not aff_user:
            aff_user = User(
                name="Verification Affiliate",
                email=aff_email,
                password_hash="test_pass_hash",
                role="affiliate",
                is_active=True,
                is_verified=True,
            )
            db.add(aff_user)
            db.flush()

        aff_profile = db.query(AffiliateProfile).filter(AffiliateProfile.user_id == aff_user.id).first()
        if not aff_profile:
            aff_profile = AffiliateProfile(
                user_id=aff_user.id,
                referral_code="LIVEAFF001",
                commission_rate=25.0,
                is_active=True,
                status="active"
            )
            db.add(aff_profile)
            db.flush()

        print(f"[OK] Test Affiliate Profile: ID={aff_profile.id}, Code={aff_profile.referral_code}")

        # 2. Setup Test Customer User
        cust_email = "test_customer_live_verification@lumora.dev"
        cust_user = db.query(User).filter(User.email == cust_email).first()
        if not cust_user:
            cust_user = User(
                name="Verification Customer",
                email=cust_email,
                password_hash="test_pass_hash",
                role="customer",
                is_active=True,
                is_verified=True,
            )
            db.add(cust_user)
            db.flush()

        print(f"[OK] Test Customer User: ID={cust_user.id}, Name={cust_user.name}")

        # 3. Setup Test Product
        prod = db.query(Product).filter(Product.title == "Live Verification Asset").first()
        if not prod:
            prod = Product(
                title="Live Verification Asset",
                price=2000.0,
                status="published",
                affiliate_enabled=True,
                commission_mode="percentage",
                commission_value=25.0,
            )
            db.add(prod)
            db.flush()

        print(f"[OK] Test Product: ID={prod.id}, Title={prod.title}, Price=INR {prod.price}")

        # 4. Execute Purchase via PurchaseService
        items_payload = [{"product_id": prod.id, "price_paid": prod.price}]
        order = PurchaseService.process_purchase(
            db=db,
            user_id=cust_user.id,
            items_payload=items_payload,
            total_amount=prod.price,
            payment_method="razorpay",
            affiliate_code="LIVEAFF001"
        )
        db.commit()

        print(f"[OK] Order Created: ID={order.id}, total=INR {order.total_amount}, aff_id={order.affiliate_id}, code_used={order.referral_code_used}")

        # 5. Verify Commission Record
        comm = db.query(AffiliateCommission).filter(AffiliateCommission.order_id == order.id).first()
        assert comm is not None, "AffiliateCommission was not created!"
        print(f"[OK] AffiliateCommission Created: ID={comm.id}, Amt=INR {comm.commission_amt}, Status={comm.commission_status}")

        # 6. Verify ReferralAttribution Record
        attr = db.query(ReferralAttribution).filter(ReferralAttribution.order_id == order.id).first()
        assert attr is not None, "ReferralAttribution was not created!"
        print(f"[OK] ReferralAttribution Created: ID={attr.id}, CustomerID={attr.customer_id}, Code={attr.affiliate_code}, Status={attr.status}")

        # 7. Test Admin Endpoints via FastAPI Test Client
        from fastapi.testclient import TestClient
        from app.main import app
        from admin.validators.admin_auth import require_admin_role

        # Override admin auth dependency to bypass JWT requirement in test
        admin_user = db.query(User).filter(User.role == "admin").first()
        if not admin_user:
            admin_user = User(name="Admin", email="admin_verify@lumora.dev", password_hash="hash", role="admin", is_active=True, is_verified=True)
            db.add(admin_user)
            db.commit()

        app.dependency_overrides[require_admin_role] = lambda: admin_user
        client = TestClient(app)

        # 7a. Test GET /api/admin/affiliates/kpis
        res_kpis = client.get("/api/admin/affiliates/kpis")
        assert res_kpis.status_code == 200, f"KPIs endpoint failed: {res_kpis.text}"
        kpi_json = res_kpis.json()
        print(f"[OK] GET /api/admin/affiliates/kpis: {kpi_json}")
        assert kpi_json["total_affiliates"] > 0
        assert kpi_json["revenue_generated"] > 0.0

        # 7b. Test GET /api/admin/affiliates/customer-attributions
        res_attrs = client.get("/api/admin/affiliates/customer-attributions")
        assert res_attrs.status_code == 200, f"Customer attributions endpoint failed: {res_attrs.text}"
        attrs_json = res_attrs.json()
        print(f"[OK] GET /api/admin/affiliates/customer-attributions total: {attrs_json['total']}")
        assert attrs_json["total"] > 0
        found_cust_attr = any(item["order_id"] == order.id for item in attrs_json["items"])
        assert found_cust_attr, f"Order #{order.id} not found in customer attributions response!"

        # 7c. Test GET /api/admin/affiliates/commissions
        res_comms = client.get("/api/admin/affiliates/commissions")
        assert res_comms.status_code == 200, f"Commissions endpoint failed: {res_comms.text}"
        comms_json = res_comms.json()
        print(f"[OK] GET /api/admin/affiliates/commissions total: {comms_json['total']}")
        assert comms_json["total"] > 0
        found_comm = any(item["order_id"] == order.id for item in comms_json["items"])
        assert found_comm, f"Order #{order.id} not found in commissions response!"

        # 7d. Test GET /api/admin/affiliates/orders/{order_id}
        res_trace = client.get(f"/api/admin/affiliates/orders/{order.id}")
        assert res_trace.status_code == 200, f"Trace endpoint failed: {res_trace.text}"
        trace_json = res_trace.json()
        print(f"[OK] GET /api/admin/affiliates/orders/{order.id} Trace: customer={trace_json['customer']['name']}, code={trace_json['attribution']['affiliate_code']}, timeline_events={len(trace_json['timeline'])}")
        assert trace_json["order_id"] == order.id

        print("\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY! REAL DATA IS LIVE & WORKING! ===")

    finally:
        db.close()

if __name__ == "__main__":
    main()
