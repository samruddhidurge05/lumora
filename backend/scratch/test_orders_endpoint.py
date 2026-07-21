import os
import sys

# Add project root to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set env vars to ensure we load correct DB
os.environ["STORAGE_PROVIDER"] = "local"

from app.admin_api.orders.services import get_orders_list

print("Testing get_orders_list(page=1, page_size=5)...")
try:
    res = get_orders_list(page=1, page_size=5)
    print("SUCCESS!")
    print("Total orders count:", res["total"])
    print("Page size returned:", res["page_size"])
    print("Items count returned:", len(res["items"]))
    if res["items"]:
        print("First order details:", res["items"][0])
except Exception as e:
    print("FAILED with error:", e)
    import traceback
    traceback.print_exc()
