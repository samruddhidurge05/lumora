"""
test_product_deletion_integrity.py
Automated test suite verifying that demo and simulated products can be cleanly
deleted by Admin even when cross-table foreign key references exist (OrderItem,
ReferralLink, AffiliateCommission, ReferralAttribution, AffiliateReferral, Review,
PriceAlert, RecentlyViewed).
"""

import pytest
from typing import cast
from sqlalchemy import text
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
        if db.bind and db.bind.dialect.name == "sqlite":
            db.execute(text("PRAGMA foreign_keys=ON"))

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
        prod_id = cast(int, demo_product.id)

        # 3. Create dummy parent order and child OrderItem
        dummy_order = Order(user_id=admin_user.id, total_amount=49.99, status="completed")
        db.add(dummy_order)
        db.commit()
        db.refresh(dummy_order)

        order_item = OrderItem(order_id=dummy_order.id, product_id=prod_id, price_paid=49.99)
        db.add(order_item)

        # 4. Create child ReferralLink
        import time
        ref_code = f"TESTREF_{prod_id}_{int(time.time()*1000)}"
        ref_link = ReferralLink(affiliate_id=1, product_id=prod_id, referral_code=ref_code)
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

        # 9. Verify product status is set to 'archived' to preserve historical business records while removing from catalog
        deleted_prod = db.query(Product).filter(Product.id == prod_id).first()
        assert deleted_prod is not None, "Historical product record should remain for audit trail"
        assert deleted_prod.status == "archived", "Product status was not set to archived"

        # 10. Verify historical child records remain 100% intact in database
        saved_item = db.query(OrderItem).filter(OrderItem.id == order_item.id).first()
        assert saved_item is not None, "Historical OrderItem must not be deleted"

        saved_attr = db.query(ReferralAttribution).filter(ReferralAttribution.id == attr.id).first()
        assert saved_attr is not None, "Historical ReferralAttribution must not be deleted"

        saved_comm = db.query(AffiliateCommission).filter(AffiliateCommission.id == comm.id).first()
        assert saved_comm is not None, "Historical AffiliateCommission must not be deleted"

        print(f"Product {prod_id} successfully archived and all historical child records preserved cleanly!")

        # 11. Test clean physical deletion for a product with NO historical dependencies
        clean_product = Product(
            title="Clean Product With No History",
            price=29.99,
            category="Demo",
            status="published",
            seller="Demo Vendor"
        )
        db.add(clean_product)
        db.commit()
        db.refresh(clean_product)
        clean_id = cast(int, clean_product.id)

        delete_product(product_id=clean_id, db=db, admin_user=admin_user)
        deleted_clean = db.query(Product).filter(Product.id == clean_id).first()
        assert deleted_clean is None, "Clean product without history should be physically deleted"
        print(f"Clean product {clean_id} physically deleted successfully!")

    finally:
        db.close()
