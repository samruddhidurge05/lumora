import requests
import random
import sys

BASE_URL = "http://127.0.0.1:8000/api"

def run_test():
    print("=== STARTING FULL FLOW VERIFICATION ===")
    
    # 1. Register a new customer
    email = f"test_flow_user_{random.randint(10000, 99999)}@example.com"
    name = "Test Flow Customer"
    password = "Password123!"
    
    print(f"Registering user: {email}...")
    reg_res = requests.post(f"{BASE_URL}/auth/register", json={
        "name": name,
        "email": email,
        "password": password
    })
    
    if reg_res.status_code != 201:
        print(f"Registration failed with code {reg_res.status_code}: {reg_res.text}")
        sys.exit(1)
    
    print("User registered successfully!")
    
    # 2. Login to get access token
    print("Logging in...")
    login_res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": email,
        "password": password
    })
    
    if login_res.status_code != 200:
        print(f"Login failed: {login_res.text}")
        sys.exit(1)
        
    token_data = login_res.json()
    token = token_data["access_token"]
    user_id = token_data["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"Logged in successfully. User ID: {user_id}")
    
    # 3. Get published products
    print("Fetching products...")
    prod_res = requests.get(f"{BASE_URL}/products/")
    if prod_res.status_code != 200:
        print(f"Failed to fetch products: {prod_res.text}")
        sys.exit(1)
        
    products = prod_res.json()
    if not products:
        print("No products found in DB. Cannot continue.")
        sys.exit(1)
        
    product = products[0]
    product_id = product["id"]
    product_price = float(product["price"])
    print(f"Using product '{product['title']}' (ID: {product_id}, Price: INR {product_price})")
    
    # 4. Initiate payment
    print("Initiating payment...")
    idempotency_key = f"verify_flow_{random.randint(100000, 999999)}"
    pay_payload = {
        "items": [{"product_id": product_id, "price_paid": product_price}],
        "total_amount": product_price,
        "currency": "INR",
        "payment_method": "upi_qr",
        "idempotency_key": idempotency_key,
        "promo_code": None,
        "affiliate_code": None,
        "discount_amount": 0.0,
        "tax_amount": 0.0
    }
    
    pay_res = requests.post(f"{BASE_URL}/payments/initiate", json=pay_payload, headers=headers)
    if pay_res.status_code not in (200, 201):
        print(f"Payment initiation failed with code {pay_res.status_code}: {pay_res.text}")
        sys.exit(1)
        
    pay_data = pay_res.json()
    payment_ref = pay_data["payment_ref"]
    print(f"Payment initiated. Ref: {payment_ref}")
    
    # 5. Confirm payment
    print("Confirming payment (mock verification)...")
    confirm_payload = {
        "payment_ref": payment_ref,
        "gateway_payment_id": f"mock_ver_{random.randint(100000, 999999)}",
        "gateway_signature": "mock_sig_ver",
        "payment_method": "upi_qr"
    }
    
    confirm_res = requests.post(f"{BASE_URL}/payments/confirm", json=confirm_payload, headers=headers)
    if confirm_res.status_code != 200:
        print(f"Payment confirmation failed: {confirm_res.text}")
        sys.exit(1)
        
    print("Payment confirmed successfully!")
    
    # 6. Verify order presence in GET /orders/me
    print("Checking /orders/me...")
    orders_res = requests.get(f"{BASE_URL}/orders/me", headers=headers)
    if orders_res.status_code != 200:
        print(f"Failed to fetch orders: {orders_res.text}")
        sys.exit(1)
        
    orders = orders_res.json()
    print("Orders list from /orders/me:", orders)
    user_order = next((o for o in orders if any(item["product_id"] == product_id for item in o["items"])), None)
    if not user_order:
        print("Seeded order not found in /orders/me!")
        sys.exit(1)
        
    print(f"Found completed order ID: {user_order['id']} with status '{user_order['status']}'")
    
    # 7. Verify downloads presence in GET /products/downloads/center
    print("Checking /products/downloads/center...")
    dl_res = requests.get(f"{BASE_URL}/products/downloads/center", headers=headers)
    if dl_res.status_code != 200:
        print(f"Failed to fetch download center: {dl_res.text}")
        sys.exit(1)
        
    dl_center = dl_res.json()
    downloads_list = dl_center.get("downloads", [])
    purchased_dl = next((d for d in downloads_list if d["product_details"]["id"] == product_id), None)
    if not purchased_dl:
        print("Purchased product not present in download center!")
        sys.exit(1)
        
    print(f"Success! Product present in downloads center. Secure download URL: {purchased_dl['download_url']}")
    
    # 8. Verify secure token generation in GET /products/{product_id}/download
    print(f"Checking secure token generation for product {product_id}...")
    token_res = requests.get(f"{BASE_URL}/products/{product_id}/download", headers=headers)
    if token_res.status_code != 200:
        print(f"Failed to generate download token: {token_res.text}")
        sys.exit(1)
        
    token_data = token_res.json()
    print(f"Success! Download token generated. URL: {token_data['download_url']}")
    
    # 9. Verify user activity log contains the purchase activity
    print("Checking user activity logs...")
    act_res = requests.get(f"{BASE_URL}/activity/", headers=headers)
    if act_res.status_code != 200:
        print(f"Failed to fetch activity logs: {act_res.text}")
        sys.exit(1)
        
    activities = act_res.json()
    purchase_act = next((a for a in activities if a["activity_type"] == "payment_success" or a["activity_type"] == "purchase"), None)
    if not purchase_act:
        print("Warning: purchase activity not logged.")
    else:
        print(f"Found activity log: {purchase_act['activity_type']} -> {purchase_act['details']}")
        
    print("\n=== ALL FLOW VERIFICATIONS COMPLETED SUCCESSFULLY ===")
    print("1. Registration / Authentication: OK")
    print("2. Payment initiation & confirmation: OK")
    print("3. SQLite Order Persistence: OK")
    print("4. Owned Product Visibility / Download Center Sync: OK")
    print("5. Secure Tokenized Download Endpoint: OK")

if __name__ == '__main__':
    run_test()
