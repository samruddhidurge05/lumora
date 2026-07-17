import requests

def test_api():
    print("Sending request to /api/products/...")
    res = requests.get("http://localhost:8000/api/products/")
    print(f"Status code: {res.status_code}")
    print(f"Products count: {len(res.json())}")

if __name__ == "__main__":
    test_api()
