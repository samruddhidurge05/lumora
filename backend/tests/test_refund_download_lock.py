import pytest
from datetime import datetime
from typing import cast
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.models.user import Base, User
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.refund_request import RefundRequest
from app.services.download_auth_service import check_download_permission, get_product_refund_status
from app.api.products_router import generate_download_token, verify_download_token

# Isolated SQLite in-memory engine for unit tests
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=test_engine)


def test_download_allowed_without_refund(setup_db: Session):
    db = setup_db
    user = User(email="testuser@example.com", name="Test Customer", password_hash="hash123", role="customer", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)

    product = Product(title="Test Digital Asset", price=100.0, vendor_id=999, storage_path="files/test.pdf")
    db.add(product)
    db.commit()
    db.refresh(product)

    order = Order(user_id=user.id, status="completed", total_amount=100.0)
    db.add(order)
    db.commit()
    db.refresh(order)

    order_item = OrderItem(order_id=order.id, product_id=product.id, price_paid=100.0)
    db.add(order_item)
    db.commit()

    user_id_int = int(cast(int, user.id))
    product_id_int = int(cast(int, product.id))

    status_str, can_dl, msg = get_product_refund_status(db, user_id_int, product_id_int)
    assert can_dl is True
    assert status_str == "NONE"

    # Should not raise exception
    check_download_permission(db, user_id_int, product_id_int, is_owner=False, is_admin=False)


def test_download_blocked_when_refund_pending(setup_db: Session):
    db = setup_db
    user = User(email="refunduser@example.com", name="Refund Customer", password_hash="hash123", role="customer", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)

    product = Product(title="Refundable eBook", price=250.0, vendor_id=888, storage_path="files/ebook.pdf")
    db.add(product)
    db.commit()
    db.refresh(product)

    order = Order(user_id=user.id, status="completed", total_amount=250.0)
    db.add(order)
    db.commit()
    db.refresh(order)

    order_item = OrderItem(order_id=order.id, product_id=product.id, price_paid=250.0)
    db.add(order_item)
    db.commit()

    user_id_int = int(cast(int, user.id))
    product_id_int = int(cast(int, product.id))

    # Submit refund request (status = PENDING)
    refund_req = RefundRequest(
        order_id=order.id,
        user_id=user.id,
        reason_category="Technical Issue",
        details="File corrupted",
        status="PENDING",
        requested_amount=250.0,
        currency="INR",
        payment_id="pay_test123",
        product_name="Refundable eBook",
        order_total=250.0,
        payment_method="UPI",
        purchase_date=datetime.utcnow(),
        created_at=datetime.utcnow()
    )
    db.add(refund_req)
    db.commit()

    status_str, can_dl, msg = get_product_refund_status(db, user_id_int, product_id_int)
    assert can_dl is False
    assert status_str == "REQUESTED"
    assert msg is not None
    assert "under review" in msg.lower()

    with pytest.raises(HTTPException) as exc_info:
        check_download_permission(db, user_id_int, product_id_int, is_owner=False, is_admin=False)
    assert exc_info.value.status_code == 403
    assert "under review" in exc_info.value.detail.lower()


def test_download_permanently_blocked_when_refund_approved(setup_db: Session):
    db = setup_db
    user = User(email="approveduser@example.com", name="Approved Refund Customer", password_hash="hash123", role="customer", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)

    product = Product(title="Approved Refund Template", price=500.0, vendor_id=777, storage_path="files/template.zip")
    db.add(product)
    db.commit()
    db.refresh(product)

    order = Order(user_id=user.id, status="refunded", total_amount=500.0)
    db.add(order)
    db.commit()
    db.refresh(order)

    order_item = OrderItem(order_id=order.id, product_id=product.id, price_paid=500.0)
    db.add(order_item)
    db.commit()

    user_id_int = int(cast(int, user.id))
    product_id_int = int(cast(int, product.id))

    refund_req = RefundRequest(
        order_id=order.id,
        user_id=user.id,
        reason_category="Accidental Purchase",
        details="Refund requested",
        status="APPROVED",
        requested_amount=500.0,
        currency="INR",
        payment_id="pay_test456",
        product_name="Approved Refund Template",
        order_total=500.0,
        payment_method="UPI",
        purchase_date=datetime.utcnow(),
        created_at=datetime.utcnow()
    )
    db.add(refund_req)
    db.commit()

    status_str, can_dl, msg = get_product_refund_status(db, user_id_int, product_id_int)
    assert can_dl is False
    assert status_str == "APPROVED"

    with pytest.raises(HTTPException) as exc_info:
        check_download_permission(db, user_id_int, product_id_int, is_owner=False, is_admin=False)
    assert exc_info.value.status_code == 403
    assert "refunded" in exc_info.value.detail.lower()


