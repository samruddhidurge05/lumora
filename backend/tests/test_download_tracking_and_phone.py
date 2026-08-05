"""
Unit tests for Lumora Permanent Download Tracking and Registration Contact Number validation.
"""

import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.session import get_db
from app.models.user import Base, User
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.core.security import get_password_hash, create_access_token

# Use SQLite in-memory database for unit testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_clean_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


def test_contact_number_registration_valid():
    """Test customer registration with valid 10-15 digit phone numbers."""
    payload = {
        "name": "Jane Customer",
        "email": "jane@example.com",
        "password": "Password123!",
        "phone": "+919876543210"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["phone"] == "+919876543210"
    assert data["email"] == "jane@example.com"

    # Also test 10-digit number without leading +
    payload2 = {
        "name": "John Customer",
        "email": "john@example.com",
        "password": "Password123!",
        "phone": "9876543210"
    }
    response2 = client.post("/api/auth/register", json=payload2)
    assert response2.status_code == 201
    data2 = response2.json()
    assert data2["phone"] == "9876543210"


def test_contact_number_registration_invalid():
    """Test customer registration with invalid phone numbers (<10 digits or letters)."""
    payload_too_short = {
        "name": "Invalid Customer",
        "email": "invalid1@example.com",
        "password": "Password123!",
        "phone": "12345"
    }
    response = client.post("/api/auth/register", json=payload_too_short)
    assert response.status_code == 422

    payload_letters = {
        "name": "Invalid Customer 2",
        "email": "invalid2@example.com",
        "password": "Password123!",
        "phone": "+9198765abcde"
    }
    response2 = client.post("/api/auth/register", json=payload_letters)
    assert response2.status_code == 422


def test_update_profile_phone():
    """Test updating user contact number via PUT /api/auth/me."""
    db = TestingSessionLocal()
    user = User(
        name="Profile User",
        email="profile@example.com",
        password_hash=get_password_hash("Password123!"),
        phone="+919999999999",
        role="customer"
    )
    db.add(user)
    db.commit()
    user_id = user.id
    db.close()

    token = create_access_token({"sub": str(user_id), "role": "customer"})
    headers = {"Authorization": f"Bearer {token}"}

    # Verify GET /me returns phone
    get_res = client.get("/api/auth/me", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["phone"] == "+919999999999"

    # Update phone via PUT /me
    put_res = client.put("/api/auth/me", headers=headers, json={"phone": "+918888888888"})
    assert put_res.status_code == 200
    assert put_res.json()["phone"] == "+918888888888"


def test_permanent_download_tracking():
    """Test that streaming/downloading a file marks downloaded=True and stores downloaded_at."""
    db = TestingSessionLocal()

    # 1. Setup User
    user = User(
        name="Download User",
        email="downloader@example.com",
        password_hash=get_password_hash("Password123!"),
        phone="+919876543210",
        role="customer"
    )
    db.add(user)
    db.commit()
    user_id = user.id

    # 2. Setup Product
    product = Product(
        title="Test Trackable Package",
        description="Trackable digital product asset",
        price=499.0,
        category="Templates",
        vendor_id=str(user_id),
        file_url="/storage/test_package.zip"
    )
    db.add(product)
    db.commit()
    product_id = product.id

    # 3. Setup Completed Order & OrderItem
    order = Order(user_id=user_id, status="completed", total_amount=499.0)
    db.add(order)
    db.commit()

    order_item = OrderItem(
        order_id=order.id,
        product_id=product_id,
        price_paid=499.0,
        downloaded=False,
        downloaded_at=None
    )
    db.add(order_item)
    db.commit()
    order_item_id = order_item.id
    db.close()

    token = create_access_token({"sub": str(user_id), "role": "customer"})
    headers = {"Authorization": f"Bearer {token}"}

    # Initial check: product download info shows downloaded = False
    info_res = client.get(f"/api/products/{product_id}/download", headers=headers)
    assert info_res.status_code == 200
    assert info_res.json()["downloaded"] is False
    assert info_res.json()["downloaded_at"] is None

    # Get download token
    download_url = info_res.json()["download_url"]
    file_token = download_url.split("token=")[1]

    # Trigger actual file stream download
    file_res = client.get(f"/api/products/{product_id}/download-file?token={file_token}")
    assert file_res.status_code == 200

    # Verify DB now has downloaded=True and downloaded_at timestamp recorded
    db2 = TestingSessionLocal()
    updated_item = db2.query(OrderItem).filter(OrderItem.id == order_item_id).first()
    assert updated_item.downloaded is True
    assert updated_item.downloaded_at is not None
    db2.close()

    # Subsequent check: GET /api/products/{id}/download shows downloaded = True
    info_res2 = client.get(f"/api/products/{product_id}/download", headers=headers)
    assert info_res2.status_code == 200
    assert info_res2.json()["downloaded"] is True
    assert info_res2.json()["downloaded_at"] is not None

    # GET /api/products/downloads/center shows downloaded = True
    center_res = client.get("/api/products/downloads/center", headers=headers)
    assert center_res.status_code == 200
    assert center_res.json()["downloads"][0]["downloaded"] is True
    assert center_res.json()["downloads"][0]["downloaded_at"] is not None
