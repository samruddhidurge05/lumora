import sys
import os

path = "../frontend/src/pages/admin/ProductsManagement.jsx" if os.path.exists("../frontend/src/pages/admin/ProductsManagement.jsx") else "frontend/src/pages/admin/ProductsManagement.jsx"
with open(path, "r", encoding="utf-8", errors="replace") as f:
    for idx, line in enumerate(f, 1):
        if "pcloud" in line.lower() or "download" in line.lower() or "image" in line.lower():
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            print(f"{idx}: {line.strip()}")
