import sqlite3
import firebase_admin
from firebase_admin import credentials, firestore
import os

# -- Commission settings ------------------------------------------------------
PRODUCT_IDS   = [108, 109, 111, 112]
COMMISSION_TYPE  = "percentage"
COMMISSION_VALUE = 20.0   # 20% affiliate commission

# -- SQLite -------------------------------------------------------------------
conn = sqlite3.connect('test.db')
c = conn.cursor()

for pid in PRODUCT_IDS:
    c.execute(
        "UPDATE products SET affiliate_enabled=1, commission_type=?, commission_value=? WHERE id=?",
        (COMMISSION_TYPE, COMMISSION_VALUE, pid)
    )
    c.execute("SELECT id, title, affiliate_enabled, commission_type, commission_value FROM products WHERE id=?", (pid,))
    row = c.fetchone()
    print(f"SQLite  ID:{row[0]} | {row[1]} | affiliate_enabled:{row[2]} | {row[3]} {row[4]}%")

conn.commit()
conn.close()
print()

# -- Firestore -----------------------------------------------------------------
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

print()
print("Done! All 4 products are now affiliate-enabled with 20% commission.")
