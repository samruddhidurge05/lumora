import sys, os
sys.path.append(os.getcwd())

import firebase_admin
from firebase_admin import credentials, firestore
from app.db.session import SessionLocal
from app.models.product import Product as ProductModel

# 1. Update SQLite
db_session = SessionLocal()
product = db_session.query(ProductModel).filter(ProductModel.id == 113).first()
if product:
    print(f"Found product in SQLite: {product.title}")
    product.file_url = "https://u.pcloud.link/publink/show?code=kZF0Pr5ZWDMyRxFiDDVWNv6kxVWRM0BwlTsk"
    product.pcloud_download_link = "https://u.pcloud.link/publink/show?code=kZF0Pr5ZWDMyRxFiDDVWNv6kxVWRM0BwlTsk"
    db_session.commit()
    print("Successfully updated product link in SQLite.")
else:
    print("Product 113 not found in SQLite.")
db_session.close()

# 2. Update Firestore
cert_path = "app/shared/firebase/serviceAccountKey.json"
if not firebase_admin._apps:
    cred = credentials.Certificate(cert_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()
doc_ref = db.collection("products").document("113")
doc = doc_ref.get()
if doc.exists:
    print(f"Found product in Firestore: {doc.to_dict().get('title')}")
    doc_ref.update({
        "file_url": "https://u.pcloud.link/publink/show?code=kZF0Pr5ZWDMyRxFiDDVWNv6kxVWRM0BwlTsk",
        "fileUrl": "https://u.pcloud.link/publink/show?code=kZF0Pr5ZWDMyRxFiDDVWNv6kxVWRM0BwlTsk",
        "pcloud_download_link": "https://u.pcloud.link/publink/show?code=kZF0Pr5ZWDMyRxFiDDVWNv6kxVWRM0BwlTsk",
        "pcloudDownloadLink": "https://u.pcloud.link/publink/show?code=kZF0Pr5ZWDMyRxFiDDVWNv6kxVWRM0BwlTsk"
    })
    print("Successfully updated product link in Firestore.")
else:
    print("Product 113 not found in Firestore.")
