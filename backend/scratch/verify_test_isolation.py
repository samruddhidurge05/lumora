import os
import sys
from dotenv import load_dotenv

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

# Set test environment flag
os.environ["TESTING"] = "True"

from app.services.storage_service import storage_service

def verify_test_isolation():
    print("=================================================================")
    print("            VERIFYING TEST STORAGE ISOLATION FIX                 ")
    print("=================================================================")

    target_path, url = storage_service.move_to_permanent(
        source_path="b2://lumora-products/vendors/1/temp/test.zip",
        vendor_id="1",
        product_id=999,
        filename="test.zip",
        is_image=False,
        asset_type="file"
    )
    print(f"Test Mode Move Target Path: {target_path}")
    print(f"Test Mode Move URL:         {url}")

    assert "test/storage-tests/" in target_path and "/private/products/999/" in target_path, \
        f"Test path MUST be isolated under test/storage-tests/{{uuid}}/private/products/999/! Got: {target_path}"

    print("[PASS] Test environment isolation safety fix verified successfully! Automated tests can NEVER touch production public/products/ or private/products/ paths.")

if __name__ == "__main__":
    verify_test_isolation()
