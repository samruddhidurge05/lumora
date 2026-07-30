import urllib.request
import traceback

try:
    req_options = urllib.request.Request('https://lumora-backend-8mf6.onrender.com/api/affiliate/track-click/AFF0001', method='OPTIONS')
    req_options.add_header('Origin', 'https://lumora-lemon-seven.vercel.app')
    req_options.add_header('Access-Control-Request-Method', 'POST')
    with urllib.request.urlopen(req_options) as response:
        print("OPTIONS Status:", response.status)
        print("OPTIONS Headers:", response.headers)
except urllib.error.HTTPError as e:
    print("HTTP Error Status:", e.code)
    print("Error Headers:", e.headers)
except Exception as e:
    print("Exception:")
    traceback.print_exc()
