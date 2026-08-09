import os
import sys

sys.path.insert(0, os.path.abspath("backend"))

os.environ["STORAGE_PROVIDER"] = "local" # avoid slow b2 auth network delay during route inspection

from app.main import app
from app.db.session import engine

print("=== FASTAPI REGISTERED ROUTES ===")
routes = []
for route in app.routes:
    methods = getattr(route, "methods", None)
    path = getattr(route, "path", None)
    name = getattr(route, "name", None)
    if path:
        methods_str = ",".join(sorted(list(methods))) if methods else "ALL"
        routes.append((methods_str, path, name))

routes.sort(key=lambda x: x[1])
for m, p, n in routes:
    print(f"{m:<15} {p:<50} ({n})")

print(f"\nTotal routes: {len(routes)}")

print("\n=== DATABASE CONFIGURATION ===")
print("Dialect:", engine.dialect.name)
print("Driver:", engine.driver)
print("URL Scheme:", engine.url.drivername)
print("Host:", engine.url.host)
print("Database Name:", engine.url.database)
