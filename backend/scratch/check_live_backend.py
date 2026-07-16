import urllib.request, json
try:
    url = "https://lumora-backend-8mf6.onrender.com/api/products/"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.loads(r.read().decode())
    print("API returned", len(data), "products:")
    for p in data[:15]:
        print(f"  - ID {p.get('id')}: {p.get('title')} (created_at: {p.get('created_at')})")
except Exception as e:
    print("Failed to fetch live backend products:", e)
