"""
test_product_patch_endpoints.py
--------------------------------
Unit tests for the PATCH /status and PATCH /featured endpoints introduced in
Task 5.2 / 5.3 of the firestore-product-sync-cleanup spec, plus a regression
test confirming PUT still calls sync_product_to_firestore.

Uses:
- FastAPI TestClient with a fresh FastAPI() app that mounts the products router
- An in-memory SQLite database (no file on disk)
- unittest.mock.patch to mock sync_product_to_firestore, require_admin_role,
  and log_admin_action so no real Firestore calls or auth checks are made

**Validates: Requirements 1.8, 3.1, 3.2**
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.user import Base, User
from app.models.product import Product
from app.db.session import get_db

# Import all models so Base.metadata has every table definition before create_all
import app.models  # noqa: F401  (side-effect import)

# ── In-memory SQLite setup ────────────────────────────────────────────────────
# StaticPool forces all sessions/connections to share the same in-memory DB
# so that Base.metadata.create_all and the test sessions see identical data.

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Dependency override: yield an in-memory SQLite session."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Fake admin user returned by require_admin_role override ──────────────────

class _FakeAdmin:
    """Plain Python object that satisfies the admin_user dependency interface."""
    id = 1
    name = "Test Admin"
    email = "admin@test.com"
    role = "admin"


FAKE_ADMIN = _FakeAdmin()


# ── App factory ──────────────────────────────────────────────────────────────

def build_app(sync_mock: MagicMock) -> FastAPI:
    """
    Build a minimal FastAPI app with the products admin router mounted.
    All external dependencies are overridden or patched:
      - get_db      → in-memory SQLite
      - require_admin_role → returns FAKE_ADMIN (no auth)
      - sync_product_to_firestore → provided sync_mock
      - log_admin_action → no-op MagicMock
    """
    with patch(
        "admin.routes.products.sync_product_to_firestore", sync_mock
    ), patch(
        "app.services.product_service.sync_product_to_firestore", sync_mock
    ), patch(
        "admin.routes.products.log_admin_action", MagicMock()
    ):
        # Import router INSIDE the patch context so patched names are used
        from admin.routes.products import router  # noqa: PLC0415
        from admin.validators.admin_auth import require_admin_role  # noqa: PLC0415

        app = FastAPI()
        app.include_router(router, prefix="/products")
        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[require_admin_role] = lambda: FAKE_ADMIN
        return app


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_db():
    """Create all tables before each test, drop them after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sync_mock():
    return MagicMock()


@pytest.fixture
def client(sync_mock):
    """TestClient backed by in-memory SQLite with sync mocked."""
    with patch(
        "admin.routes.products.sync_product_to_firestore", sync_mock
    ), patch(
        "app.services.product_service.sync_product_to_firestore", sync_mock
    ), patch(
        "admin.routes.products.log_admin_action", MagicMock()
    ):
        from admin.routes.products import router
        from admin.validators.admin_auth import require_admin_role

        app = FastAPI()
        app.include_router(router, prefix="/products")
        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[require_admin_role] = lambda: FAKE_ADMIN

        with TestClient(app) as c:
            yield c


# ── Helpers ──────────────────────────────────────────────────────────────────

def create_test_product(client: TestClient, **overrides) -> dict:
    """POST a minimal product and return the JSON response dict."""
    payload = {
        "title": "Test Product",
        "price": 9.99,
        "status": "published",
        "featured": False,
        **overrides,
    }
    resp = client.post("/products/", json=payload)
    assert resp.status_code == 201, f"Failed to create product: {resp.text}"
    return resp.json()


# ── PATCH /status tests ───────────────────────────────────────────────────────

