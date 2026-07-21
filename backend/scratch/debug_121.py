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
from admin.firestore.admin_firestore import sync_product_to_firestore

session = SessionLocal()
try:
    # Find product 121
    p = session.query(Product).filter(Product.id == 121).first()
    if not p:
        print("Product 121 NOT FOUND in SQLite")
        # Show latest products
        latest = session.query(Product).order_by(Product.id.desc()).limit(5).all()
        print("Latest 5 products:", [(x.id, x.title) for x in latest])
    else:
        print(f"=== SQLite Product 121 ===")
        print(f"  title    : {p.title}")
        print(f"  features : {p.features}")
        print(f"  highlights: {p.highlights}")
        print(f"  status   : {p.status}")
        print(f"  seller   : {p.seller}")

        # Fix: if features stored as string, parse it
        if isinstance(p.features, str) and p.features.strip():
            import json
            try:
                parsed = json.loads(p.features)
                print(f"\n  [!] features is a JSON string - parsed: {parsed}")
                print("  Fixing: converting to list in SQLite...")
                p.features = parsed
                session.commit()
                print("  Fixed in SQLite.")
            except Exception:
                # Try newline-split
                items = [x.strip() for x in p.features.split('\n') if x.strip()]
                if items:
                    print(f"\n  [!] features is newline-separated string: {items}")
                    p.features = items
                    session.commit()
                    print("  Fixed in SQLite.")

        # Reload
        session.refresh(p)
        print(f"\n  After fix: features = {p.features}")

        # Sync to Firestore
        print("\n[sync] Syncing product 121 to Firestore...")
        sync_product_to_firestore(p)

        # Verify Firestore
        if firebase_connected and fs_db:
            doc = fs_db.collection("products").document("121").get()
            if doc.exists:
                d = doc.to_dict()
                print(f"\n=== Firestore Product 121 ===")
                print(f"  title    : {d.get('title')}")
                print(f"  features : {d.get('features')}")
                print(f"  highlights: {d.get('highlights')}")
                print(f"  featured : {d.get('featured')}")
                print(f"  status   : {d.get('status')}")
            else:
                print("Product 121 NOT FOUND in Firestore after sync!")
finally:
    session.close()
