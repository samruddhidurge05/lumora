import os
import sys
import requests
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

env_file = backend_dir / ".env"
if env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=str(env_file), override=True)

from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.models.product import Product
from app.models.user import User

def test_api_crud():
    print("==========================================================")
    print("TESTING API CRUD ENDPOINTS OVER HTTP (FASTAPI)")
    print("==========================================================")
    
    db = SessionLocal()
    try:
        # Create an admin user token
        admin = db.query(User).filter(User.role == 'admin').first()
        if not admin:
            print("No admin user found in DB")
            return
        token = create_access_token(data={"sub": str(admin.id), "role": "admin"})
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        base_url = "http://localhost:8000/api"
        # Or test directly against FastAPI app instance using TestClient
        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)
        
        print("\n--- 1. Testing POST /api/admin/products/ (Create) ---")
        create_payload = {
            "title": "API_TEST_PRODUCT_TEMP_789",
            "description": "Created via TestClient",
            "short_desc": "Short desc",
            "category": "Graphics & UI",
            "price": 199.0,
            "seller": "Lumora Admin",
            "status": "published"
        }
        res_create = client.post("/api/admin/products/", json=create_payload, headers=headers)
        print(f"POST /api/admin/products/ Status: {res_create.status_code}")
        print(f"Response: {res_create.json()}")
        
        if res_create.status_code == 200:
            created_data = res_create.json()
            pid = created_data['id']
            
            print(f"\n--- 2. Testing PUT /api/admin/products/{pid} (Edit) ---")
            update_payload = {
                "title": "API_TEST_PRODUCT_UPDATED_789",
                "price": 249.0
            }
            res_update = client.put(f"/api/admin/products/{pid}", json=update_payload, headers=headers)
            print(f"PUT /api/admin/products/{pid} Status: {res_update.status_code}")
            print(f"Response: {res_update.json()}")
            
            print(f"\n--- 3. Testing DELETE /api/admin/products/{pid} (Delete) ---")
            res_delete = client.delete(f"/api/admin/products/{pid}", headers=headers)
            print(f"DELETE /api/admin/products/{pid} Status: {res_delete.status_code}")
            print(f"Response: {res_delete.json() if res_delete.content else 'NO_CONTENT'}")
            
            print(f"\n--- 4. Testing GET /api/admin/products/ (Readback Verification) ---")
            res_get = client.get("/api/admin/products/", headers=headers)
            prods = res_get.json().get('products', [])
            found = [p for p in prods if p['id'] == pid]
            print(f"Product ID {pid} in GET /api/admin/products/ list after DELETE: {len(found) > 0}")

    finally:
        db.close()

if __name__ == "__main__":
    test_api_crud()
