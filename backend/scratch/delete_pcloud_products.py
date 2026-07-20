import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.session import SessionLocal
from app.models.product import Product
from app.models.order import OrderItem
from admin.firestore.admin_firestore import delete_product_from_firestore

PCLOUD_PRODUCT_IDS = [108, 109, 110, 111, 112, 115, 116, 117, 118, 119, 120, 121, 122]

def delete_pcloud_products():
    print("=== DELETING ALL PCLOUD PRODUCTS FROM LUMORA DATABASE & FIRESTORE ===")
    
    db = SessionLocal()
    try:
        deleted_count = 0
        for pid in PCLOUD_PRODUCT_IDS:
            prod = db.query(Product).filter(Product.id == pid).first()
            if prod:
                title = prod.title
                
                # Delete any associated order items if any test orders exist
                order_items = db.query(OrderItem).filter(OrderItem.product_id == pid).all()
                for item in order_items:
                    db.delete(item)
                
                # Delete product from SQLite
                db.delete(prod)
                db.commit()
                deleted_count += 1
                print(f"[Deleted SQLite] Product ID {pid} ('{title}')")

                # Delete product from Firestore
                try:
                    delete_product_from_firestore(pid)
                    print(f"  [Deleted Firestore] Product ID {pid} removed from Firestore.")
                except Exception as e:
                    print(f"  [Firestore Notice] Product ID {pid}: {e}")

        print(f"\nCompleted: Deleted {deleted_count} pCloud products from Lumora SQLite database and Firestore.")

    finally:
        db.close()

if __name__ == "__main__":
    delete_pcloud_products()
