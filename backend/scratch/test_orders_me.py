import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.session import SessionLocal
from app.models.user import User
from app.api.orders.routes import get_my_orders

def test():
    db = SessionLocal()
    user = db.query(User).filter(User.id == 5).first()
    orders = get_my_orders(current_user=user, db=db)
    print("Orders returned:")
    for o in orders:
        print(f"Order ID: {o.id}, Status: {o.status}")
        print("Items:")
        for item in o.items:
            print(f"  Product ID: {item.product_id}, Price: {item.price_paid}, Download URL: {getattr(item, 'download_url', 'NONE')}")
    db.close()

if __name__ == '__main__':
    test()
