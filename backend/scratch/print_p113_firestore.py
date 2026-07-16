import firebase_admin
from firebase_admin import credentials, firestore

cert_path = "app/shared/firebase/serviceAccountKey.json"
if not firebase_admin._apps:
    cred = credentials.Certificate(cert_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()
doc = db.collection("products").document("113").get()
if doc.exists:
    d = doc.to_dict()
    print("Firestore doc 113 fields:")
    for k, v in d.items():
        print(f"  {k}: {v}")
else:
    print("Doc 113 not found in Firestore.")
