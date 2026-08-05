import pytest
from datetime import datetime
from typing import cast
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.database import SessionLocal, engine
from app.models.user import Base
from app.models.user import User
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.refund_request import RefundRequest
from app.services.download_auth_service import check_download_permission, get_product_refund_status
from app.api.products_router import generate_download_token, verify_download_token


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


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

    refund_status, can_download, msg = get_product_refund_status(db, cast(int, user.id), cast(int, product.id))
    assert refund_status == "NONE"
    assert can_download is True
    assert msg is None

    # Should not raise exception
    check_download_permission(db, cast(int, user.id), cast(int, product.id))


def test_download_blocked_when_refund_pending(setup_db: Session):
    db = setup_db
    user = User(email="refunduser@example.com", name="Refund Customer", password_hash="hash123", role="customer", is_active=True)
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

    # Customer submits refund request
    refund = RefundRequest(
        order_id=order.id,
        user_id=user.id,
        status="PENDING",
        reason_category="broken_file",
        requested_amount=100.0,
        payment_id="pay_test_123",
        product_name="Test Digital Asset",
        order_total=100.0,
        payment_method="card",
        purchase_date=datetime.utcnow(),
        created_at=datetime.utcnow()
    )
    db.add(refund)
    db.commit()

    refund_status, can_download, msg = get_product_refund_status(db, cast(int, user.id), cast(int, product.id))
    assert refund_status == "REQUESTED"
    assert can_download is False
    assert msg == "Download disabled while refund request is under review."

    with pytest.raises(HTTPException) as exc_info:
        check_download_permission(db, cast(int, user.id), cast(int, product.id))
    
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Download disabled while refund request is under review."


def test_download_permanently_blocked_when_refund_approved(setup_db: Session):
    db = setup_db
    user = User(email="approveduser@example.com", name="Approved Customer", password_hash="hash123", role="customer", is_active=True)
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

    # Admin approves refund request
    refund = RefundRequest(
        order_id=order.id,
        user_id=user.id,
        status="APPROVED",
        reason_category="broken_file",
        requested_amount=100.0,
        payment_id="pay_test_123",
        product_name="Test Digital Asset",
        order_total=100.0,
        payment_method="card",
        purchase_date=datetime.utcnow(),
        created_at=datetime.utcnow()
    )
    db.add(refund)
    order.status = "refunded"  # type: ignore
    db.commit()

    refund_status, can_download, msg = get_product_refund_status(db, cast(int, user.id), cast(int, product.id))
    assert refund_status == "APPROVED"
    assert can_download is False
    assert msg == "Download disabled for refunded product."

    with pytest.raises(HTTPException) as exc_info:
        check_download_permission(db, cast(int, user.id), cast(int, product.id))

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Download disabled for refunded product."


def test_download_restored_when_refund_rejected(setup_db: Session):
    db = setup_db
    user = User(email="rejecteduser@example.com", name="Rejected Customer", password_hash="hash123", role="customer", is_active=True)
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

    # Admin rejects refund request
    refund = RefundRequest(
        order_id=order.id,
        user_id=user.id,
        status="REJECTED",
        reason_category="broken_file",
        requested_amount=100.0,
        payment_id="pay_test_123",
        product_name="Test Digital Asset",
        order_total=100.0,
        payment_method="card",
        purchase_date=datetime.utcnow(),
        created_at=datetime.utcnow()
    )
    db.add(refund)
    db.commit()

    refund_status, can_download, msg = get_product_refund_status(db, cast(int, user.id), cast(int, product.id))
    assert refund_status == "REJECTED"
    assert can_download is True
    assert msg is None

    # Should not raise exception
    check_download_permission(db, cast(int, user.id), cast(int, product.id))


def test_pre_issued_token_blocked_once_refund_submitted(setup_db: Session):
    db = setup_db
    user = User(email="pretoken@example.com", name="PreToken Customer", password_hash="hash123", role="customer", is_active=True)
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

    # Customer generates download token BEFORE refund request
    token = generate_download_token(cast(int, user.id), cast(int, product.id))
    verified_uid = verify_download_token(token, cast(int, product.id))
    assert verified_uid == user.id

    # Customer submits refund request AFTER obtaining token
    refund = RefundRequest(
        order_id=order.id,
        user_id=user.id,
        status="UNDER_REVIEW",
        reason_category="other",
        requested_amount=100.0,
        payment_id="pay_test_123",
        product_name="Test Digital Asset",
        order_total=100.0,
        payment_method="card",
        purchase_date=datetime.utcnow(),
        created_at=datetime.utcnow()
    )
    db.add(refund)
    db.commit()

    # Even though token is valid JWT, check_download_permission must reject the download request
    with pytest.raises(HTTPException) as exc_info:
        check_download_permission(db, cast(int, verified_uid), cast(int, product.id))

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Download disabled while refund request is under review."
