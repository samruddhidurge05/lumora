import sys
import os
import json
import re
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
frontend_dir = root_dir / "frontend"

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

audit_data = {}

# ==============================================================================
# PHASE 1: DISCOVER EVERY ADMIN PAGE IN FRONTEND
# ==============================================================================
admin_pages_dir = frontend_dir / "src" / "pages" / "admin"
admin_pages = []

if admin_pages_dir.exists():
    for f in admin_pages_dir.glob("*.jsx"):
        admin_pages.append(f.name)

audit_data["admin_pages_inventory"] = sorted(admin_pages)

# ==============================================================================
# PHASE 2 & 3 & 4: MAP DATA FLOW, APIS, SERVICES, DATABASES, FALLBACKS
# ==============================================================================
admin_routes_dir = backend_dir / "app" / "admin_api"
legacy_admin_dir = backend_dir / "admin" / "routes"

backend_files = list(admin_routes_dir.rglob("*.py")) if admin_routes_dir.exists() else []
if legacy_admin_dir.exists():
    backend_files.extend(list(legacy_admin_dir.rglob("*.py")))

file_analysis = {}

for py_file in backend_files:
    rel_path = str(py_file.relative_to(root_dir)).replace("\\", "/")
    content = py_file.read_text(encoding="utf-8", errors="ignore")

    # Find endpoints
    endpoints = re.findall(r'@router\.(get|post|put|delete|patch)\(["\']([^"\']+)["\']', content)
    
    # Firestore collections
    fs_collections = set(re.findall(r'collection\(["\']([^"\']+)["\']\)', content))
    
    # SQL Models / Tables
    sql_models = set(re.findall(r'query\(([A-Z][A-Za-z0-9]+)\)', content))
    
    # Check Fallbacks
    has_fs_broken = "_firestore_broken" in content or "firebase_connected" in content
    has_sql_fallback = "SessionLocal" in content
    has_mock_fallback = "mock" in content.lower() or "json" in content.lower()

    file_analysis[rel_path] = {
        "endpoints": [f"{method.upper()} {path}" for method, path in endpoints],
        "firestore_collections": list(fs_collections),
        "sql_models": list(sql_models),
        "has_firestore_broken_guard": has_fs_broken,
        "uses_sql_session": has_sql_fallback,
        "has_mock_references": has_mock_fallback
    }

audit_data["backend_file_analysis"] = file_analysis

# ==============================================================================
# PHASE 7 & 8 & 9 & 10: SCAN COLLECTION, TABLE, SQLITE, MOCK REFS REPOSITORY-WIDE
# ==============================================================================
all_fs_collections = set()
all_sql_models = set()
sqlite_refs = []
mock_refs = []

for py_file in backend_dir.rglob("*.py"):
    if ".venv" in str(py_file):
        continue
    rel = str(py_file.relative_to(root_dir)).replace("\\", "/")
    txt = py_file.read_text(encoding="utf-8", errors="ignore")
    
    for c in re.findall(r'collection\(["\']([^"\']+)["\']\)', txt):
        all_fs_collections.add(c)
        
    for m in re.findall(r'query\(([A-Z][A-Za-z0-9]+)\)', txt):
        all_sql_models.add(m)

    if "lumora.db" in txt or "test.db" in txt or "sqlite3" in txt:
        sqlite_refs.append(rel)

    if "mock" in txt.lower() or "dummy" in txt.lower() or "fake" in txt.lower():
        mock_refs.append(rel)

audit_data["firestore_collections_discovered"] = sorted(list(all_fs_collections))
audit_data["sql_models_discovered"] = sorted(list(all_sql_models))
audit_data["sqlite_references"] = sorted(list(set(sqlite_refs)))
audit_data["mock_references_backend"] = sorted(list(set(mock_refs)))

# Output results
out_json = root_dir / "scratch" / "enterprise_admin_forensic_audit.json"
out_json.write_text(json.dumps(audit_data, indent=2), encoding="utf-8")
print(f"Enterprise Admin Forensic Audit Script Complete. Results saved to {out_json}")
