import os
import sys
import requests
from dotenv import load_dotenv

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

from app.services.storage_service import storage_service

def test_b2_download_auth():
    print("=================================================================")
    print("       TESTING B2 DOWNLOAD AUTHORIZATION FOR PUBLIC ASSETS       ")
    print("=================================================================")

    b2 = storage_service.b2_provider
    b2._ensure_auth()

    # 1. Test request without Authorization header
    test_key = "public/products/123/thumbnail/63906cb1-0acd-4100-868e-a0d5f2c0a044.png"
    direct_url = f"{b2.download_url}/file/{b2.bucket_name}/{test_key}"

    print(f"Direct URL (No Header): {direct_url}")
    res_no_auth = requests.get(direct_url)
    print(f"Status (No Header):     {res_no_auth.status_code}")
    print(f"Response:               {res_no_auth.text}")

    # 2. Test request WITH Authorization header
    res_auth = requests.get(direct_url, headers={"Authorization": b2.auth_token})
    print(f"\nStatus (With Auth Header): {res_auth.status_code}")
    print(f"Content Size:              {len(res_auth.content)} bytes")

    # 3. Test b2_get_download_authorization API to generate a public URL token
    url_auth_endpoint = f"{b2.api_url}/b2api/v2/b2_get_download_authorization"
    resp_token = requests.post(
        url_auth_endpoint,
        headers={"Authorization": b2.auth_token},
        json={
            "bucketId": b2.bucket_id,
            "fileNamePrefix": "public/",
            "validDurationInSeconds": 86400  # 24 hours
        }
    )
    print(f"\nb2_get_download_authorization Status: {resp_token.status_code}")
    if resp_token.status_code == 200:
        token_data = resp_token.json()
        dl_auth_token = token_data.get("authorizationToken")
        print(f"Generated Download Auth Token (Length {len(dl_auth_token)})")
        
        # Test loading image with ?Authorization= token in URL
        url_with_token = f"{direct_url}?Authorization={dl_auth_token}"
        res_with_token = requests.get(url_with_token)
        print(f"Status (URL with ?Authorization=): {res_with_token.status_code}")
        print(f"Content Size:                     {len(res_with_token.content)} bytes")

if __name__ == "__main__":
    test_b2_download_auth()
