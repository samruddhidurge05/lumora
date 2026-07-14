import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from admin.firestore.admin_firestore import restore_sqlite_products_from_firestore
from app.models.product import Product

db = SessionLocal()
try:
    print("Before sync, total products in SQLite:", db.query(Product).count())
    restore_sqlite_products_from_firestore(db)
    print("After sync, total products in SQLite:", db.query(Product).count())
except Exception as e:
    print("Error syncing:", e)
finally:
    db.close()
