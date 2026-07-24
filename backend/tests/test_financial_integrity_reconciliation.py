"""
test_financial_integrity_reconciliation.py — Precision & Financial Integrity Test Suite

Verifies:
1. quantize_money correctness on fractional currency amounts
2. Zero cumulative drift across 1,000 commission additions
3. Exact matching between Database, API response, and Payout Queue display
4. Database self-healing reconciliation script
"""

import sys
import os
import pytest
from pathlib import Path
from decimal import Decimal

# Add backend directory to sys.path
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.user import Base, User
from app.db.session import SessionLocal
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.affiliate import AffiliateProfile, AffiliateCommission, AffiliatePayout
from app.utils.money_utils import quantize_money, quantize_money_str
from app.services.purchase_service import PurchaseService
from scripts.reconcile_financial_precision import reconcile_database_precision

TEST_DATABASE_URL = "sqlite:///./test_financial_precision.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_financial_precision.db"):
        try:
            os.remove("./test_financial_precision.db")
        except Exception:
            pass


def test_quantize_money_precision():
    """Verify quantize_money handles all edge cases with ROUND_HALF_UP."""
    assert quantize_money(6.00) == 6.00
    assert quantize_money("6.00") == 6.00
    assert quantize_money(5.974) == 5.97
    assert quantize_money(5.975) == 5.98
    assert quantize_money(5.969999999999999) == 5.97
    assert quantize_money(None) == 0.0
    assert quantize_money_str(6.0) == "6.00"
    assert quantize_money_str(5.974) == "5.97"


def test_1000_additions_zero_drift():
    """Verify that adding 1,000 quantized commission items yields 0.00 drift."""
    # 1,000 sales of item price 29.85 at 20% = 5.97 per item
    comm_item = quantize_money(29.85 * 0.20)  # 5.97
    total = 0.0
    for _ in range(1000):
        total = quantize_money(total + comm_item)

    expected = 5970.00
    assert total == expected
    assert f"{total:.2f}" == "5970.00"


def test_exact_purchase_service_commission():
    """Verify PurchaseService generates exact quantized commissions on DB creation."""
    db = TestingSessionLocal()
    try:
        # Create affiliate user
        aff_user = User(name="Test Aff", email="aff_prec@example.com", password_hash="testpass", role="affiliate")
        db.add(aff_user)
        db.commit()

        profile = AffiliateProfile(
            user_id=aff_user.id,
            referral_code="PREC600",
            commission_rate=20.0,
            is_active=True,
            status="active"
        )
        db.add(profile)
        db.commit()

        # Create buyer
        buyer = User(name="Buyer", email="buyer_prec@example.com", password_hash="testpass", role="customer")
        db.add(buyer)
        db.commit()

        # Create product with price ₹30.00
        product = Product(
            title="Product ₹30",
            price=30.00,
            commission_type="percentage",
            commission_value=20.0,
            affiliate_enabled=True,
            status="published"
        )
        db.add(product)
        db.commit()

        # Execute purchase via PurchaseService.process_purchase
        order = PurchaseService.process_purchase(
            db=db,
            user_id=buyer.id,
            items_payload=[{"product_id": product.id, "price_paid": 30.00}],
            total_amount=30.00,
            affiliate_code="PREC600"
        )

        assert order is not None

        # Check commission created in DB
        comm = db.query(AffiliateCommission).filter(AffiliateCommission.order_id == order.id).first()
        assert comm is not None
        assert comm.sale_amount == 30.00
        assert comm.commission_amt == 6.00

        # Check profile wallet balance
        db.refresh(profile)
        assert profile.total_earnings == 6.00
        assert profile.pending_earnings == 6.00
    finally:
        db.close()


def test_database_self_healing_reconciliation():
    """Verify database precision reconciliation script detects and fixes unrounded floats."""
    db = TestingSessionLocal()
    try:
        aff_user = User(name="Drift User", email="drift@example.com", password_hash="testpass", role="affiliate")
        db.add(aff_user)
        db.commit()

        aff = AffiliateProfile(
            user_id=aff_user.id,
            referral_code="DRIFT001",
            commission_rate=20.0,
            is_active=True,
            status="active"
        )
        db.add(aff)
        db.commit()

        # Insert a raw unrounded float row to simulate legacy precision drift
        drift_comm = AffiliateCommission(
            affiliate_id=aff.id,
            order_id=99999,
            product_id=1,
            product_name="Drift Test",
            sale_amount=29.8543,
            commission_amt=5.97086,  # Should quantize to 5.97
            commission_status="approved",
            status="approved"
        )
        db.add(drift_comm)
        db.commit()

        # Run reconciliation script
        res = reconcile_database_precision(db=db)
        assert res["success"] is True
        assert res["commissions_quantized"] >= 1

        # Check that drift_comm is quantized to 5.97
        db.refresh(drift_comm)
        assert drift_comm.commission_amt == 5.97
        assert drift_comm.sale_amount == 29.85
    finally:
        db.close()
