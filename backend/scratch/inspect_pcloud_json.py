import json
import os

json_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "src", "data", "products.json")
json_path = os.path.abspath(json_path)

if os.path.exists(json_path):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(f"Total products: {len(data)}")
    count = 0
    for p in data:
        link = p.get("pcloud_download_link") or p.get("pcloudDownloadLink")
        if link:
            count += 1
            print(f"ID: {p.get('id')} | Title: {p.get('title')} | Link: {link}")
    print(f"Total with pCloud links: {count}")
else:
    print(f"File not found: {json_path}")
