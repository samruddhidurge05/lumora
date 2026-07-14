import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.models.product import Product
from app.models.user import User
from sqlalchemy import cast, String, or_

db = SessionLocal()
query = db.query(Product).outerjoin(User, Product.vendor_id == cast(User.id, String)).filter(
    Product.status == "published",
    or_(User.id == None, User.is_active == True)
)
results = query.all()
print("Total results in query:", len(results))

categories = {}
for p in results:
    categories[p.category] = categories.get(p.category, 0) + 1

print("\nCategories found in query:")
for cat, count in sorted(categories.items()):
    print(f"  {cat}: {count}")

print("\nResume templates found:")
resume_templates = [p for p in results if "resume" in str(p.category).lower() or "resume" in str(p.title).lower()]
for p in resume_templates:
    print(f"  ID={p.id} vendor_id={p.vendor_id} title={p.title}")

db.close()
