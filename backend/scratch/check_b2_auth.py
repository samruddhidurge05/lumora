import os
import requests
from dotenv import load_dotenv

load_dotenv()

key_id = os.getenv("B2_KEY_ID")
app_key = os.getenv("B2_APPLICATION_KEY")

print(f"Key ID: {key_id}")
print(f"App Key: {app_key}")

url = "https://api.backblazeb2.com/b2api/v2/b2_authorize_account"
try:
    resp = requests.get(url, auth=(key_id, app_key), timeout=10)
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text}")
except Exception as e:
    print(f"Exception: {e}")
