import httpx
import time

url = "http://localhost:8000/api/affiliate/referrals/click"
payload = {
    "referral_code": "DEV-456",
    "product_id": 1
}

# We need a valid JWT token to call /dashboard to see the clicks.
# Wait, /referrals/click does NOT require authentication!
print("Sending request 1...")
r1 = httpx.post(url, json=payload, headers={"User-Agent": "Test-Agent-123"})
print(f"Status: {r1.status_code}")
try:
    print(r1.json())
except:
    print(r1.text)

print("Sending request 2 (should be deduplicated)...")
r2 = httpx.post(url, json=payload, headers={"User-Agent": "Test-Agent-123"})
print(f"Status: {r2.status_code}")
try:
    print(r2.json())
except:
    print(r2.text)
