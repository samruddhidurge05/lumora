from app.db.session import SessionLocal
from app.models.product import Product

db = SessionLocal()
products = db.query(Product).all()
print("Total products in DB via SQLAlchemy:", len(products))
for p in products[:5]:
    print(f"id={p.id} title={p.title} status={p.status} vendor_id={p.vendor_id} seller={p.seller}")
db.close()
