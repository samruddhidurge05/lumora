import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.storage_service import storage_service

def test():
    test_path = "private/products/128/product.zip"
    resolved = storage_service.resolve_storage_path_from_url(test_path)
    print(f"Original path: {test_path}")
    print(f"Resolved path: {resolved}")
    print(f"Resolved starts with b2://: {resolved.startswith('b2://')}")
    print(f"B2 status: {storage_service.b2_provider.b2_status}")

if __name__ == "__main__":
    test()
