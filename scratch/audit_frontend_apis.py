import os
import re
from pathlib import Path

def extract_api_calls(directory):
    pattern = re.compile(r'[\'"`](/api/[^\'"`\s\?]+)[\'"`]')
    calls = set()
    for path in Path(directory).rglob('*.js*'):
        if 'node_modules' in str(path) or 'build' in str(path):
            continue
        try:
            content = path.read_text(encoding='utf-8', errors='ignore')
            matches = pattern.findall(content)
            for m in matches:
                # Clean template strings like /api/products/${id} -> /api/products/:id
                clean = re.sub(r'\$\{[^}]+\}', ':id', m)
                calls.add((clean, str(path.relative_to(directory.parent))))
        except Exception:
            pass
    return sorted(list(calls))

print("=== FRONTEND CUSTOMER APP API CALLS ===")
for url, file in extract_api_calls(Path("frontend/src")):
    print(f"  {url:<45} in {file}")

print("\n=== ADMIN APP API CALLS ===")
for url, file in extract_api_calls(Path("admin-app/src")):
    print(f"  {url:<45} in {file}")
