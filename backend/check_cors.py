import urllib.request
import traceback

try:
    # 1. OPTIONS request (Preflight)
    req_options = urllib.request.Request('https://lumora-backend-8mf6.onrender.com/api/products/196', method='OPTIONS')
    req_options.add_header('Origin', 'https://lumora-lemon-seven.vercel.app')
    req_options.add_header('Access-Control-Request-Method', 'GET')
    with urllib.request.urlopen(req_options) as response:
        print("OPTIONS Status:", response.status)
        print("OPTIONS Headers:", response.headers)

    # 2. GET request
    req = urllib.request.Request('https://lumora-backend-8mf6.onrender.com/api/products/196', method='GET')
    req.add_header('Origin', 'https://lumora-lemon-seven.vercel.app')
    req.add_header('Authorization', 'Bearer INVALID_TOKEN_123')
    req.add_header('Accept', 'application/json, text/plain, */*')
    with urllib.request.urlopen(req) as response:
        print("GET Status:", response.status)
        print("GET Headers:", response.headers)
        print("GET Body:", response.read().decode('utf-8')[:200])
except urllib.error.HTTPError as e:
    print("HTTP Error Status:", e.code)
    print("Error Headers:", e.headers)
    print("Error Body:", e.read().decode('utf-8'))
except Exception as e:
    print("Exception:")
    traceback.print_exc()
