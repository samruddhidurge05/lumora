import firebase_admin
from firebase_admin import credentials, firestore

cert_path = "app/shared/firebase/serviceAccountKey.json"
if not firebase_admin._apps:
    cred = credentials.Certificate(cert_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()
docs = db.collection("products").stream()
print("Products in Firestore:")
for doc in docs:
    d = doc.to_dict()
    print(f"  DocID:{doc.id} | Title:{d.get('title')} | Status:{d.get('status')}")
