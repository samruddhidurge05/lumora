import urllib.request
import traceback
import json

try:
    req = urllib.request.Request('https://lumora-backend-8mf6.onrender.com/api/auth/firebase-sync', method='POST')
    req.add_header('Content-Type', 'application/json')
    # Just send an empty body or dummy token, we just want to see if the endpoint EXISTS (not 404)
    data = json.dumps({"token": "dummy", "role": "customer"}).encode('utf-8')
    with urllib.request.urlopen(req, data=data) as response:
        print("Status:", response.status)
except urllib.error.HTTPError as e:
    print("HTTP Error Status:", e.code)
    print("Error Body:", e.read().decode('utf-8'))
except Exception as e:
    print("Exception:")
    traceback.print_exc()
