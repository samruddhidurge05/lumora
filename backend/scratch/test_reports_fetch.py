import sys
import os
import urllib.request
import json

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)

# Try fetching user login token from local sqlite
from app.db.database import SessionLocal
from app.models.user import User
from app.core.config import settings

def test_reports():
    print("=" * 80)
    print("TESTING REPORTS API ENDPOINT WITH AUTHENTICATION")
    print("=" * 80)

    db = SessionLocal()
    # Find any user who is customer
    user = db.query(User).filter(User.role == "customer").first()
    if not user:
        user = db.query(User).first()

    if not user:
        print("No users found in database!")
        return

    print(f"Using User: ID={user.id}, Name={user.name}, Email={user.email}, FirebaseUID={user.firebase_uid}")

    # Generate token using FastAPI helper (or similar) if we can, or bypass auth by calling local get_my_reports directly
    try:
        from app.api.auth_router import create_access_token
        # Create token
        token = create_access_token(data={"sub": str(user.id)})
        print(f"Generated JWT Token: {token[:20]}...")
    except Exception as e:
        print(f"Failed to generate JWT: {e}")
        return

    # Request to live backend reports endpoint
    url = "https://lumora-backend-8mf6.onrender.com/api/reports/me"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {token}")

    print(f"\nRequesting: {url} ...")
    try:
        with urllib.request.urlopen(req) as resp:
            print("HTTP Status:", resp.status)
            print("Response:", resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print("HTTP Status:", e.code)
        print("Error Response:", e.read().decode('utf-8'))

if __name__ == "__main__":
    test_reports()
