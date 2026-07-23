import os
import sys
import datetime
import requests
from dotenv import load_dotenv

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

from app.db.session import SessionLocal
from app.models.product import Product
from app.services.storage_service import storage_service
from app.shared.firebase.connection import db as fs_db
from app.api.products_router import resolve_media_url

def run_forensic_audit():
    print("=================================================================")
    print("      FORENSIC READ-ONLY AUDIT - B2, PRODUCT 123 & STORAGE      ")
    print("=================================================================")

    b2 = storage_service.b2_provider
    b2._ensure_auth()

    # ── PART 1 — VERIFY ACTIVE BACKBLAZE CONFIGURATION ──────────────────────
    print("\n--- PART 1: ACTIVE BACKBLAZE CONFIGURATION ---")
    active_provider = os.getenv("STORAGE_PROVIDER", "local").lower()
    masked_key_id = f"{b2.key_id[:4]}...{b2.key_id[-4:]}" if b2.key_id else "None"
    
    print(f"1. Active STORAGE_PROVIDER: {active_provider}")
    print(f"2. B2 Bucket Name:         {b2.bucket_name}")
    print(f"3. B2 Bucket ID:           {b2.bucket_id}")
    print(f"4. B2 Download URL:        {b2.download_url}")
    print(f"5. B2 API URL:             {b2.api_url}")
    print(f"6. Masked Key ID:          {masked_key_id}")
    print(f"7. B2 Authorization Token: {'Valid (Length ' + str(len(b2.auth_token)) + ')' if b2.auth_token else 'Failed'}")

    # Read-only permissions test via B2 API
    perms = {"list_files": False, "read_files": False, "list_versions": False}
    if b2.api_url and b2.auth_token and b2.bucket_id:
        url_list = f"{b2.api_url}/b2api/v2/b2_list_file_names"
        res_list = requests.post(url_list, json={"bucketId": b2.bucket_id, "maxFileCount": 1}, headers={"Authorization": b2.auth_token})
        perms["list_files"] = (res_list.status_code == 200)

        url_versions = f"{b2.api_url}/b2api/v2/b2_list_file_versions"
        res_versions = requests.post(url_versions, json={"bucketId": b2.bucket_id, "maxFileCount": 1}, headers={"Authorization": b2.auth_token})
        perms["list_versions"] = (res_versions.status_code == 200)

    print(f"8. Key Permissions -> listFiles: {perms['list_files']}, listFileVersions: {perms['list_versions']}")

    # ── PART 2 — VERIFY ACTUAL B2 BUCKET CONTENTS & VERSIONS ────────────────
    print("\n--- PART 2: ACTUAL B2 BUCKET OBJECT INVENTORY & VERSIONS ---")
    all_files = []
    all_versions = []

    if b2.api_url and b2.auth_token and b2.bucket_id:
        # 1. Fetch file names
        res_names = requests.post(f"{b2.api_url}/b2api/v2/b2_list_file_names", json={"bucketId": b2.bucket_id, "maxFileCount": 1000}, headers={"Authorization": b2.auth_token})
        if res_names.status_code == 200:
            all_files = res_names.json().get("files", [])
        
        # 2. Fetch all file versions
        res_vers = requests.post(f"{b2.api_url}/b2api/v2/b2_list_file_versions", json={"bucketId": b2.bucket_id, "maxFileCount": 1000}, headers={"Authorization": b2.auth_token})
        if res_vers.status_code == 200:
            all_versions = res_vers.json().get("files", [])

    print(f"Total Current Objects in Bucket '{b2.bucket_name}': {len(all_files)}")
    print(f"Total Historical Object Versions in Bucket '{b2.bucket_name}': {len(all_versions)}")

    print("\nCURRENT OBJECT KEYS IN B2:")
    for f in all_files:
        name = f.get("fileName")
        size = f.get("contentLength", 0)
        ctype = f.get("contentType")
        timestamp_ms = f.get("uploadTimestamp", 0)
        dt_str = datetime.datetime.fromtimestamp(timestamp_ms/1000.0, datetime.timezone.utc).isoformat() if timestamp_ms else "Unknown"
        print(f"  - Key: '{name}' | Size: {size} bytes | Type: {ctype} | Uploaded: {dt_str}")

    # ── PART 3 — PRODUCT 123 END-TO-END AUDIT ───────────────────────────────
    print("\n--- PART 3: PRODUCT 123 END-TO-END AUDIT ---")
    db = SessionLocal()
    try:
        p123 = db.query(Product).filter(Product.id == 123).first()
        print("SQLite Record 123:")
        if p123:
            print(f"  title:          {p123.title}")
            print(f"  storage_path:   {p123.storage_path}")
            print(f"  file_url:       {p123.file_url}")
            print(f"  thumbnail_path: {p123.thumbnail_path}")
            print(f"  thumbnail:      {p123.thumbnail}")
            print(f"  preview_path:   {p123.preview_path}")
            print(f"  preview:        {p123.preview}")

        print("\nAsset Audit Table for Product 123:")
        print(f"{'Asset':<15} | {'Database Reference':<65} | {'Exists in B2?':<12} | {'Size':<10} | {'MIME Type':<18} | {'Status'}")
        print("-" * 140)

        assets_to_check = [
            ("Paid Zip File", p123.storage_path if p123 else ""),
            ("Thumbnail", p123.thumbnail_path if p123 else ""),
            ("Preview Image", p123.preview_path if p123 else ""),
        ]

        for label, db_ref in assets_to_check:
            if not db_ref:
                print(f"{label:<15} | {'(None)':<65} | {'No':<12} | {'N/A':<10} | {'N/A':<18} | Missing in DB")
                continue
            
            b2_key = storage_service.resolve_storage_path_from_url(db_ref).replace(f"b2://{b2.bucket_name}/", "")
            
            match_file = next((f for f in all_files if f.get("fileName") == b2_key), None)
            if match_file:
                sz = match_file.get("contentLength", 0)
                ct = match_file.get("contentType", "unknown")
                status_str = "Real File" if sz > 1000 else "Test Placeholder File (16 bytes)"
                print(f"{label:<15} | {db_ref:<65} | {'YES':<12} | {str(sz) + ' B':<10} | {ct:<18} | {status_str}")
            else:
                print(f"{label:<15} | {db_ref:<65} | {'NO':<12} | {'0 B':<10} | {'N/A':<18} | Object Missing in B2")

    finally:
        db.close()

if __name__ == "__main__":
    run_forensic_audit()
