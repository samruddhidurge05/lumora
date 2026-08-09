import os
import json

def inspect_manifests():
    b_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backups"))
    
    for fname in ["review_cleanup_manifest.json", "cleanup_manifest.json", "dry_run_manifest_latest.json"]:
        fpath = os.path.join(b_dir, fname)
        if not os.path.exists(fpath):
            continue
        print(f"\n=====================================================")
        print(f"MANIFEST: {fname}")
        print(f"=====================================================")
        with open(fpath, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
                if isinstance(data, dict):
                    print("Keys:", list(data.keys()))
                    for k in ["deleted_reports", "reports", "deleted_reviews", "reviews", "reports_backed_up", "reviews_backed_up"]:
                        if k in data:
                            val = data[k]
                            print(f"  {k} count/type: {len(val) if isinstance(val, (list, dict)) else val}")
                            if isinstance(val, (list, dict)) and len(val) > 0:
                                print("  Sample:", json.dumps(val if isinstance(val, list) else list(val.items())[:5], indent=2)[:500])
            except Exception as e:
                print(f"Error reading {fname}: {e}")

if __name__ == "__main__":
    inspect_manifests()
