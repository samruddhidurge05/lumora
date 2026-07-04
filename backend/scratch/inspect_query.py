from app.db.session import SessionLocal
from app.models.product import Product
from app.models.user import User
from sqlalchemy import cast, String, or_

db = SessionLocal()
query = db.query(Product).outerjoin(User, Product.vendor_id == cast(User.id, String)).filter(
    Product.status == "published",
    or_(User.id == None, User.is_active == True)
)
print("Generated SQL:")
print(query)
results = query.all()
print("Results count:", len(results))
db.close()
