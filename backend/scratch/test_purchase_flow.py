import json
from app.db.session import SessionLocal
from app.models.user import User
from app.models.order import Order
from app.services.payment_service import payment_service

def test():
    db = SessionLocal()
    # Find or create a test customer
    user = db.query(User).filter(User.email == "sara@gmail.com").first()
    if not user:
        print("User sara@gmail.com not found")
        return
        
    print(f"Testing purchase flow for user: {user.email} (ID: {user.id})")
    
    # 1. Initiate payment
    items = [{"product_id": 102, "price_paid": 15.0}]
    payment_ref = "LUM-TEST-" + str(int(db.query(Order).count() + 1))
    
    payment = payment_service.initiate_payment(
        db=db,
        customer_id=user.id,
        amount=15.0,
        items=items,
        currency="INR",
        payment_method="card",
        idempotency_key="idemp_test_" + payment_ref,
    )
    db.commit()
    print(f"Payment initiated: {payment['payment_ref']}, Status: {payment['status']}")
    
    # 2. Confirm payment
    order = payment_service.confirm_payment(
        db=db,
        payment_ref=payment['payment_ref'],
        customer_id=user.id,
        gateway_payment_id="mock_pay_test",
        gateway_signature="mock_sig_test",
        items_payload=items,
        payment_method="card",
    )
    db.commit()
    print(f"Payment confirmed! Order ID: {order.id}, Status: {order.status}")
    
    # 3. Retrieve orders
    orders = db.query(Order).filter(Order.user_id == user.id).all()
    print(f"Total orders for user: {len(orders)}")
    for o in orders:
        print(f"  Order ID: {o.id}, Status: {o.status}, Total: {o.total_amount}")
        
    db.close()

if __name__ == "__main__":
    test()
