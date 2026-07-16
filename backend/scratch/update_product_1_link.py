import sys, os
sys.path.append(os.getcwd())

import firebase_admin
from firebase_admin import credentials, firestore
from app.db.session import SessionLocal
from app.models.product import Product as ProductModel

# 1. Update SQLite for Product 1
db_session = SessionLocal()
product = db_session.query(ProductModel).filter(ProductModel.id == 1).first()
if product:
    print(f"Found product 1 in SQLite: {product.title}")
    product.file_url = "https://u.pcloud.link/publink/show?code=XZnh1r5ZAofPXWUuOnhfFBpOrKSXQB5bCCQX"
    product.pcloud_download_link = "https://u.pcloud.link/publink/show?code=XZnh1r5ZAofPXWUuOnhfFBpOrKSXQB5bCCQX"
    db_session.commit()
    print("Successfully updated product 1 link in SQLite.")
else:
    print("Product 1 not found in SQLite.")
db_session.close()

# 2. Update Firestore for Product 1
cert_path = "app/shared/firebase/serviceAccountKey.json"
if not firebase_admin._apps:
    cred = credentials.Certificate(cert_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()
doc_ref = db.collection("products").document("1")
try:
    doc = doc_ref.get()
    if doc.exists:
        print(f"Found product 1 in Firestore: {doc.to_dict().get('title')}")
        doc_ref.update({
            "file_url": "https://u.pcloud.link/publink/show?code=XZnh1r5ZAofPXWUuOnhfFBpOrKSXQB5bCCQX",
            "fileUrl": "https://u.pcloud.link/publink/show?code=XZnh1r5ZAofPXWUuOnhfFBpOrKSXQB5bCCQX",
            "pcloud_download_link": "https://u.pcloud.link/publink/show?code=XZnh1r5ZAofPXWUuOnhfFBpOrKSXQB5bCCQX",
            "pcloudDownloadLink": "https://u.pcloud.link/publink/show?code=XZnh1r5ZAofPXWUuOnhfFBpOrKSXQB5bCCQX"
        })
        print("Successfully updated product 1 link in Firestore.")
    else:
        print("Product 1 not found in Firestore.")
except Exception as e:
    print(f"Firestore update failed (expected due to quota limits): {e}")
