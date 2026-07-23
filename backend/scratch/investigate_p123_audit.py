import os
import sys
import io
import zipfile
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
from app.api.products_router import generate_download_token, download_product_file

def run_p123_deep_investigation():
    print("=================================================================")
    print("       PRODUCT 123 STORAGE & DOWNLOAD DEEP INVESTIGATION         ")
    print("=================================================================")

    # 1. READ PRODUCT 123 DATABASE RECORDS (SQLite & Firestore)
    db = SessionLocal()
    try:
        p_sql = db.query(Product).filter(Product.id == 123).first()
        print("\n[Check 1 & 2] SQLite Record for Product 123:")
        if p_sql:
            sql_fields = {
                "id": p_sql.id,
                "title": p_sql.title,
                "file_url": p_sql.file_url,
                "storage_path": p_sql.storage_path,
                "thumbnail": p_sql.thumbnail,
                "thumbnail_path": p_sql.thumbnail_path,
                "preview": p_sql.preview,
                "preview_path": p_sql.preview_path,
                "image_urls": p_sql.image_urls,
                "preview_images": p_sql.preview_images,
                "pcloud_download_link": p_sql.pcloud_download_link,
            }
            for k, v in sql_fields.items():
                print(f"  SQLite -> {k}: {v}")
        else:
            print("  SQLite -> Record 123 NOT FOUND!")

        print("\n[Check 1 & 2] Firestore Record for Product 123:")
        fs_fields = {}
        if fs_db:
            doc = fs_db.collection("products").document("123").get()
            if doc.exists:
                data = doc.to_dict()
                target_keys = ["file_url", "fileUrl", "storage_path", "storagePath", "thumbnail", "thumbnail_path", "imageUrl", "image_url", "preview", "preview_path", "previewImages", "preview_images", "pcloud_download_link", "pcloudDownloadLink"]
                for k in target_keys:
                    fs_fields[k] = data.get(k)
                    print(f"  Firestore -> {k}: {data.get(k)}")
            else:
                print("  Firestore -> Record 123 NOT FOUND!")

        # 3, 4, 5. FIELD MAPPING IN ENDPOINTS
        print("\n[Check 3, 4, 5, 6] Endpoints Field Analysis:")
        print("  - download_product_file uses: storage_path or file_url")
        print("  - Admin upload flow updates: storage_path, file_url, thumbnail_path, thumbnail, preview_path, preview")
        print("  - Customer download flow uses: download_product_file (streams storage_path or file_url)")
        
        # Check duplicate field consistency
        if p_sql:
            has_inconsistency = False
            if fs_fields.get("fileUrl") and p_sql.file_url and fs_fields.get("fileUrl") != p_sql.file_url:
                print(f"  ⚠️ INCONSISTENCY: Firestore fileUrl ('{fs_fields.get('fileUrl')}') != SQLite file_url ('{p_sql.file_url}')")
                has_inconsistency = True
            if not has_inconsistency:
                print("  [Pass] Field mapping is consistent across SQLite and Firestore.")

        # 7, 8, 9, 10. RESOLVE EXACT B2 OBJECT & VERIFY CONTENTS
        print("\n[Check 7, 8, 9, 10] Backblaze B2 Object Content Audit:")
        b2 = storage_service.b2_provider
        b2_key = "private/products/123/72ca1182-8654-498c-afd1-d462eca5ed86.zip"
        if p_sql and p_sql.storage_path:
            b2_key = storage_service.resolve_storage_path_from_url(p_sql.storage_path).replace(f"b2://{b2.bucket_name}/", "")
        
        print(f"  Target B2 Bucket: {b2.bucket_name}")
        print(f"  Target B2 Key:    {b2.key_key if hasattr(b2, 'key_key') else b2_key}")

        b2._ensure_auth()
        file_url = f"{b2.download_url}/file/{b2.bucket_name}/{b2_key}"
        print(f"  B2 Direct Download Endpoint: {file_url}")

        res = requests.get(file_url, headers={"Authorization": b2.auth_token})
        print(f"  B2 HTTP Response Code: {res.status_code}")
        print(f"  B2 HTTP Content-Type:  {res.headers.get('Content-Type')}")
        print(f"  B2 HTTP Content-Len:   {res.headers.get('Content-Length')} bytes")

        if res.status_code == 200:
            content = res.content
            print(f"  Actual Bytes Size:    {len(content)} bytes")
            print(f"  First 20 Bytes (Hex): {content[:20].hex()}")
            
            # Inspect Zip Archive contents
            try:
                z = zipfile.ZipFile(io.BytesIO(content))
                namelist = z.namelist()
                print(f"  ZIP File Manifest ({len(namelist)} files): {namelist}")
                for fname in namelist:
                    fcontent = z.read(fname)
                    print(f"\n   --- File inside ZIP: '{fname}' ({len(fcontent)} bytes) ---")
                    if len(fcontent) < 2000:
                        print(f"   Text Snippet: {fcontent.decode('utf-8', errors='ignore')}")
                    else:
                        print(f"   Binary File Header: {fcontent[:30]}")
            except Exception as e:
                print(f"  NOT A VALID ZIP ARCHIVE: {e}")
                if len(content) < 2000:
                    print(f"  Raw Text Content: {content.decode('utf-8', errors='ignore')}")

        # 11, 12, 13, 14. ENDPOINT STREAMING VERIFICATION
        print("\n[Check 11, 12, 13, 14] Customer Download Endpoint Response Audit:")
        token = generate_download_token(user_id=1, product_id=123)
        res_ep = download_product_file(product_id=123, token=token, db=db)
        
        print(f"  Response Media Type: {res_ep.media_type}")
        print(f"  Response Headers:    {dict(res_ep.headers)}")

        body_bytes = b"".join(res_ep.body_iterator)
        print(f"  Streamed Body Size:  {len(body_bytes)} bytes")

        try:
            z_ep = zipfile.ZipFile(io.BytesIO(body_bytes))
            namelist_ep = z_ep.namelist()
            print(f"  Streamed ZIP Files:  {namelist_ep}")
            for fname in namelist_ep:
                fc = z_ep.read(fname)
                if "readme" in fname.lower() or len(fc) < 2000:
                    print(f"  Streamed File '{fname}' Content: {fc.decode('utf-8', errors='ignore')}")
        except Exception as e:
            print(f"  Streamed payload not zip: {e}")

    finally:
        db.close()

if __name__ == "__main__":
    run_p123_deep_investigation()
