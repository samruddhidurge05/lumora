"""
test_upload_auth.py
-------------------
Upload auth enforcement tests for the admin RC console audit.

Requirements: 16
"""
import io
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.user import Base, User
from app.db.session import get_db
from app.core.security import create_access_token, get_password_hash

# ── In-memory SQLite test database ────────────────────────────────────────────
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_upload_auth.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_test_db():
    """Create tables and seed test users before each test; drop after."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        admin = User(
            name="Test Admin",
            email="admin@upload-test.com",
            password_hash="firebase_managed",
            role="admin",
            is_active=True,
            is_verified=True,
        )
        customer = User(
            name="Test Customer",
            email="customer@upload-test.com",
            password_hash=get_password_hash("testpassword"),
            role="customer",
            is_active=True,
            is_verified=True,
        )
        db.add(admin)
        db.add(customer)
        db.commit()
    finally:
        db.close()

    yield

    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    """TestClient with DB override + firebase disabled + storage service mocked."""
    fake_storage_result = {
        "url": "https://cdn.example.com/file.zip",
        "storage_path": "test/file.zip",
        "hash": "abc123def456",
    }
    mock_storage = MagicMock()
    mock_storage.upload.return_value = fake_storage_result

    with patch("app.shared.firebase.connection.firebase_connected", False), \
         patch("app.services.storage_service.storage_service", mock_storage):
        from app.main import app
        app.dependency_overrides[get_db] = override_get_db
        with TestClient(app) as c:
            yield c
        app.dependency_overrides.clear()


def _token_for_role(role: str) -> str:
    db = TestingSessionLocal()
    try:
        email = "admin@upload-test.com" if role == "admin" else "customer@upload-test.com"
        user = db.query(User).filter(User.email == email).first()
        return create_access_token({"sub": str(user.id)})
    finally:
        db.close()


def _fake_file(filename: str = "test.zip", content: bytes = b"fake zip content"):
    return ("file", (filename, io.BytesIO(content), "application/zip"))


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_admin_can_upload_file(client):
    """Req 16: Admin JWT → POST /api/uploads/ → 200 with url in response."""
    token = _token_for_role("admin")
    response = client.post(
        "/api/uploads/",
        files=[_fake_file()],
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, (
        f"Expected 200 for admin upload, got {response.status_code}: {response.text}"
    )
    data = response.json()
    assert "url" in data, f"url missing from upload response: {data}"


def test_admin_can_upload_image(client):
    """Req 16: Admin JWT → POST /api/uploads/image → 200."""
    token = _token_for_role("admin")
    response = client.post(
        "/api/uploads/image",
        files=[("file", ("test.png", io.BytesIO(b"fake png content"), "image/png"))],
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, (
        f"Expected 200 for admin image upload, got {response.status_code}: {response.text}"
    )


def test_unauthenticated_upload_rejected(client):
    """Req 16: No JWT → POST /api/uploads/ → 401 or 422."""
    response = client.post(
        "/api/uploads/",
        files=[_fake_file()],
    )
    assert response.status_code in (401, 422), (
        f"Expected 401 or 422 for unauthenticated upload, got {response.status_code}: {response.text}"
    )


def test_customer_upload_rejected(client):
    """Req 16: Customer JWT → POST /api/uploads/ → 403."""
    token = _token_for_role("customer")
    response = client.post(
        "/api/uploads/",
        files=[_fake_file()],
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403, (
        f"Expected 403 for customer upload, got {response.status_code}: {response.text}"
    )
