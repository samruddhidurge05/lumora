import os, sys
sys.path.insert(0, '.')

from dotenv import load_dotenv
load_dotenv()

print('=== PAYMENT SYSTEM HEALTH CHECK ===\n')

# 1. Check env vars
key_id     = os.getenv('RAZORPAY_KEY_ID', '')
key_secret = os.getenv('RAZORPAY_KEY_SECRET', '')
gateway    = os.getenv('PAYMENT_GATEWAY', 'mock')
currency   = os.getenv('PAYMENT_CURRENCY', 'INR')
mode       = 'TEST' if 'test' in key_id else 'LIVE'
print(f'[1] PAYMENT_GATEWAY    : {gateway}')
print(f'[1] RAZORPAY_KEY_ID    : {key_id[:16]}... ({mode} mode)')
print(f'[1] RAZORPAY_KEY_SECRET: {key_secret[:4]}...{key_secret[-4:]}  (set={bool(key_secret)})')
print(f'[1] PAYMENT_CURRENCY   : {currency}\n')

# 2. Check gateway factory loads
from app.payments.gateway.factory import get_gateway
gw = get_gateway()
print(f'[2] Gateway class      : {type(gw).__name__}  OK\n')

# 3. Test Razorpay API credentials with a live API call
import razorpay
client = razorpay.Client(auth=(key_id, key_secret))
try:
    order = client.order.create({'amount': 100, 'currency': 'INR', 'receipt': 'health_check'})
    print(f'[3] Razorpay API call  : SUCCESS')
    print(f'    Test Order ID      : {order["id"]}')
    print(f'    Order Status       : {order["status"]}\n')
except Exception as e:
    print(f'[3] Razorpay API call  : FAILED -> {e}\n')

# 4. SQLite DB
from app.db.session import get_db
from app.models.product import Product
db = next(get_db())
count = db.query(Product).filter(Product.status == 'published').count()
print(f'[4] SQLite DB          : Connected  ({count} published products)\n')

# 5. Check Razorpay checkout script in index.html
html_path = '../frontend/index.html'
with open(html_path) as f:
    html = f.read()
if 'checkout.razorpay.com' in html:
    print('[5] Razorpay SDK tag   : Present in index.html  OK')
else:
    print('[5] Razorpay SDK tag   : MISSING from index.html  WARNING')

# 6. Check payment routes exist
from app.api.payments.routes import router
routes = [r.path for r in router.routes]
required = ['/initiate', '/confirm', '/webhook/razorpay']
for r in required:
    status = 'OK' if r in routes else 'MISSING'
    print(f'[6] Route {r:<30}: {status}')

print('\n=== ALL CHECKS COMPLETE ===')
