import os
import sys

# Add project root to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set env vars to ensure we load correct DB
os.environ["STORAGE_PROVIDER"] = "local"

from app.admin_api.analytics.services import get_full_dashboard_data

print("Calling get_full_dashboard_data()...")
try:
    data = get_full_dashboard_data()
    print("SUCCESS!")
    print("Data keys:", list(data.keys()))
    print("KPIs:", data["kpis"])
    print("Live Feed events count:", len(data["liveFeed"]))
    print("Live Feed sample:", data["liveFeed"][:2])
except Exception as e:
    print("FAILED with error:", e)
    import traceback
    traceback.print_exc()
