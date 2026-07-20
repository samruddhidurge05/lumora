import os
import sys
from fastapi.testclient import TestClient

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app

def test_middleware():
    print("=================================================================")
    print("      TESTING DUPLICATE /api/api/ PATH REWRITE MIDDLEWARE        ")
    print("=================================================================")

    client = TestClient(app)
    
    # Request with double /api/api/ prefix
    url_double = "/api/api/products/123/download-file?token=invalid_token"
    res = client.get(url_double)
    
    print(f"Request URL: {url_double}")
    print(f"Response Code: {res.status_code}")
    print(f"Response Body: {res.json()}")

    # Verify that it reaches the router endpoint (returns 403 Invalid Token rather than 404 Not Found!)
    assert res.status_code == 403, f"Expected 403 Forbidden for invalid token, but got {res.status_code}"
    print("[PASS] Duplicate /api/api/ path prefix successfully rewritten to /api/ and routed to products router!")

if __name__ == "__main__":
    test_middleware()
