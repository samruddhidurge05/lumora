?import sys, os
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
from admin.firestore.admin_firestore import sync_product_to_firestore
from app.shared.firebase.connection import db as fs_db, firebase_connected

FEATURES_121 = [
    "12-month wedding planning timeline",
    "Budget tracker with vendor cost breakdown",
    "Guest list manager with RSVP tracking",
    "Vendor contact and booking tracker",
    "Day-of timeline and schedule planner",
    "Seating chart planner for reception",
]

session = SessionLocal()
try:
    p = session.query(Product).filter(Product.id == 121).first()
    if not p:
        print("Product 121 not found.")
        sys.exit(1)
    print(f"Updating: {p.title}")
    p.features = FEATURES_121
    p.highlights = FEATURES_121[:4]
    session.commit()
    session.refresh(p)
    print(f"SQLite features set: {p.features}")
    sync_product_to_firestore(p)
    print("Synced to Firestore.")
    if firebase_connected and fs_db:
        doc = fs_db.collection("products").document("121").get()
        if doc.exists:
            d = doc.to_dict()
            print(f"Firestore features: {d.get('features')}")
            print(f"Firestore featured: {d.get('featured')}")
finally:
    session.close()
