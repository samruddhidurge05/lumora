"""
mark_all_featured.py
--------------------
Marks EVERY product in SQLite as featured=True and trending=True.
Also updates frontend/src/data/products.json and syncs to Firestore.
"""
import os, sys, json

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.db.database import SessionLocal
from app.models.product import Product as ProductModel
from admin.firestore.admin_firestore import sync_product_to_firestore

BADGE_CYCLE = [
    "Best Seller", "Top Choice", "Trending", "Popular", "Best Value",
    "Editor's Pick", "Hot Product", "New Release", "Must Have", "Top Pick",
    "Fan Favorite", "Staff Pick", "Featured", "Premium"
]

def main():
    db = SessionLocal()
    try:
        products = db.query(ProductModel).all()
        print(f"Found {len(products)} products in SQLite.")

        for i, p in enumerate(products):
            p.featured = True
            p.trending  = True
            # Give each product a badge if it has none or a blank one
            if not p.badge or str(p.badge).strip() in ("", "0", "None"):
                p.badge = BADGE_CYCLE[i % len(BADGE_CYCLE)]

        db.commit()
        print("SQLite updated — all products are now featured & trending.")

        # Sync to Firestore
        errors = 0
        for p in products:
            try:
                sync_product_to_firestore(p)
            except Exception as e:
                print(f"  Firestore sync failed for product {p.id}: {e}")
                errors += 1
        print(f"Firestore sync done ({len(products) - errors} ok, {errors} errors).")

    finally:
        db.close()

    # ── Update products.json ─────────────────────────────────────────────────
    root_dir = os.path.dirname(backend_dir)
    json_path = os.path.join(root_dir, "frontend", "src", "data", "products.json")
    if not os.path.exists(json_path):
        print("products.json not found — skipping JSON update.")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Re-load fresh DB map after commit
    db2 = SessionLocal()
    try:
        db_map = {p.id: p for p in db2.query(ProductModel).all()}

        updated = 0
        for item in data:
            pid = item.get("id")
            db_p = db_map.get(pid)
            if db_p:
                item["featured"] = True
                item["trending"]  = True
                item["badge"] = db_p.badge or BADGE_CYCLE[list(db_map.keys()).index(pid) % len(BADGE_CYCLE)]
                updated += 1
            else:
                # JSON-only product (no SQLite record) — still mark it
                item["featured"] = True
                item["trending"]  = True
                if not item.get("badge") or str(item.get("badge")).strip() in ("", "0", "None"):
                    item["badge"] = BADGE_CYCLE[updated % len(BADGE_CYCLE)]
                updated += 1

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"products.json updated — {updated} products marked as featured & trending.")
    finally:
        db2.close()

if __name__ == "__main__":
    main()
