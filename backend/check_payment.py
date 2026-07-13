from app.db.database import engine, SessionLocal
from app.models.payment import Payment
from sqlalchemy import inspect, text
from datetime import datetime, timedelta
import uuid
import json

# Check columns
inspector = inspect(engine)
cols = [c['name'] for c in inspector.get_columns('payments')]
print('Payment columns:', cols)
print('items_json present:', 'items_json' in cols)

# Test direct insert with items_json
db = SessionLocal()
today = datetime.utcnow()
ref = 'COLTEST-' + uuid.uuid4().hex[:8].upper()
items = [{"product_id": 999, "price_paid": 100.0}]
p = Payment(
    payment_ref=ref,
    customer_id=14,
    amount=100.0,
    currency='INR',
    gateway='mock',
    status='PENDING',
    items_json=json.dumps(items),
    expires_at=today + timedelta(minutes=30),
)
db.add(p)
db.commit()
db.refresh(p)
print(f'Stored items_json: {p.items_json}')
print(f'Parsed back: {json.loads(p.items_json)}')

# Cleanup
db.delete(p)
db.commit()
db.close()
print('Column write/read works correctly')

# Now check the last real payment
db2 = SessionLocal()
last = db2.query(Payment).order_by(Payment.id.desc()).first()
if last:
    print(f'Last payment ref={last.payment_ref} items_json={last.items_json} status={last.status}')
db2.close()
