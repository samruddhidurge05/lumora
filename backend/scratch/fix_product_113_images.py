import sys, os
sys.path.append(os.getcwd())

import firebase_admin
from firebase_admin import credentials, firestore
from app.db.session import SessionLocal
from app.models.product import Product as ProductModel

# We will use a premium Unsplash image that represents a UI/UX icon pack & design assets
ui_image_url = "https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=800&q=80"

# 1. Update SQLite
db_session = SessionLocal()
product = db_session.query(ProductModel).filter(ProductModel.id == 113).first()
if product:
    print(f"Updating product 113 images in SQLite...")
    product.thumbnail = ui_image_url
    product.preview = ui_image_url
    product.image_urls = [ui_image_url]
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
            "thumbnail": ui_image_url,
            "preview": ui_image_url,
            "image_urls": [ui_image_url],
            "imageUrls": [ui_image_url],
        })
        print("Successfully updated product 113 images in Firestore.")
    else:
        print("Product 113 not found in Firestore.")
except Exception as e:
    print(f"Firestore update skipped/failed: {e}")
