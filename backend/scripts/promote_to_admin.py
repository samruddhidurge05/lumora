"""
scripts/promote_to_admin.py
----------------------------
Promotes any specified email address to role='admin' in the database.
If the user does not exist in the database, it creates a new active admin user.

Usage:
    python backend/scripts/promote_to_admin.py user@example.com
"""

import os
import sys

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.db.database import engine
from app.models import Base
from app.models.user import User
from app.core.security import get_password_hash


def promote_user_to_admin(email: str):
    email_clean = email.strip().lower()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        user = db.query(User).filter(User.email == email_clean).first()
        if user:
            user.role = "admin"
            user.is_active = True
            user.is_verified = True
            db.commit()
            print(f"[SUCCESS] User '{email_clean}' promoted to role='admin' (User ID: {user.id})")
            return user.id
        else:
            new_admin = User(
                name="Admin User",
                email=email_clean,
                password_hash=get_password_hash("LumoraAdmin2024!"),
                role="admin",
                is_active=True,
                is_verified=True,
            )
            db.add(new_admin)
            db.commit()
            db.refresh(new_admin)
            print(f"[SUCCESS] New admin user created for '{email_clean}' (User ID: {new_admin.id})")
            return new_admin.id
    except Exception as err:
        db.rollback()
        print(f"[ERROR] Failed to promote '{email_clean}': {err}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python backend/scripts/promote_to_admin.py <email_address>")
        sys.exit(1)
    
    target_email = sys.argv[1]
    promote_user_to_admin(target_email)
