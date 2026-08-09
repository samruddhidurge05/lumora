import os
import json

b_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backups"))

with open(os.path.join(b_dir, "review_cleanup_manifest.json"), "r", encoding="utf-8") as f:
    data = json.load(f)
    print("=== REVIEW CLEANUP MANIFEST ===")
    print(json.dumps(data, indent=2))

with open(os.path.join(b_dir, "cleanup_manifest.json"), "r", encoding="utf-8") as f:
    data = json.load(f)
    print("\n=== CLEANUP MANIFEST DELETIONS FOR REPORTS ===")
    entries = data.get("manifest_entries", [])
    report_entries = [e for e in entries if e.get("collection") == "reports" or "report" in e.get("path", "").lower()]
    print(f"Total report entries deleted during cleanup: {len(report_entries)}")
    print(json.dumps(report_entries, indent=2))
