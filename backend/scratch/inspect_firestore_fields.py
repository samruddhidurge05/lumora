import firebase_admin
from firebase_admin import credentials, firestore
import os

cert_path = "app/shared/firebase/serviceAccountKey.json" if os.path.exists("app/shared/firebase/serviceAccountKey.json") else "../app/shared/firebase/serviceAccountKey.json"
if not firebase_admin._apps:
    cred = credentials.Certificate(cert_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

for pid in ["108", "109", "111", "112"]:
    doc = db.collection("products").document(pid).get()
    if doc.exists:
        data = doc.to_dict()
        print(f"ID={pid} title={data.get('title')}")
        print(f"  thumbnail: {data.get('thumbnail')}")
        print(f"  preview: {data.get('preview')}")
        print(f"  image_urls: {data.get('image_urls')}")
        # Print all keys to see if there are other keys
        print("  All keys:", list(data.keys()))
    else:
        print(f"ID={pid} not found in Firestore")
