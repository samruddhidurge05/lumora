import urllib.request
import traceback
import json

try:
    req = urllib.request.Request('https://lumora-backend-8mf6.onrender.com/api/products/116', method='GET')
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print("Body:", response.read().decode('utf-8')[:200])
except urllib.error.HTTPError as e:
    print("HTTP Error Status:", e.code)
    print("Error Body:", e.read().decode('utf-8'))
except Exception as e:
    print("Exception:")
    traceback.print_exc()
