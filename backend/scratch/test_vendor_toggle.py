import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.platform_setting import PlatformSetting
from admin.routes.settings import _set_platform_setting

client = TestClient(app)

def test_feature_flag_endpoints():
    print("Testing GET /api/settings/features...")
    res = client.get("/api/settings/features")
    assert res.status_code == 200, f"Failed: {res.status_code} {res.text}"
    data = res.json()
    print("GET /api/settings/features output:", data)
    assert "vendor_enabled" in data
    assert "vendorSellingEnabled" in data
    assert "vendorRegistrationEnabled" in data
    print("[OK] GET /api/settings/features passed!")

def test_vendor_marketplace_disabled_enforcement():
    db = SessionLocal()
    try:
        print("\nSetting vendor_enabled = False in SQLite...")
        _set_platform_setting(db, "vendor_enabled", False, 1)
        _set_platform_setting(db, "vendorSellingEnabled", False, 1)
        _set_platform_setting(db, "vendorRegistrationEnabled", False, 1)

        print("Testing GET /api/settings/features when disabled...")
        res = client.get("/api/settings/features")
        assert res.status_code == 200
        data = res.json()
        assert data["vendor_enabled"] is False
        print("[OK] Feature flag reports vendor_enabled = False")

        print("Testing public vendor profile endpoint when disabled...")
        res_pub = client.get("/api/vendors/public/test_v/profile")
        print("Public profile response code when disabled:", res_pub.status_code)
        assert res_pub.status_code == 403
        assert "Vendor Marketplace is currently unavailable" in res_pub.text
        print("[OK] Public vendor endpoint correctly blocked with 403!")

        print("\nRestoring vendor_enabled = True...")
        _set_platform_setting(db, "vendor_enabled", True, 1)
        _set_platform_setting(db, "vendorSellingEnabled", True, 1)
        _set_platform_setting(db, "vendorRegistrationEnabled", True, 1)

        res_restored = client.get("/api/settings/features")
        assert res_restored.json()["vendor_enabled"] is True
        print("[OK] Feature flag restored to vendor_enabled = True!")

        res_pub_restored = client.get("/api/vendors/public/test_v/profile")
        assert res_pub_restored.status_code == 200
        print("[OK] Public vendor endpoint restored to 200 OK!")

    finally:
        db.close()

if __name__ == "__main__":
    test_feature_flag_endpoints()
    test_vendor_marketplace_disabled_enforcement()
    print("\nALL BACKEND VENDOR FEATURE FLAG TESTS PASSED CLEANLY!")
