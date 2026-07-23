import os
import sqlite3
from app.services.storage_service import storage_service

# We check both test.db and lumora.db to find all product records
dbs = ["test.db", "lumora.db"]

for db_name in dbs:
    db_path = os.path.join(r"c:\Users\samruddhi\lumora final\lumora\backend", db_name)
    if not os.path.exists(db_path):
        continue
    
    print(f"\n==================== Database: {db_name} ====================")
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        # Check if column pcloud_download_link exists
        cur.execute("PRAGMA table_info(products)")
        cols = [col["name"] for col in cur.fetchall()]
        if "pcloud_download_link" not in cols:
            print("pcloud_download_link column does not exist in products table.")
            conn.close()
            continue
            
        cur.execute("SELECT id, title, pcloud_download_link, storage_path, file_url FROM products WHERE pcloud_download_link IS NOT NULL OR file_url LIKE '%pcloud%'")
        rows = cur.fetchall()
        print(f"Found {len(rows)} products with pCloud references.")
        print("| Product ID | Title | pCloud Link Exists | B2 Storage Path | B2 Exists | Action |")
        print("| --- | --- | --- | --- | --- | --- |")
        for row in rows:
            pcloud_link = row["pcloud_download_link"]
            file_url = row["file_url"]
            storage_path = row["storage_path"]
            
            pcloud_exists = "YES" if pcloud_link else "NO (via file_url)"
            
            b2_exists = "NO"
            if storage_path and storage_path.startswith("b2://"):
                try:
                    if storage_service.exists(storage_path):
                        b2_exists = "YES"
                except Exception as e:
                    b2_exists = f"ERROR ({e})"
            
            action = "None"
            if b2_exists == "YES":
                action = "Clear pCloud reference"
            elif storage_path:
                action = "Verify B2 path / Manual upload"
            else:
                action = "Upload to B2 first"
                
            print(f"| {row['id']} | {row['title']} | {pcloud_exists} | {storage_path} | {b2_exists} | {action} |")
        
        conn.close()
    except Exception as e:
        print(f"Error querying {db_name}: {e}")
