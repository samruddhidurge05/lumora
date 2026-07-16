import sys, os
sys.path.append(os.getcwd())

import firebase_admin
from firebase_admin import credentials, firestore
from app.db.session import SessionLocal
from app.models.product import Product as ProductModel

img1 = "https://u.pcloud.link/publink/show?code=XZfh1r5ZL2f9tKMAGnJqq8AV4BR1MhSmJRp7"
img2 = "https://u.pcloud.link/publink/show?code=XZj7gr5ZWFHGQ9zjOhHLCpE1yrqnxbdmo257"
images_list = [img1, img2]

# 1. Update SQLite
db_session = SessionLocal()
product = db_session.query(ProductModel).filter(ProductModel.id == 113).first()
if product:
    print(f"Updating product 113 images in SQLite...")
    product.thumbnail = img1
    product.preview = img1
    product.image_urls = images_list
    db_session.commit()
    print("Successfully updated product 113 images in SQLite.")
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
try:
    doc = doc_ref.get()
    if doc.exists:
        print("Updating product 113 images in Firestore...")
        doc_ref.update({
            "thumbnail": img1,
            "preview": img1,
            "image_urls": images_list,
            "imageUrls": images_list,
        })
        print("Successfully updated product 113 images in Firestore.")
    else:
        print("Product 113 not found in Firestore.")
except Exception as e:
    print(f"Firestore update skipped/failed: {e}")