class TestPatchStatusEndpoint:
    """Tests for PATCH /{product_id}/status"""

    def test_patch_status_endpoint_200(self, client, sync_mock):
        """
        POST a product then PATCH status to 'published' → HTTP 200
        and sync_product_to_firestore is called.

        Validates: Requirements 1.8, 3.1
        """
        product = create_test_product(client, status="draft")
        product_id = product["id"]

        # Reset call count after the POST's sync call
        sync_mock.reset_mock()

        resp = client.patch(f"/products/{product_id}/status", json={"status": "published"})

        assert resp.status_code == 200, (
            f"Expected 200 for PATCH status=published, got {resp.status_code}: {resp.text}"
        )
        sync_mock.assert_called_once()

    def test_patch_status_endpoint_draft(self, client, sync_mock):
        """
        PATCH status to 'draft' → HTTP 200 and response body has status='draft'.

        Validates: Requirements 1.8
        """
        product = create_test_product(client, status="published")
        product_id = product["id"]
        sync_mock.reset_mock()

        resp = client.patch(f"/products/{product_id}/status", json={"status": "draft"})

        assert resp.status_code == 200, (
            f"Expected 200 for PATCH status=draft, got {resp.status_code}: {resp.text}"
        )
        body = resp.json()
        assert body["status"] == "draft", (
            f"Expected status='draft' in response, got: {body.get('status')}"
        )

    def test_patch_status_endpoint_invalid_value(self, client, sync_mock):
        """
        PATCH with status='pending' (not in Literal['published','draft']) → HTTP 422.

        Validates: Requirements 1.8
        """
        product = create_test_product(client)
        product_id = product["id"]
        sync_mock.reset_mock()

        resp = client.patch(f"/products/{product_id}/status", json={"status": "pending"})

        assert resp.status_code == 422, (
            f"Expected 422 for invalid status value, got {resp.status_code}: {resp.text}"
        )

    def test_patch_status_endpoint_404(self, client, sync_mock):
        """
        PATCH status for a non-existent product_id → HTTP 404.

        Validates: Requirements 1.8
        """
        resp = client.patch("/products/99999/status", json={"status": "published"})

        assert resp.status_code == 404, (
            f"Expected 404 for non-existent product, got {resp.status_code}: {resp.text}"
        )
        sync_mock.assert_not_called()


# ── PATCH /featured tests ─────────────────────────────────────────────────────

class TestPatchFeaturedEndpoint:
    """Tests for PATCH /{product_id}/featured"""

    def test_patch_featured_endpoint_200(self, client, sync_mock):
        """
        PATCH featured=true → HTTP 200 and sync_product_to_firestore is called.

        Validates: Requirements 1.8, 3.1
        """
        product = create_test_product(client, featured=False)
        product_id = product["id"]
        sync_mock.reset_mock()

        resp = client.patch(f"/products/{product_id}/featured", json={"featured": True})

        assert resp.status_code == 200, (
            f"Expected 200 for PATCH featured=true, got {resp.status_code}: {resp.text}"
        )
        sync_mock.assert_called_once()

    def test_patch_featured_endpoint_false(self, client, sync_mock):
        """
        PATCH featured=false → HTTP 200 and response body has featured=false.

        Validates: Requirements 1.8
        """
        product = create_test_product(client, featured=True)
        product_id = product["id"]
        sync_mock.reset_mock()

        resp = client.patch(f"/products/{product_id}/featured", json={"featured": False})

        assert resp.status_code == 200, (
            f"Expected 200 for PATCH featured=false, got {resp.status_code}: {resp.text}"
        )
        body = resp.json()
        assert body["featured"] is False, (
            f"Expected featured=False in response, got: {body.get('featured')}"
        )

    def test_patch_featured_endpoint_404(self, client, sync_mock):
        """
        PATCH featured for a non-existent product_id → HTTP 404.

        Validates: Requirements 1.8
        """
        resp = client.patch("/products/99999/featured", json={"featured": True})

        assert resp.status_code == 404, (
            f"Expected 404 for non-existent product, got {resp.status_code}: {resp.text}"
        )
        sync_mock.assert_not_called()


# ── PUT regression test ───────────────────────────────────────────────────────

class TestPutEndpointRegression:
    """Confirm that the existing PUT endpoint still calls sync_product_to_firestore."""

    def test_put_endpoint_still_syncs_firestore(self, client, sync_mock):
        """
        PUT a full product update → sync_product_to_firestore is still called
        (no regression introduced by adding PATCH endpoints).

        Validates: Requirements 3.1, 3.2
        """
        product = create_test_product(client)
        product_id = product["id"]
        sync_mock.reset_mock()

        update_payload = {
            "title": "Updated Title",
            "price": 19.99,
        }
        resp = client.put(f"/products/{product_id}", json=update_payload)

        assert resp.status_code == 200, (
            f"Expected 200 for PUT update, got {resp.status_code}: {resp.text}"
        )
        sync_mock.assert_called_once(), (
            "sync_product_to_firestore must still be called after PUT update"
        )
