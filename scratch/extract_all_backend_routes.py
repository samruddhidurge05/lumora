import os
import re
from pathlib import Path

def extract_routes():
    pattern = re.compile(r'@(?:router|app)\.(get|post|put|delete|patch)\(\s*["\']([^"\']+)["\']')
    routes = []
    for path in Path("backend/app").rglob("*.py"):
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
            for match in pattern.finditer(content):
                method, endpoint = match.groups()
                routes.append((method.upper(), endpoint, str(path.relative_to(Path("backend")))))
        except Exception:
            pass
    return sorted(routes, key=lambda x: x[1])

print("=== STATICALLY EXTRACTED BACKEND ROUTES ===")
all_routes = extract_routes()
for method, endpoint, filepath in all_routes:
    print(f"  {method:<7} {endpoint:<45} in {filepath}")

print(f"\nTotal routes found: {len(all_routes)}")
