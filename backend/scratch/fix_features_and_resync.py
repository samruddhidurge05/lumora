"""
fix_features_and_resync.py
--------------------------
For every published/draft product:
  1. If features is empty [] but highlights has data ? copy highlights ? features in SQLite
  2. Re-sync ALL products to Firestore so features/highlights are both correct

Run from backend/ directory:
    .venv/Scripts/python.exe scratch/fix_features_and_resync.py
"""
import sys, os

_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND_ROOT)

# Load .env
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
from admin.firestore.admin_firestore import sync_product_to_firestore

def main():
    if not firebase_connected or fs_db is None:
        print("[fix] ERROR: Firestore not connected.")
        sys.exit(1)

    session = SessionLocal()
    fixed_sqlite = 0
    synced = 0
    errors = 0

    try:
        products = session.query(Product).filter(
            Product.status.in_(["published", "draft"])
        ).order_by(Product.id.asc()).all()

        print(f"[fix] Found {len(products)} active products in SQLite.\n")

        # Step 1: Fix SQLite - copy highlights ? features where features is empty
        print("=== Step 1: Fix SQLite features field ===")
        for p in products:
            features = p.features if isinstance(p.features, list) else []
            highlights = p.highlights if isinstance(p.highlights, list) else []

            if not features and highlights:
                print(f"  [fix] ID={p.id} '{p.title}': features=[] but highlights={highlights}")
                print(f"        ? Copying highlights ? features in SQLite")
                p.features = highlights
                fixed_sqlite += 1
            elif features:
                print(f"  [ok]  ID={p.id} '{p.title}': features already set ({len(features)} items)")
            else:
                print(f"  [--]  ID={p.id} '{p.title}': both features and highlights are empty")

        if fixed_sqlite > 0:
            session.commit()
            print(f"\n[fix] SQLite updated: {fixed_sqlite} products had features copied from highlights.\n")
        else:
            print(f"\n[fix] No SQLite changes needed.\n")

        # Step 2: Re-sync ALL products to Firestore
        print("=== Step 2: Re-sync all products to Firestore ===")
        # Refresh from DB to get updated values
        session.expire_all()
        products = session.query(Product).filter(
            Product.status.in_(["published", "draft"])
        ).order_by(Product.id.asc()).all()

        for p in products:
            try:
                sync_product_to_firestore(p)
                synced += 1
                if synced % 20 == 0:
                    print(f"  Synced {synced}/{len(products)}...")
            except Exception as e:
                print(f"  [ERROR] ID={p.id}: {e}")
                errors += 1

        print(f"\n[fix] ? Done!")
        print(f"  SQLite features fixed : {fixed_sqlite}")
        print(f"  Firestore synced      : {synced}")
        print(f"  Errors                : {errors}")

        # Step 3: Verify specific products
        print("\n=== Step 3: Verify Firestore for recent products ===")
        recent_ids = [115, 116, 117, 118, 119]
        for pid in recent_ids:
            doc = fs_db.collection("products").document(str(pid)).get()
            if doc.exists:
                data = doc.to_dict()
                f = data.get("features", [])
                h = data.get("highlights", [])
                print(f"  ID={pid}  features={f}  highlights={h}")
            else:
                print(f"  ID={pid}  NOT FOUND in Firestore")

    finally:
        session.close()

if __name__ == "__main__":
    main()
