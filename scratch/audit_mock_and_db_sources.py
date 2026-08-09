import os
import re
from pathlib import Path

def search_keywords():
    keywords = ["mock", "demo", "seed", "fallback", "placeholder", "hardcoded", "fake"]
    results = {k: [] for k in keywords}
    
    # Search in backend/app and frontend/src
    for search_dir in ["backend/app", "frontend/src", "admin-app/src"]:
        if not os.path.exists(search_dir):
            continue
        for path in Path(search_dir).rglob("*"):
            if path.is_file() and path.suffix in [".py", ".js", ".jsx", ".ts", ".tsx", ".json"]:
                try:
                    content = path.read_text(encoding="utf-8", errors="ignore")
                    for k in keywords:
                        matches = re.findall(rf'.{{0,30}}{k}.{{0,30}}', content, re.IGNORECASE)
                        if matches:
                            results[k].append((str(path), len(matches)))
                except Exception:
                    pass
    return results

print("=== MOCK / DEMO / SEED DATA OCCURRENCES ===")
res = search_keywords()
for k, list_files in res.items():
    print(f"\nKeyword: '{k}' (found in {len(list_files)} files)")
    for filepath, count in list_files[:10]: # Top 10 per keyword
        print(f"  {filepath}: {count} occurrences")
