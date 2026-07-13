import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app
import app.api.auth_router as auth_router

# Mock verify_firebase_id_token to return valid claims
def mock_verify_firebase_id_token(id_token, project_id):
    return {
        "uid": "test_firebase_uid_999",
        "email": "test_firebase_user_999@example.com",
        "name": "Test Firebase User",
        "email_verified": True
    }

auth_router.verify_firebase_id_token = mock_verify_firebase_id_token

client = TestClient(app)

try:
    response = client.post(
        "/api/auth/firebase-sync",
        json={"idToken": "dummy_jwt_token", "role": "customer"}
    )
    print("STATUS CODE:", response.status_code)
    print("RESPONSE JSON:", response.json())
except Exception as e:
    import traceback
    print("EXCEPTION OCCURRED:")
    traceback.print_exc()
