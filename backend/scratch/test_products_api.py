import requests
import sys

# 1. Fetch products publicly (no authorization)
res_public = requests.get("http://localhost:8000/api/products/")
print("Public Status Code:", res_public.status_code)
public_products = res_public.json()
print("Public Products Count:", len(public_products))
public_resumes = [p for p in public_products if "resume" in p.get("category", "").lower()]
print("Public Resume Count:", len(public_resumes))

# 2. Login as a customer (e.g. pcloud_flowtest@lumora.dev)
login_res = requests.post(
    "http://localhost:8000/api/auth/login",
    json={"email": "pcloud_flowtest@lumora.dev", "password": "password123"}
)
print("\nLogin Status Code:", login_res.status_code)
token = login_res.json().get("access_token")

# 3. Fetch products as customer
headers = {"Authorization": f"Bearer {token}"}
res_customer = requests.get("http://localhost:8000/api/products/", headers=headers)
print("Customer Status Code:", res_customer.status_code)
customer_products = res_customer.json()
print("Customer Products Count:", len(customer_products))
customer_resumes = [p for p in customer_products if "resume" in p.get("category", "").lower()]
print("Customer Resume Count:", len(customer_resumes))

# 4. Compare lists
missing_in_customer = set(p["id"] for p in public_products) - set(p["id"] for p in customer_products)
print("\nProducts present in public but missing in customer:", missing_in_customer)
