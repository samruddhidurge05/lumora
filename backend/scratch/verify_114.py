import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()
from admin.firestore.admin_firestore import db, firebase_connected

if not firebase_connected:
    print("Firebase not connected")
else:
    doc = db.collection("products").document("114").get()
    if doc.exists:
        d = doc.to_dict()
        print("=== Firestore products/114 ===")
        print("title               :", d.get("title"))
        print("status              :", d.get("status"))
        print("price               :", d.get("price"))
        print("pcloud_download_link:", d.get("pcloud_download_link"))
        print("pcloudDownloadLink  :", d.get("pcloudDownloadLink"))
        print("thumbnail           :", d.get("thumbnail"))
        print("preview             :", d.get("preview"))
        print("image_urls          :", d.get("image_urls"))
        print("previewImages       :", d.get("previewImages"))
        print("features            :", d.get("features"))
        print("whatYouGet          :", d.get("whatYouGet"))
    else:
        print("Document 114 not found in Firestore")
