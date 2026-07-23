import os
import sys
import requests
from dotenv import load_dotenv

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

from app.services.storage_service import storage_service

def search_for_real_files():
    print("=================================================================")
    print("        SEARCHING FOR REAL PRODUCT FILES ON DISK & B2            ")
    print("=================================================================")

    # 1. Search local uploads directory
    uploads_dir = os.path.join(backend_dir, "uploads")
    print(f"\n[1. Local Disk Search] Scanning '{uploads_dir}':")
    found_local = []
    if os.path.exists(uploads_dir):
        for root, dirs, files in os.walk(uploads_dir):
            for file in files:
                filepath = os.path.join(root, file)
                size = os.path.getsize(filepath)
                relpath = os.path.relpath(filepath, backend_dir)
                found_local.append((relpath, size))
                print(f"  - {relpath} ({size} bytes)")
    if not found_local:
        print("  (No files found in backend/uploads/)")

    # 2. Search B2 Bucket
    print(f"\n[2. Backblaze B2 Search] Scanning bucket '{storage_service.b2_provider.bucket_name}':")
    b2 = storage_service.b2_provider
    if b2.is_available():
        b2._ensure_auth()
        url = f"{b2.api_url}/b2api/v2/b2_list_file_names"
        payload = {"bucketId": b2.bucket_id, "maxFileCount": 1000}
        headers = {"Authorization": b2.auth_token}
        res = requests.post(url, json=payload, headers=headers)
        if res.status_code == 200:
            files = res.json().get("files", [])
            for f in files:
                name = f.get("fileName")
                size = f.get("contentLength", 0)
                contentType = f.get("contentType")
                print(f"  - B2: {name} ({size} bytes, type: {contentType})")
        else:
            print(f"  B2 List Error: {res.status_code} - {res.text}")

if __name__ == "__main__":
    search_for_real_files()
