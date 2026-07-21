"""Debug: test the full initiate?confirm flow via Python (no HTTP)"""
from app.db.database import SessionLocal
from app.services.payment_service import payment_service
from app.models.payment import Payment
from sqlalchemy import inspect as sa_inspect
import json

db = SessionLocal()

# Show ORM columns
mapper = sa_inspect(Payment)
print('ORM columns:', [c.key for c in mapper.columns])

# Call initiate_payment directly
try:
    result = payment_service.initiate_payment(
        db=db,
        customer_id=14,
        amount=200.0,
        items=[{"product_id": 104, "price_paid": 200.0}],
        currency="INR",
        payment_method="upi",
        idempotency_key=f"debug_key_{__import__('time').time()}",
        discount_amount=0.0,
        tax_amount=0.0,
    )
    db.commit()
    payment_ref = result.get('payment_ref')
    print(f'Initiate result payment_ref: {payment_ref}')

    # Check what's stored
    stored = db.query(Payment).filter(Payment.payment_ref == payment_ref).first()
    print(f'Stored items_json: {stored.items_json}')
    print(f'Stored status: {stored.status}')

    # Call confirm_payment directly
    from app.services.purchase_service import PurchaseService
    items_payload = json.loads(stored.items_json) if stored.items_json else []
    print(f'Items payload for confirm: {items_payload}')

    if items_payload:
        order = payment_service.confirm_payment(
            db=db,
            payment_ref=payment_ref,
            customer_id=14,
            gateway_payment_id='mock_pay_debug',
            gateway_signature='mock_sig',
            items_payload=items_payload,
            payment_method='upi',
        )
        print(f'Order created: id={order.id} status={order.status}')
        for item in order.items:
            print(f'  OrderItem product_id={item.product_id} price={item.price_paid}')
    else:
        print('ERROR: items_payload is empty - items_json not stored!')

except Exception as e:
    import traceback
    print('ERROR:', e)
    traceback.print_exc()

db.close()
