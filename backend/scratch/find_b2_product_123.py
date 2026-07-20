import os
import sys
import requests
from dotenv import load_dotenv

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

from app.services.storage_service import storage_service

def list_b2_objects():
    print("=================================================================")
    print("               LISTING BACKBLAZE B2 BUCKET OBJECTS               ")
    print("=================================================================")
    
    b2 = storage_service.b2_provider
    print(f"B2 Key ID: {b2.key_id}")
    print(f"B2 Bucket Name: {b2.bucket_name}")
    print(f"B2 Bucket ID: {b2.bucket_id}")
    print(f"B2 Available? {b2.is_available()}")

    if not b2.is_available():
        print("Attempting _ensure_auth()...")
        try:
            b2._ensure_auth()
        except Exception as e:
            print(f"Auth error: {e}")

    if b2.api_url and b2.auth_token and b2.bucket_id:
        url = f"{b2.api_url}/b2api/v2/b2_list_file_names"
        payload = {"bucketId": b2.bucket_id, "maxFileCount": 1000}
        headers = {"Authorization": b2.auth_token}
        res = requests.post(url, json=payload, headers=headers)
        if res.status_code == 200:
            files = res.json().get("files", [])
            print(f"\nTotal Files in B2 Bucket '{b2.bucket_name}': {len(files)}")
            for f in files:
                fileName = f.get("fileName")
                size = f.get("contentLength", 0)
                contentType = f.get("contentType")
                print(f" - {fileName} ({size} bytes, {contentType})")
        else:
            print(f"Error listing files: {res.status_code} - {res.text}")

if __name__ == "__main__":
    list_b2_objects()
