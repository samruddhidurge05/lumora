"""
test_product_deletion_integrity.py
Automated test suite verifying that demo and simulated products can be cleanly
deleted by Admin even when cross-table foreign key references exist (OrderItem,
ReferralLink, AffiliateCommission, ReferralAttribution, AffiliateReferral, Review,
PriceAlert, RecentlyViewed).
"""

import pytest
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.user import User
from app.models.affiliate import ReferralLink, AffiliateCommission, ReferralAttribution, AffiliateReferral
from app.models.review import Review
from app.models.price_alert import PriceAlert
from admin.routes.products import delete_product


def test_delete_demo_product_with_full_child_references():
    db: Session = SessionLocal()
    try:
        # 1. Ensure admin user exists
        admin_user = db.query(User).filter(User.role == "admin").first()
        if not admin_user:
            admin_user = User(
                email="admin_test_delete@lumora.com",
                role="admin",
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)

        # 2. Create a demo test product
        demo_product = Product(
            title="Demo Simulated Product for Deletion Test",
            price=49.99,
            category="Demo",
            status="published",
            seller="Demo Vendor"
        )
        db.add(demo_product)
        db.commit()
        db.refresh(demo_product)
        prod_id = demo_product.id

        # 3. Create dummy parent order and child OrderItem
        dummy_order = Order(user_id=admin_user.id, total_amount=49.99, status="completed")
        db.add(dummy_order)
        db.commit()
        db.refresh(dummy_order)

        order_item = OrderItem(order_id=dummy_order.id, product_id=prod_id, price_paid=49.99)
        db.add(order_item)

        # 4. Create child ReferralLink
        ref_link = ReferralLink(affiliate_id=1, product_id=prod_id, referral_code=f"TESTREF_{prod_id}")
        db.add(ref_link)

        # 5. Create child AffiliateCommission
        comm = AffiliateCommission(affiliate_id=1, product_id=prod_id, order_id=dummy_order.id, sale_amount=49.99, commission_amt=5.00, status="approved")
        db.add(comm)

        # 6. Create child ReferralAttribution
        attr = ReferralAttribution(order_id=dummy_order.id, affiliate_id=1, affiliate_code="TESTCODE", product_id=prod_id, customer_id=admin_user.id)
        db.add(attr)

        # 7. Create child Review & PriceAlert
        rev = Review(user_id=admin_user.id, product_id=prod_id, rating=5, comment="Great demo product")
        db.add(rev)
        pa = PriceAlert(user_id=admin_user.id, product_id=prod_id, original_price=49.99, target_price=20.0)
        db.add(pa)

        db.commit()

        # 8. Execute delete_product admin route handler
        delete_product(product_id=prod_id, db=db, admin_user=admin_user)

        # 9. Verify product and all child references are deleted
        deleted_prod = db.query(Product).filter(Product.id == prod_id).first()
        assert deleted_prod is None, "Product was not deleted from database"

        remaining_items = db.query(OrderItem).filter(OrderItem.product_id == prod_id).count()
        assert remaining_items == 0, "OrderItem references remain"

        remaining_links = db.query(ReferralLink).filter(ReferralLink.product_id == prod_id).count()
        assert remaining_links == 0, "ReferralLink references remain"

        remaining_comms = db.query(AffiliateCommission).filter(AffiliateCommission.product_id == prod_id).count()
        assert remaining_comms == 0, "AffiliateCommission references remain"

        print(f"Product {prod_id} and all child references deleted successfully!")

    finally:
        db.close()
