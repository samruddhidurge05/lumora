import firebase_admin
from firebase_admin import credentials, firestore

PRODUCT_IDS   = [108, 109, 111, 112]
COMMISSION_TYPE  = "percentage"
COMMISSION_VALUE = 20.0

cert_path = "app/shared/firebase/serviceAccountKey.json"
if not firebase_admin._apps:
    cred = credentials.Certificate(cert_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

for pid in PRODUCT_IDS:
    doc_ref = db.collection("products").document(str(pid))
    doc_ref.update({
        "affiliate_enabled": True,
        "commission_type":   COMMISSION_TYPE,
        "commission_value":  COMMISSION_VALUE,
    })
    print(f"Firestore ID:{pid} -> affiliate_enabled=True, commission={COMMISSION_VALUE}%")

print("Firestore update complete!")
