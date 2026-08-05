import sys, os
os.environ['FIREBASE_SERVICE_ACCOUNT_JSON'] = 'lumora-e6ddc-firebase-adminsdk-fbsvc-abcf2d8c21.json'
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.db.session import SessionLocal
from app.models.user import User
from app.services.customer_identity_service import resolve_customer_identity

db_s = SessionLocal()
for uid in [51, 52, 15, 49, 48, 47]:
    u = db_s.query(User).filter(User.id == uid).first()
    name, email = resolve_customer_identity(db_s, user_id=uid)
    print(f'User ID={uid}: SQL user exists={u is not None}, Resolved Name="{name}", Email="{email}"')
db_s.close()
