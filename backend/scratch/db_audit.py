import sys
sys.path.insert(0, '.')
from app.db.session import SessionLocal
from app.models.user import User
from sqlalchemy import text

db = SessionLocal()

# Check what's left in the users table fully
u = db.query(User).filter(User.id == 253).first()
print('=== User ID=253 Full Record ===')
print(f'  id            : {u.id}')
print(f'  name          : {u.name!r}')
print(f'  email         : {u.email!r}')
print(f'  role          : {u.role!r}')
print(f'  firebase_uid  : {u.firebase_uid!r}')
print(f'  is_active     : {getattr(u, "is_active", "N/A")}')
print(f'  is_verified   : {getattr(u, "is_verified", "N/A")}')
print(f'  created_at    : {u.created_at}')
print(f'  last_login_at : {getattr(u, "last_login_at", "N/A")}')
print(f'  avatar_url    : {getattr(u, "avatar_url", "N/A")}')

# Check all tables
tables = db.execute(text("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).fetchall()
print()
print('=== All SQLite Tables ===')
for t in tables:
    count = db.execute(text(f'SELECT COUNT(*) FROM "{t[0]}"')).scalar()
    print(f'  {t[0]}: {count} rows')

db.close()
