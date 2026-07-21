"""Check features field in SQLite and Firestore for recent products"""
import sys, os
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND_ROOT)
_env_path = os.path.join(_BACKEND_ROOT, ".env")
if os.path.exists(_env_path):
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip())

from app.db.session import SessionLocal
from app.models.product import Product
from app.shared.firebase.connection import db as fs_db, firebase_connected

session = SessionLocal()
try:
    products = session.query(Product).filter(
        Product.id.in_([115, 116, 117, 118, 119])
    ).all()
    print("=== SQLite features for recent products ===")
    for p in products:
        print(f"  ID={p.id}  title='{p.title}'  features={p.features}  highlights={p.highlights}")
    
    if firebase_connected and fs_db:
        print("\n=== Firestore features for same products ===")
        for p in products:
            doc = fs_db.collection("products").document(str(p.id)).get()
            if doc.exists:
                data = doc.to_dict()
                print(f"  ID={p.id}  features={data.get('features')}  highlights={data.get('highlights')}")
            else:
                print(f"  ID={p.id}  NOT IN FIRESTORE")
finally:
    session.close()
