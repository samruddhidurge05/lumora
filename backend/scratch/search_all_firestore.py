import firebase_admin
from firebase_admin import credentials, firestore
import os

cert_path = "app/shared/firebase/serviceAccountKey.json" if os.path.exists("app/shared/firebase/serviceAccountKey.json") else "../app/shared/firebase/serviceAccountKey.json"
if not firebase_admin._apps:
    cred = credentials.Certificate(cert_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()
docs = db.collection("products").stream()

print("All documents in 'products' collection:")
count = 0
for d in docs:
    data = d.to_dict()
    # Check if this matches Resume Template Pack, digital planner, or Instagram content calendar
    title = data.get("title") or data.get("name") or ""
    prod_id = data.get("id")
    pcloud = data.get("pcloud_download_link") or data.get("pcloudDownloadLink")
    
    # Print the ones that have resume, planner, calendar or id >= 104
    if "resume" in str(title).lower() or "planner" in str(title).lower() or "calendar" in str(title).lower() or (prod_id and str(prod_id).isdigit() and int(prod_id) >= 104):
        print(f"Doc ID: {d.id} | Internal Field id: {prod_id} | Title: {title} | pCloud Link: {pcloud}")
        count += 1

print(f"\nTotal matched documents: {count}")
