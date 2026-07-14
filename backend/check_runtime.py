import sys, os
sys.path.insert(0, '.')

from app.db.database import SessionLocal
from app.models.order import Order, OrderItem
from app.models.user import User
from app.models.user_activity import UserActivity
from app.models.product import Product

db = SessionLocal()

print("=== ORDERS (last 5) ===")
orders = db.query(Order).order_by(Order.created_at.desc()).limit(5).all()
for o in orders:
    print(f"  Order id={o.id} user_id={o.user_id} status={o.status} total={o.total_amount}")
    for item in o.items:
        print(f"    Item product_id={item.product_id} price_paid={item.price_paid} download_url={item.download_url}")

print("\n=== USERS (customers, last 5) ===")
users = db.query(User).filter(User.role == 'customer').limit(5).all()
for u in users:
    fuid = getattr(u, 'firebase_uid', 'N/A')
    print(f"  User id={u.id} email={u.email} firebase_uid={fuid}")

print("\n=== DOWNLOAD ACTIVITIES (last 5) ===")
acts = db.query(UserActivity).filter(UserActivity.activity_type == 'download').order_by(UserActivity.created_at.desc()).limit(5).all()
for a in acts:
    print(f"  user_id={a.user_id} type={a.activity_type} details={a.details}")

print("\n=== PRODUCTS with storage_path (first 5) ===")
prods = db.query(Product).limit(5).all()
for p in prods:
    print(f"  Product id={p.id} title={p.title} storage_path={p.storage_path} file_url={p.file_url} status={p.status} downloads={p.downloads}")

db.close()
