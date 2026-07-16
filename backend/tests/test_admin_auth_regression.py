"""
test_admin_auth_regression.py
-----------------------------
Auth regression tests for the admin RC console audit.

Requirements: 14.1, 14.2, 14.3, 14.4
"""
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.user import Base, User
from app.models.audit_log import AuditLog
from app.db.session import get_db
from app.core.security import create_access_token, get_password_hash

# ── In-memory SQLite test database ────────────────────────────────────────────
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_admin_auth.db"
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
        # Admin user
        admin = User(
            name="Test Admin",
            email="admin@test.com",
            password_hash="firebase_managed",
            role="admin",
            is_active=True,
            is_verified=True,
            firebase_uid="admin-uid-123",
        )
        # Vendor user
        vendor = User(
            name="Test Vendor",
            email="vendor@test.com",
            password_hash=get_password_hash("testpassword"),
            role="vendor",
            is_active=True,
            is_verified=True,
        )
        db.add(admin)
        db.add(vendor)
        db.commit()
        db.refresh(admin)
        db.refresh(vendor)
    finally:
        db.close()

    yield

    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    """TestClient with DB override and rate limiter disabled."""
    # Patch Firebase connection and rate limiter before importing app
    with patch("app.shared.firebase.connection.firebase_connected", False), \
         patch("app.middleware.rate_limit.limiter.limit", lambda *a, **kw: lambda f: f):
        from app.main import app
        app.dependency_overrides[get_db] = override_get_db
        with TestClient(app) as c:
            yield c
        app.dependency_overrides.clear()


def _vendor_token() -> str:
    """Return a valid JWT for the test vendor user."""
    db = TestingSessionLocal()
    try:
        vendor = db.query(User).filter(User.email == "vendor@test.com").first()
        return create_access_token({"sub": str(vendor.id)})
    finally:
        db.close()


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_no_auth_returns_401(client):
    """Req 14.1: GET /api/admin/orders/ with no header → 401."""
    response = client.get("/api/admin/orders/")
    assert response.status_code in (401, 403), (
        f"Expected 401 or 403, got {response.status_code}"
    )


def test_vendor_jwt_returns_403(client):
    """Req 14.2: GET /api/admin/orders/ with vendor JWT → 403."""
    token = _vendor_token()
    response = client.get(
        "/api/admin/orders/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403, (
        f"Expected 403 for vendor role, got {response.status_code}: {response.text}"
    )


def test_admin_login_success_writes_audit_log(client):
    """Req 14.3: POST /api/admin/auth/login → 200 + access_token + admin_login_success audit log."""
    fake_claims = {
        "uid": "admin-uid-123",
        "email": "admin@test.com",
        "email_verified": True,
    }
    with patch("admin.routes.auth.verify_firebase_id_token", return_value=fake_claims):
        response = client.post(
            "/api/admin/auth/login",
            json={"idToken": "fake-valid-firebase-token"},
        )

    assert response.status_code == 200, (
        f"Expected 200 for admin login, got {response.status_code}: {response.text}"
    )
    data = response.json()
    assert "access_token" in data, "access_token missing from login response"

    # Verify audit log was written
    db = TestingSessionLocal()
    try:
        log = db.query(AuditLog).filter(
            AuditLog.action == "admin_login_success"
        ).first()
        assert log is not None, "Expected admin_login_success AuditLog entry, found none"
    finally:
        db.close()


def test_non_admin_login_failure_writes_audit_log(client):
    """Req 14.4: POST /api/admin/auth/login with customer email → 403 + admin_login_failure audit log."""
    fake_claims = {
        "uid": "customer-uid-456",
        "email": "customer@test.com",
        "email_verified": True,
    }
    with patch("admin.routes.auth.verify_firebase_id_token", return_value=fake_claims):
        response = client.post(
            "/api/admin/auth/login",
            json={"idToken": "fake-customer-token"},
        )

    assert response.status_code == 403, (
        f"Expected 403 for non-admin login, got {response.status_code}: {response.text}"
    )

    # Verify failure audit log was written
    db = TestingSessionLocal()
    try:
        log = db.query(AuditLog).filter(
            AuditLog.action == "admin_login_failure"
        ).first()
        assert log is not None, "Expected admin_login_failure AuditLog entry, found none"
    finally:
        db.close()
