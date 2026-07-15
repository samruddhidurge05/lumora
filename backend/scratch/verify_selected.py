import firebase_admin
from firebase_admin import credentials, firestore
import os

cert_path = "app/shared/firebase/serviceAccountKey.json" if os.path.exists("app/shared/firebase/serviceAccountKey.json") else "../app/shared/firebase/serviceAccountKey.json"
if not firebase_admin._apps:
    cred = credentials.Certificate(cert_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

print("Selected products in Firestore:")
for pid in [1, 108, 109, 111, 112]:
    doc = db.collection("products").document(str(pid)).get()
    if doc.exists:
        data = doc.to_dict()
        print(f"ID: {pid} | Title: {data.get('title')} | pcloud_download_link: {data.get('pcloud_download_link')} | pcloudDownloadLink: {data.get('pcloudDownloadLink')}")
    else:
        print(f"ID: {pid} not found in Firestore")
