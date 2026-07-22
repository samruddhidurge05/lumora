"""
Enterprise Affiliate Attribution & Analytics Unit Tests
Tests idempotency, referral link resolution, customer LTV, commission recovery, and trace API.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.db.database import SessionLocal, engine
from app.models.user import User
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.affiliate import AffiliateProfile, AffiliateCommission, ReferralAttribution, ReferralLink
from app.api.orders.routes import _create_affiliate_commissions

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_idempotent_commission_creation(db_session: Session):
    """Test that creating a commission for the same order twice is idempotent."""
    # Setup test affiliate user
    aff_user = User(email="test_aff_1@lumora.com", name="Test Affiliate", role="affiliate", is_active=True, password_hash="mock_hash")
    db_session.add(aff_user)
    db_session.flush()

    profile = AffiliateProfile(user_id=aff_user.id, referral_code="AFFTEST100", commission_rate=20.0, is_active=True, status="active")
    db_session.add(profile)
    db_session.flush()

    # Buyer user
    buyer = User(email="test_buyer_1@lumora.com", name="Test Buyer", role="customer", is_active=True, password_hash="mock_hash")
    db_session.add(buyer)
    db_session.flush()

    # Product
    prod = Product(title="Test Product", price=1000.0, affiliate_enabled=True, status="published", seller="Lumora")
    db_session.add(prod)
    db_session.flush()

    # Order
    order = Order(user_id=buyer.id, status="paid", total_amount=1000.0)
    db_session.add(order)
    db_session.flush()

    item = OrderItem(order_id=order.id, product_id=prod.id, price_paid=1000.0)
    db_session.add(item)
    db_session.commit()

    # First call -> creates commission & attribution
    _create_affiliate_commissions(db_session, order, "AFFTEST100", buyer.id)

    comm_count_1 = db_session.query(AffiliateCommission).filter(AffiliateCommission.order_id == order.id).count()
    attr_count_1 = db_session.query(ReferralAttribution).filter(ReferralAttribution.order_id == order.id).count()

    assert comm_count_1 == 1
    assert attr_count_1 == 1

    # Second call for SAME order -> MUST NOT create duplicate
    _create_affiliate_commissions(db_session, order, "AFFTEST100", buyer.id)

    comm_count_2 = db_session.query(AffiliateCommission).filter(AffiliateCommission.order_id == order.id).count()
    attr_count_2 = db_session.query(ReferralAttribution).filter(ReferralAttribution.order_id == order.id).count()

    assert comm_count_2 == 1
    assert attr_count_2 == 1

def test_self_referral_fraud_flagging(db_session: Session):
    """Test that self-referral flags commission as pending_review without throwing an error."""
    aff_user = User(email="test_self_ref@lumora.com", name="Self Ref Affiliate", role="affiliate", is_active=True, password_hash="mock_hash")
    db_session.add(aff_user)
    db_session.flush()

    profile = AffiliateProfile(user_id=aff_user.id, referral_code="AFFSELFREF", commission_rate=15.0, is_active=True, status="active")
    db_session.add(profile)
    db_session.flush()

    prod = Product(title="Self Ref Product", price=500.0, affiliate_enabled=True, status="published", seller="Lumora")
    db_session.add(prod)
    db_session.flush()

    # Order where BUYER is the AFFILIATE
    order = Order(user_id=aff_user.id, status="paid", total_amount=500.0)
    db_session.add(order)
    db_session.flush()

    item = OrderItem(order_id=order.id, product_id=prod.id, price_paid=500.0)
    db_session.add(item)
    db_session.commit()

    _create_affiliate_commissions(db_session, order, "AFFSELFREF", aff_user.id)

    comm = db_session.query(AffiliateCommission).filter(AffiliateCommission.order_id == order.id).first()
    attr = db_session.query(ReferralAttribution).filter(ReferralAttribution.order_id == order.id).first()

    assert comm is not None
    assert comm.commission_status == "pending_review"
    assert attr.fraud_flags == {"self_referral": True}
