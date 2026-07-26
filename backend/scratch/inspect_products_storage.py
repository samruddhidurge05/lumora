import sys, os
sys.path.insert(0, os.path.abspath('.'))
from app.db.session import SessionLocal
from app.models.product import Product

def inspect():
    db = SessionLocal()
    try:
        products = db.query(Product).all()
        print(f"Total products found: {len(products)}")
        for p in products:
            print(f"ID: {p.id} | Title: {p.title} | storage_path: {p.storage_path} | file_url: {p.file_url}")
    finally:
        db.close()

if __name__ == "__main__":
    inspect()
