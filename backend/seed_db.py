import json
import os
import sys

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.product import Product

JSON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "src" , "data", "products.json")

def seed():
    if not os.path.exists(JSON_PATH):
        print(f"[seed] JSON file not found at {JSON_PATH}")
        return

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    db = SessionLocal()
    try:
        # Check if already seeded
        count = db.query(Product).count()
        if count > 0:
            print(f"[seed] Database already contains {count} products. Skipping seed.")
            return

        print(f"[seed] Seeding {len(data)} products from JSON...")
        for item in data:
            product = Product(
                id=item.get("id"),
                title=item.get("title"),
                description=item.get("description"),
                category=item.get("category"),
                price=float(item.get("price", 0.0)),
                rating=float(item.get("rating", 5.0)),
                reviews=int(item.get("reviews", 0)),
                downloads=int(item.get("downloads", 0)),
                thumbnail=item.get("thumbnail"),
                preview=item.get("preview"),
                file_url=item.get("file_url"),
                seller=item.get("seller"),
                vendor_id=item.get("vendor_id"),
                featured=bool(item.get("featured", False)),
                trending=bool(item.get("trending", False)),
                new_arrival=bool(item.get("newArrival", False)),
                badge=item.get("badge"),
                status=item.get("status", "published"),
                tags=item.get("tags", []),
                highlights=item.get("highlights", []),
                version=item.get("version", "v1.0.0"),
                file_size=item.get("fileSize", "48 MB"),
                last_updated=item.get("lastUpdated", "Recently"),
                license=item.get("license"),
            )
            db.add(product)
        db.commit()
        print("[seed] Seeding completed successfully!")
    except Exception as e:
        db.rollback()
        print(f"[seed] Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
