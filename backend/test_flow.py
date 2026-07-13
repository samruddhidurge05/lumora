import requests
import json
import time

BASE = 'http://localhost:8000/api'

# Create a test user with password auth directly in DB
from app.db.database import SessionLocal
from app.models.user import User
import hashlib

db = SessionLocal()

# Find or create a password-based test user
test_email = 'flowtest@lumora.dev'
user = db.query(User).filter(User.email == test_email).first()
if not user:
    import bcrypt
    pw_hash = bcrypt.hashpw(b'Test@1234', bcrypt.gensalt()).decode()
    user = User(
        email=test_email,
        name='Flow Test User',
        role='customer',
        is_active=True,
        is_verified=True,
        password_hash=pw_hash,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f'Created test user id={user.id}')
else:
    print(f'Using existing test user id={user.id}')
db.close()

# Step 1: Login
login = requests.post(f'{BASE}/auth/login', json={'email': test_email, 'password': 'Test@1234'})
print('LOGIN STATUS:', login.status_code)
if login.status_code != 200:
    print('LOGIN FAILED:', login.text)
    exit(1)

token = login.json().get('access_token')
headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
user_id = login.json().get('user', {}).get('id', '?')
print(f'Token OK  user_id={user_id}')

# Step 2: Get a published product
prods = requests.get(f'{BASE}/products/?limit=5')
products = prods.json()
print(f'Products count: {len(products)}')
p = products[0]
product_id = int(p['id'])
price = float(p['price'])
print(f'Product: id={product_id} title={p["title"]} price={price}')

# Step 3: Initiate payment — sends items in payload
ikey = f'test_ikey_{int(time.time())}'
init_payload = {
    'items': [{'product_id': product_id, 'price_paid': price}],
    'total_amount': price,
    'currency': 'INR',
    'payment_method': 'upi',
    'idempotency_key': ikey,
    'discount_amount': 0.0,
    'tax_amount': 0.0
}
init = requests.post(f'{BASE}/payments/initiate', json=init_payload, headers=headers)
print(f'INITIATE STATUS: {init.status_code}')
if init.status_code not in (200, 201):
    print('INITIATE FAILED:', init.text[:600])
    exit(1)

init_data = init.json()
payment_ref = init_data.get('payment_ref')
print(f'Payment ref: {payment_ref}')
print(f'Gateway order: {init_data.get("gateway_order_id")}')

# Check items_json was stored
db2 = SessionLocal()
from app.models.payment import Payment
stored = db2.query(Payment).filter(Payment.payment_ref == payment_ref).first()
print(f'items_json in DB: {stored.items_json}')
db2.close()

# Step 4: Confirm payment (mock)
confirm_payload = {
    'payment_ref': payment_ref,
    'gateway_payment_id': f'mock_pay_{int(time.time())}',
    'gateway_signature': 'mock_sig',
    'payment_method': 'upi'
}
confirm = requests.post(f'{BASE}/payments/confirm', json=confirm_payload, headers=headers)
print(f'CONFIRM STATUS: {confirm.status_code}')
if confirm.status_code != 200:
    print('CONFIRM FAILED:', confirm.text[:800])
else:
    data = confirm.json()
    print(f'CONFIRM SUCCESS: order_id={data.get("order_id")} success={data.get("success")}')

# Step 5: Check orders/me
orders_resp = requests.get(f'{BASE}/orders/me', headers=headers)
print(f'ORDERS/ME STATUS: {orders_resp.status_code}')
if orders_resp.status_code == 200:
    order_list = orders_resp.json()
    print(f'Total orders in DB: {len(order_list)}')
    for o in order_list:
        print(f'  Order id={o["id"]} status={o["status"]} items={len(o.get("items", []))}')
        for item in o.get('items', []):
            print(f'    product_id={item.get("product_id")} price={item.get("price_paid")}')
else:
    print('ORDERS FAILED:', orders_resp.text[:300])
