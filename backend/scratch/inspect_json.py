import json
import os

json_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "src", "data", "products.json")
json_path = os.path.abspath(json_path)

if os.path.exists(json_path):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(f"Total products in JSON: {len(data)}")
    for p in data:
        title = p.get("title", "").lower()
        if "resume" in title or "planner" in title or "calendar" in title:
            print(f"ID: {p.get('id')} | Title: {p.get('title')} | Link: {p.get('pcloud_download_link')} / {p.get('pcloudDownloadLink')}")
else:
    print(f"File not found: {json_path}")