def test_download_restored_when_refund_rejected(setup_db: Session):
    db = setup_db
    user = User(email="rejecteduser@example.com", name="Rejected Refund Customer", password_hash="hash123", role="customer", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)

    product = Product(title="Valid Course Asset", price=300.0, vendor_id=666, storage_path="files/course.mp4")
    db.add(product)
    db.commit()
    db.refresh(product)

    order = Order(user_id=user.id, status="completed", total_amount=300.0)
    db.add(order)
    db.commit()
    db.refresh(order)

    order_item = OrderItem(order_id=order.id, product_id=product.id, price_paid=300.0)
    db.add(order_item)
    db.commit()

    user_id_int = int(cast(int, user.id))
    product_id_int = int(cast(int, product.id))

    refund_req = RefundRequest(
        order_id=order.id,
        user_id=user.id,
        reason_category="Changed Mind",
        details="Invalid claim",
        status="REJECTED",
        requested_amount=300.0,
        currency="INR",
        payment_id="pay_test789",
        product_name="Valid Course Asset",
        order_total=300.0,
        payment_method="UPI",
        purchase_date=datetime.utcnow(),
        created_at=datetime.utcnow()
    )
    db.add(refund_req)
    db.commit()

    status_str, can_dl, msg = get_product_refund_status(db, user_id_int, product_id_int)
    assert can_dl is True
    assert status_str == "REJECTED"

    # Restored access should not raise 403
    check_download_permission(db, user_id_int, product_id_int, is_owner=False, is_admin=False)


def test_pre_issued_token_blocked_once_refund_submitted(setup_db: Session):
    db = setup_db
    user = User(email="tokenuser@example.com", name="Token Customer", password_hash="hash123", role="customer", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)

    product = Product(title="Protected Audio Pack", price=150.0, vendor_id=555, storage_path="files/audio.mp3")
    db.add(product)
    db.commit()
    db.refresh(product)

    order = Order(user_id=user.id, status="completed", total_amount=150.0)
    db.add(order)
    db.commit()
    db.refresh(order)

    order_item = OrderItem(order_id=order.id, product_id=product.id, price_paid=150.0)
    db.add(order_item)
    db.commit()

    user_id_int = int(cast(int, user.id))
    product_id_int = int(cast(int, product.id))

    # 1. Pre-issue token BEFORE refund request
    token = generate_download_token(user_id_int, product_id_int)
    decoded_uid = verify_download_token(token, product_id_int)
    assert decoded_uid == user_id_int

    # 2. Submit refund request
    refund_req = RefundRequest(
        order_id=order.id,
        user_id=user.id,
        reason_category="Defective",
        details="Submitting refund after token generation",
        status="REQUESTED",
        requested_amount=150.0,
        currency="INR",
        payment_id="pay_test_token",
        product_name="Protected Audio Pack",
        order_total=150.0,
        payment_method="UPI",
        purchase_date=datetime.utcnow(),
        created_at=datetime.utcnow()
    )
    db.add(refund_req)
    db.commit()

    # 3. Validating download permission using token's user_id must now fail
    with pytest.raises(HTTPException) as exc_info:
        check_download_permission(db, decoded_uid, product_id_int, is_owner=False, is_admin=False)
    assert exc_info.value.status_code == 403
