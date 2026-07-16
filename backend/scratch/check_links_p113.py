import sys, os
sys.path.append(os.getcwd())

import firebase_admin
from firebase_admin import credentials, firestore
from app.db.session import SessionLocal
from app.models.product import Product as ProductModel

db_session = SessionLocal()
product = db_session.query(ProductModel).filter(ProductModel.id == 113).first()
if product:
    print(f"SQLite product 113 file_url: {product.file_url}")
    print(f"SQLite product 113 pcloud_download_link: {product.pcloud_download_link}")
else:
    print("Product 113 not found in SQLite.")
db_session.close()

cert_path = "app/shared/firebase/serviceAccountKey.json"
if not firebase_admin._apps:
    cred = credentials.Certificate(cert_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()
doc = db.collection("products").document("113").get()
if doc.exists:
    d = doc.to_dict()
    print(f"Firestore product 113 file_url: {d.get('file_url')}")
    print(f"Firestore product 113 pcloud_download_link: {d.get('pcloud_download_link')}")
else:
    print("Product 113 not found in Firestore.")
