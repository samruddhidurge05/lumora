import firebase_admin
from firebase_admin import credentials, firestore
import os

cert_path = "app/shared/firebase/serviceAccountKey.json" if os.path.exists("app/shared/firebase/serviceAccountKey.json") else "../app/shared/firebase/serviceAccountKey.json"
if not firebase_admin._apps:
    cred = credentials.Certificate(cert_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

docs = db.collection("products").stream()
for doc in docs:
    data = doc.to_dict()
    # Check for any fields containing pcloud
    pcloud_fields = {k: v for k, v in data.items() if "pcloud" in k.lower() or (isinstance(v, str) and "pcloud" in v.lower())}
    if pcloud_fields:
        print(f"ID={doc.id} title={data.get('title')}: {pcloud_fields}")
