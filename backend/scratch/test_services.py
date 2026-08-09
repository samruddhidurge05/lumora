import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.admin_api.reviews.services import get_paginated_reviews, get_reviews_dashboard_data
from app.admin_api.reports.services import get_reports_list, get_reports_analytics_data
from app.shared.firebase.connection import firebase_connected

def run_service_test():
    print(f"firebase_connected: {firebase_connected}")

    print("\n--- REVIEWS SERVICE OUTPUT ---")
    rev_res = get_paginated_reviews(page=1, page_size=50, sentiment=None, search=None)
    print("get_paginated_reviews total:", rev_res.get("total"))
    print("get_paginated_reviews item count:", len(rev_res.get("items", [])))
    if rev_res.get("items"):
        print("Sample item:", rev_res["items"][0])

    print("\n--- REPORTS SERVICE OUTPUT ---")
    rep_res = get_reports_list(page=1, page_size=50, status=None, search=None)
    print("get_reports_list total:", rep_res.get("total"))
    print("get_reports_list item count:", len(rep_res.get("items", [])))
    if rep_res.get("items"):
        print("Sample item:", rep_res["items"][0])

if __name__ == "__main__":
    run_service_test()
