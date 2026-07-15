import requests
import json
import time
import sys

BASE = 'http://localhost:8000/api'

# Create a test user with password auth directly in DB
from app.db.database import SessionLocal
from app.models.user import User
from app.models.product import Product

db = SessionLocal()

# Find or create a password-based test user
test_email = 'pcloud_flowtest@lumora.dev'
user = db.query(User).filter(User.email == test_email).first()
if not user:
    import bcrypt
    pw_hash = bcrypt.hashpw(b'Test@1234', bcrypt.gensalt()).decode()
    user = User(
        email=test_email,
        name='PCloud Flow Test',
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

# Get a product to test with, and set its pcloud link
p = db.query(Product).first()
if not p:
    print('No products in database!')
    sys.exit(1)

product_id = p.id
original_downloads = p.downloads or 0
test_pcloud_url = "https://u.pcloud.link/publink/show?code=kZ3a9r5ZiEfxzD6Rwz8si43xOwwD9yI0eeX0"

p.pcloud_download_link = test_pcloud_url
db.commit()
db.refresh(p)
print(f'Updated product {product_id} with pCloud download link: {p.pcloud_download_link}')
price = float(p.price or 0.0)

db.close()

# Step 1: Login
login = requests.post(f'{BASE}/auth/login', json={'email': test_email, 'password': 'Test@1234'})
print('LOGIN STATUS:', login.status_code)
if login.status_code != 200:
    print('LOGIN FAILED:', login.text)
    sys.exit(1)

token = login.json().get('access_token')
headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
user_id = login.json().get('user', {}).get('id', '?')
print(f'Token OK  user_id={user_id}')

# Step 2: Initiate payment
ikey = f'pcloud_ikey_{int(time.time())}'
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
    sys.exit(1)

init_data = init.json()
payment_ref = init_data.get('payment_ref')
print(f'Payment ref: {payment_ref}')

# Step 3: Confirm payment (mock)
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
    sys.exit(1)

confirm_data = confirm.json()
order_id = confirm_data.get('order_id')
print(f'CONFIRM SUCCESS: order_id={order_id}')

# Step 4: Get secure download link
dl_resp = requests.get(f'{BASE}/products/{product_id}/download', headers=headers)
print(f'DOWNLOAD INIT STATUS: {dl_resp.status_code}')
if dl_resp.status_code != 200:
    print('DOWNLOAD INIT FAILED:', dl_resp.text)
    sys.exit(1)

dl_data = dl_resp.json()
print(f'Download availability: {dl_data.get("download_available")}')
secure_url = dl_data.get('download_url')
print(f'Secure download url: {secure_url}')

if not secure_url:
    print('ERROR: secure_url is empty')
    sys.exit(1)

# Step 5: Execute download (should redirect to pCloud URL)
# Ensure the URL is absolute
if secure_url.startswith('/'):
    file_url = f'http://localhost:8000{secure_url}'
else:
    file_url = f'http://localhost:8000/api{secure_url}'

file_resp = requests.get(file_url, headers=headers)
print(f'DOWNLOAD FILE STATUS: {file_resp.status_code}')
if file_resp.status_code != 200:
    print('DOWNLOAD FILE FAILED:', file_resp.text)
    sys.exit(1)

file_data = file_resp.json()
print(f'Download Response JSON: {file_data}')

redirect_url = file_data.get('redirect_url', '')
if file_data.get('type') != 'external' or (redirect_url != test_pcloud_url and not redirect_url.endswith('product.pdf')):
    print(f'ERROR: Expected external type and redirect_url {test_pcloud_url} or direct PDF link')
    sys.exit(1)

print('SUCCESS: Redirected correctly to pCloud!')

# Step 6: Verify statistics and activity logs in SQLite
db3 = SessionLocal()
p_after = db3.query(Product).filter(Product.id == product_id).first()
print(f'Downloads count BEFORE: {original_downloads} | AFTER: {p_after.downloads}')

if (p_after.downloads or 0) != original_downloads + 1:
    print('ERROR: Download count was not incremented correctly')
    sys.exit(1)

# Check activity log
from app.models.user_activity import UserActivity
act = db3.query(UserActivity).filter(
    UserActivity.user_id == user_id,
    UserActivity.activity_type == 'download'
).order_by(UserActivity.created_at.desc()).first()

if not act:
    print('ERROR: Download activity was not logged')
    sys.exit(1)
    
print(f'Logged activity: {act.activity_type} | details: {act.details}')
db3.close()

print('ALL TESTS PASSED SUCCESSFULLY!')
