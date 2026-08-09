import os
import sys
import json
import re

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath("backend"))

print("=== 1. BACKEND ENVIRONMENT (.env audit) ===")
env_file = ".env"
if os.path.exists(env_file):
    with open(env_file, "r", encoding="utf-8") as f:
        env_content = f.read()
    print("Found .env file:")
    for line in env_content.splitlines():
        if line.strip() and not line.strip().startswith("#"):
            key = line.split("=")[0]
            val = line.split("=", 1)[1] if "=" in line else ""
            # Obfuscate secrets
            if "SECRET" in key or "KEY" in key or "PASSWORD" in key or "DATABASE_URL" in key:
                val = val[:10] + "..." if len(val) > 10 else "***"
            print(f"  {key} = {val}")
else:
    print("No root .env found")

backend_env = "backend/.env"
if os.path.exists(backend_env):
    with open(backend_env, "r", encoding="utf-8") as f:
        env_content = f.read()
    print("\nFound backend/.env file:")
    for line in env_content.splitlines():
        if line.strip() and not line.strip().startswith("#"):
            key = line.split("=")[0]
            val = line.split("=", 1)[1] if "=" in line else ""
            if "SECRET" in key or "KEY" in key or "PASSWORD" in key or "DATABASE_URL" in key:
                val = val[:10] + "..." if len(val) > 10 else "***"
            print(f"  {key} = {val}")

print("\n=== 2. FASTAPI ROUTE AUDIT ===")
try:
    from app.main import app
    print("Successfully imported FastAPI app!")
    routes = []
    for route in app.routes:
        methods = getattr(route, "methods", None)
        path = getattr(route, "path", None)
        name = getattr(route, "name", None)
        if path:
            methods_str = ",".join(sorted(list(methods))) if methods else "ALL"
            routes.append((methods_str, path, name))
    
    routes.sort(key=lambda x: x[1])
    print(f"Total registered backend routes: {len(routes)}")
    for m, p, n in routes:
        print(f"  {m:<15} {p:<45} ({n})")
except Exception as e:
    print(f"Failed to inspect FastAPI routes: {e}")

print("\n=== 3. DATABASE CONFIGURATION AUDIT ===")
try:
    from app.db.session import engine, DATABASE_URL
    print(f"Configured DATABASE_URL dialect: {engine.dialect.name}")
    print(f"Engine URL (redacted): {str(engine.url)[:25]}...")
except Exception as e:
    print(f"Database session audit error: {e}")
