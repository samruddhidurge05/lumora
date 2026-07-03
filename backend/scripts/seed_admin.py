"""
scripts/seed_admin.py
---------------------
Creates a real admin user in SQLite so the admin UI can exchange a
Firebase-sync token for a valid Lumora backend JWT.

Run once from the backend/ directory:
    python scripts/seed_admin.py

The script is idempotent — it skips creation if the email already exists.

Default credentials (override via env vars ADMIN_EMAIL / ADMIN_PASSWORD):
    email:    admin@lumora.co
    password: LumoraAdmin2024!
"""

import os
import sys

# Make sure app package is importable from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.db.database import engine
from app.models import Base
from app.models.user import User
from app.core.security import get_password_hash

ADMIN_EMAIL    = os.getenv("ADMIN_EMAIL",    "admin@lumora.co")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin1234")   # kept under 72 bytes for bcrypt
ADMIN_NAME     = os.getenv("ADMIN_NAME",     "Lumora Admin")


def seed_admin():
    # Ensure tables exist (safe to call multiple times)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == ADMIN_EMAIL.lower()).first()
        if existing:
            if existing.role != "admin":
                existing.role = "admin"
                db.commit()
                print(f"[seed_admin] Updated existing user {ADMIN_EMAIL} → role=admin")
            else:
                print(f"[seed_admin] Admin user already exists: {ADMIN_EMAIL} (id={existing.id})")
            return existing.id

        admin = User(
            name=ADMIN_NAME,
            email=ADMIN_EMAIL.lower(),
            password_hash=get_password_hash(ADMIN_PASSWORD),
            role="admin",
            is_active=True,
            is_verified=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        print(f"[seed_admin] Admin user created: {ADMIN_EMAIL} (id={admin.id})")
        print(f"[seed_admin] Password: {ADMIN_PASSWORD}")
        print(f"[seed_admin] Role: admin")
        return admin.id

    except Exception as e:
        db.rollback()
        print(f"[seed_admin] Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    admin_id = seed_admin()
    print(f"\n[seed_admin] Done. Admin SQLite id = {admin_id}")
    print("[seed_admin] The admin UI will obtain a JWT via POST /api/auth/login")
