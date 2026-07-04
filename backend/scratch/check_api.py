import httpx

try:
    # 1. Test platform status
    resp = httpx.get("http://localhost:8000/api/public/platform/status")
    print("Platform status code:", resp.status_code)
    print("Platform status JSON:", resp.json())

    # 2. Test public products catalog
    resp = httpx.get("http://localhost:8000/api/products/")
    print("Products status code:", resp.status_code)
    products = resp.json()
    print("Total products fetched:", len(products))
    if products:
        print("First product sample:", products[0])
except Exception as e:
    print("API request failed:", e)
