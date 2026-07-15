import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.models.product import Product
from admin.firestore.admin_firestore import sync_product_to_firestore

db = SessionLocal()
try:
    products = db.query(Product).all()
    print(f"Loaded {len(products)} products from SQLite database.")
    
    reset_count = 0
    keep_ids = [1, 108, 109, 111, 112]
    
    for p in products:
        if p.id not in keep_ids:
            if p.pcloud_download_link is not None:
                p.pcloud_download_link = None
                sync_product_to_firestore(p)
                reset_count += 1
                
    db.commit()
    print(f"Successfully reset and synced {reset_count} products (cleared pCloud links) in SQLite and Firestore!")
except Exception as e:
    db.rollback()
    print(f"Error resetting database: {e}")
finally:
    db.close()
