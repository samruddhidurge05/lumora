import os
import sys
import json
import re
import sqlite3
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

report = {}

# ==============================================================================
# PHASE 1: SEARCH ALL ORDER CREATION AND PAYMENT WRITE SITES IN REPOSITORY
# ==============================================================================
search_keywords = [
    "create_order", "OrderModel", "orders.add", "collection(\"orders\")",
    "db.collection(\"orders\")", "payment_success", "payment_verified",
    "razorpay", "capture", "checkout", "webhook", "insert(OrderModel)",
    "session.add(OrderModel)"
]

write_sites = []
for py_file in backend_dir.rglob("*.py"):
    if ".venv" in py_file.parts or "__pycache__" in py_file.parts:
        continue
    try:
        content = py_file.read_text(encoding="utf-8", errors="ignore")
        for kw in search_keywords:
            if kw in content:
                for line_num, line in enumerate(content.splitlines(), start=1):
                    if kw in line:
                        # Filter out pure imports or docstrings
                        if any(w in line for w in ("db.collection(\"orders\").add", "db.collection(\"orders\").doc", "db.collection('orders')", "session.add", "db.add", "Order(")):
                            write_sites.append({
                                "file": str(py_file.relative_to(root_dir)),
                                "line": line_num,
                                "keyword": kw,
                                "code": line.strip()[:150]
                            })
    except Exception:
        pass

report["phase1_order_write_sites"] = write_sites

# ==============================================================================
# PHASE 2: SEARCH FOR ALL BACKUP FILES, EXPORTS, JSON DUMPS, MIGRATION SCRIPTS
# ==============================================================================
potential_backups = []
for ext in ("*.json", "*.sql", "*.db", "*.bak", "*.csv", "*.dump", "*.gz", "*.tar"):
    for path in root_dir.rglob(ext):
        if ".venv" in path.parts or "node_modules" in path.parts or ".git" in path.parts:
            continue
        try:
            potential_backups.append({
                "file": str(path.relative_to(root_dir)),
                "size_bytes": path.stat().st_size,
                "name": path.name
            })
        except Exception:
            pass

report["phase2_backups_found"] = potential_backups

# ==============================================================================
# PHASE 5: INSPECT PRODUCT MIGRATION SCRIPT TO EXPLAIN WHY ORDERS WERE SKIPPED
# ==============================================================================
migration_scripts = []
for p in (backend_dir / "scripts", backend_dir / "migrations", backend_dir, root_dir / "scripts"):
    if p.exists():
        for f in p.glob("*.py"):
            try:
                txt = f.read_text(encoding="utf-8", errors="ignore")
                if "migrate" in f.name or "Postgres" in txt or "postgres" in txt:
                    migration_scripts.append({
                        "file": str(f.relative_to(root_dir)),
                        "has_products_migration": "Product" in txt or "products" in txt,
                        "has_orders_migration": "Order" in txt or "orders" in txt,
                        "summary_snippet": "\n".join([line.strip() for line in txt.splitlines() if any(k in line for k in ("Product", "Order", "pg_url", "engine"))][:10])
                    })
            except Exception:
                pass

report["phase5_migration_scripts"] = migration_scripts

# Save results
out_file = root_dir / "scratch" / "p0_recovery_evidence.json"
out_file.write_text(json.dumps(report, indent=2), encoding="utf-8")
print(f"Phase 1, 2, 5 analysis completed. Written to {out_file}")
