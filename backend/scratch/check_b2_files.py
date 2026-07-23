import os
import sys
import sqlite3

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.storage_service import storage_service

def check_b2():
    db_path = os.path.join(r"c:\Users\samruddhi\lumora final\lumora\backend", "test.db")
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return
        
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        cur.execute("SELECT id, title, pcloud_download_link, storage_path, file_url FROM products WHERE pcloud_download_link IS NOT NULL OR file_url LIKE '%pcloud%'")
        rows = cur.fetchall()
        
        print("Checking B2 objects for all products with pCloud references...")
        for row in rows:
            p_id = row["id"]
            title = row["title"]
            pcloud_link = row["pcloud_download_link"]
            file_url = row["file_url"] or ""
            storage_path = row["storage_path"]
            
            print(f"\nProduct ID {p_id}: {title}")
            print(f"  Current pCloud/file_url: {file_url}")
            print(f"  Current storage_path: {storage_path}")
            
            if storage_path:
                try:
                    exists = storage_service.exists(storage_path)
                    print(f"  Storage path exists in B2? {exists}")
                except Exception as e:
                    print(f"  Error checking B2: {e}")
            else:
                # Check standard prefix "private/products/{p_id}/"
                b2 = storage_service.b2_provider
                if b2.is_available():
                    prefix = f"private/products/{p_id}/"
                    url_endpoint = f"{b2.api_url}/b2api/v2/b2_list_file_names"
                    import requests
                    res = requests.post(
                        url_endpoint,
                        headers={"Authorization": b2.auth_token},
                        json={
                            "bucketId": b2.bucket_id,
                            "startFileName": prefix,
                            "maxFileCount": 10
                        },
                        timeout=10
                    )
                    if res.status_code == 200:
                        files = res.json().get("files", [])
                        matching_files = [f for f in files if f["fileName"].startswith(prefix)]
                        if matching_files:
                            print(f"  Found matching files in B2 private prefix '{prefix}':")
                            for mf in matching_files:
                                print(f"    - Name: {mf['fileName']} (ID: {mf['fileId']}, Size: {mf['size']})")
                        else:
                            print(f"  No files found under prefix '{prefix}' in B2.")
                    else:
                        print(f"  Failed to list B2 files for prefix '{prefix}': {res.text}")
                else:
                    print("  B2 provider is not available/authorized.")
                    
        conn.close()
    except Exception as e:
        print(f"Database error: {e}")

if __name__ == "__main__":
    check_b2()
