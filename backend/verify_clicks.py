import requests
import json
import time

API_URL = "http://127.0.0.1:8000/api/affiliate/track-click/AFF001"

print("--- SCENARIO 1: Same IP clicks the same referral twice ---")
res1 = requests.post(API_URL, headers={"X-Forwarded-For": "192.168.1.1"})
print("Click 1 (192.168.1.1):", res1.json())

res2 = requests.post(API_URL, headers={"X-Forwarded-For": "192.168.1.1"})
print("Click 2 (192.168.1.1) [Should be ignored internally but return 200]:", res2.json())

print("\n--- SCENARIO 2: Different IP clicks the same referral ---")
res3 = requests.post(API_URL, headers={"X-Forwarded-For": "192.168.1.2"})
print("Click 3 (192.168.1.2) [Should be counted]:", res3.json())

print("\n--- SCENARIO 3: Same IP clicks a different affiliate referral ---")
# Assuming AFF002 exists or we just test AFF001 for now
try:
    res4 = requests.post("http://127.0.0.1:8000/api/affiliate/track-click/AFF002", headers={"X-Forwarded-For": "192.168.1.1"})
    print("Click 4 (192.168.1.1 -> AFF002):", res4.json())
except:
    print("AFF002 might not exist, skipping.")
