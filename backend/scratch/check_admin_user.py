import sys
import os

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)

from app.db.database import SessionLocal
from app.models.user import User

def check_users():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print("=" * 80)
        print("DATABASE USER ACCOUNTS")
        print("=" * 80)
        for u in users:
            print(f"ID={u.id} | Name={u.name} | Email={u.email} | Role={u.role}")
    finally:
        db.close()

if __name__ == "__main__":
    check_users()
