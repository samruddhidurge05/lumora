import urllib.request
import traceback

try:
    req = urllib.request.Request('https://lumora-backend-8mf6.onrender.com/api/products/196')
    req.add_header('Authorization', 'Bearer THIS_IS_AN_INVALID_TOKEN_12345')
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
except urllib.error.HTTPError as e:
    print("HTTP Error Status:", e.code)
    print("Error Body:", e.read().decode('utf-8'))
except Exception as e:
    print("Exception:")
    traceback.print_exc()
