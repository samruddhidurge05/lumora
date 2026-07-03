import os
import sys
import json
from pathlib import Path

# Add project root to python path so we can import app modules
project_root = str(Path(__file__).resolve().parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from app.db.database import SessionLocal, engine
from app.models import Base, Product, Vendor

def seed():
    # Make sure tables are created
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Load products from JSON
        json_path = Path(project_root) / "../frontend/src/data/products.json"
        if not json_path.exists():
            # Fallback path if run from frontend folder or root
            json_path = Path(project_root) / "frontend/src/data/products.json"
        
        if not json_path.exists():
            # Try workspace absolute path
            json_path = Path("c:/Users/samruddhi/Downloads/digital-marketplace/Digi/digital-marketplace/frontend/src/data/products.json")

        if not json_path.exists():
            print(f"Error: products.json not found at {json_path.resolve()}")
            return

        with open(json_path, "r", encoding="utf-8") as f:
            products_data = json.load(f)

        print(f"Loaded {len(products_data)} products from JSON.")

        # Seed Vendors first to satisfy potential references
        seen_vendors = set()
        for p in products_data:
            seller_name = p.get("seller") or p.get("vendor_id") or "Lumora Creator"
            # Normalize ID like in frontend AppContext: String(sellerName).toLowerCase().replace(/\s+/g, '-')
            vendor_id = str(seller_name).lower().replace(" ", "-")
            
            if vendor_id not in seen_vendors:
                seen_vendors.add(vendor_id)
                # Check if exists
                existing_vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
                if not existing_vendor:
                    vendor = Vendor(
                        id=vendor_id,
                        name=seller_name,
                        avatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
                        bio=f"Expert creator specialising in premium {p.get('category', 'digital')} assets.",
                        banner="https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1200&q=80",
                        sales="1.5K+",
                        rating=f"{p.get('rating', 4.8)} ★"
                    )
                    db.add(vendor)
                    print(f"Added Vendor: {seller_name} ({vendor_id})")

        db.commit()

        # Seed Products
        count = 0
        for p in products_data:
            pid = int(p.get("id"))
            existing = db.query(Product).filter(Product.id == pid).first()
            if existing:
                continue

            seller_name = p.get("seller") or p.get("vendor_id") or "Lumora Creator"
            vendor_id = str(seller_name).lower().replace(" ", "-")

            product = Product(
                id=pid,
                title=p.get("title"),
                description=p.get("description"),
                category=p.get("category"),
                price=float(p.get("price", 0.0)),
                rating=float(p.get("rating", 5.0)),
                reviews=int(p.get("reviews", 0)),
                downloads=int(p.get("downloads", 0)),
                thumbnail=p.get("thumbnail"),
                preview=p.get("preview") or p.get("thumbnail"),
                file_url=p.get("file_url") or f"/products/product-{pid}.zip",
                seller=seller_name,
                vendor_id=vendor_id,
                featured=bool(p.get("featured", False)),
                trending=bool(p.get("trending", False)),
                new_arrival=bool(p.get("newArrival", False)),
                badge=p.get("badge"),
                status=p.get("status", "published"),
                tags=p.get("tags", []),
                highlights=p.get("highlights", []),
                version=p.get("version", "v1.0.0"),
                file_size=p.get("file_size") or p.get("fileSize") or "48 MB",
                last_updated=p.get("last_updated") or p.get("lastUpdated") or "Recently"
            )
            db.add(product)
            count += 1

        db.commit()
        print(f"Successfully seeded {count} new products into database.")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
