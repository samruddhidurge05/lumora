import sys, os
_B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _B)
_e = os.path.join(_B, ".env")
if os.path.exists(_e):
    with open(_e) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())

from app.db.session import SessionLocal
from app.models.product import Product
from app.shared.firebase.connection import db as fs_db, firebase_connected

session = SessionLocal()
try:
    for pid in [115, 116, 117, 118, 119, 120]:
        p = session.query(Product).filter(Product.id == pid).first()
        if p:
            print(f"ID={p.id} title='{p.title}'")
            print(f"  SQLite features  : {p.features}")
            print(f"  SQLite highlights: {p.highlights}")
            if firebase_connected and fs_db:
                doc = fs_db.collection("products").document(str(pid)).get()
                if doc.exists:
                    d = doc.to_dict()
                    print(f"  Firestore features  : {d.get('features')}")
                    print(f"  Firestore highlights: {d.get('highlights')}")
finally:
    session.close()
