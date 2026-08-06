import sqlite3
import json
import re
import sys
from pathlib import Path

# Render PostgreSQL URL
RENDER_PG_URL = "postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni?sslmode=require"

root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

report_data = {}

# ==============================================================================
# PHASE 1: IDENTIFY EVERY DATABASE USED IN CODEBASE
# ==============================================================================
print("Starting Phase 1: Database Inventory Search...")
keywords = [
    "DATABASE_URL", "create_engine", "sqlite://", "postgresql://", "postgres://",
    "SessionLocal", "Firestore", "firebase_admin", "firestore.client",
    "initialize_app", "credentials.Certificate"
]

db_usage_matches = []
for py_file in backend_dir.rglob("*.py"):
    if ".venv" in py_file.parts or "__pycache__" in py_file.parts:
        continue
    try:
        content = py_file.read_text(encoding="utf-8", errors="ignore")
        for kw in keywords:
            if kw in content:
                for line_idx, line in enumerate(content.splitlines(), start=1):
                    if kw in line:
                        db_usage_matches.append({
                            "file": str(py_file.relative_to(root_dir)),
                            "line": line_idx,
                            "keyword": kw,
                            "snippet": line.strip()[:150]
                        })
    except Exception as e:
        pass

report_data["phase1_db_matches_count"] = len(db_usage_matches)

# ==============================================================================
# PHASE 5: INSPECT ALL ORDERS IN lumora.db, test.db, test_lumora_sandbox.db & PostgreSQL
# ==============================================================================
def classify_user(email: str, name: str) -> str:
    if not email and not name:
        return "Unknown / Empty"
    e = (email or "").lower()
    n = (name or "").lower()
    if "admin" in e or "admin" in n or e == "avikapawar08@gmail.com":
        return "Internal Admin"
    if "test" in e or "test" in n or "e2e" in e or "e2e" in n:
        return "E2E Test / Automated Testing"
    if "alice" in n or "bob" in n or "buyer_" in e or "aff_" in e:
        return "Seed Data / Manual Testing"
    if "example.com" in e or "test.com" in e or "lumora.io" in e or "lumora.com" in e:
        return "Developer / Test Account"
    return "Real Customer"

def inspect_db_orders(db_path: Path, label: str):
    orders_info = []
    if not db_path.exists():
        return orders_info
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [t[0] for t in cursor.fetchall()]

    if "orders" not in tables:
        conn.close()
        return orders_info

    # Inspect schema
    cursor.execute("PRAGMA table_info(orders);")
    cols = [c[1] for c in cursor.fetchall()]

    cursor.execute("SELECT * FROM orders;")
    rows = cursor.fetchall()
    
    user_map = {}
    if "users" in tables:
        cursor.execute("PRAGMA table_info(users);")
        u_cols = [c[1] for c in cursor.fetchall()]
        u_id_idx = u_cols.index("id") if "id" in u_cols else 0
        u_name_idx = u_cols.index("name") if "name" in u_cols else 1
        u_email_idx = u_cols.index("email") if "email" in u_cols else 2
        cursor.execute("SELECT * FROM users;")
        for u in cursor.fetchall():
            user_map[u[u_id_idx]] = {"name": u[u_name_idx], "email": u[u_email_idx]}

    for r in rows:
        row_dict = dict(zip(cols, r))
        o_id = row_dict.get("id")
        u_id = row_dict.get("user_id")
        amt = row_dict.get("total_amount") or row_dict.get("price") or 0.0
        status = row_dict.get("status")
        created = row_dict.get("created_at") or row_dict.get("createdAt")
        pay_id = row_dict.get("razorpay_payment_id") or row_dict.get("payment_id") or "N/A"
        
        u_info = user_map.get(u_id, {"name": "NOT FOUND", "email": "N/A"})
        c_name = u_info["name"]
        c_email = u_info["email"]
        classification = classify_user(c_email, c_name)

        orders_info.append({
            "order_id": o_id,
            "user_id": u_id,
            "customer_name": c_name,
            "email": c_email,
            "amount": amt,
            "status": status,
            "created_at": str(created),
            "payment_id": pay_id,
            "classification": classification
        })
    conn.close()
    return orders_info

print("Inspecting lumora.db orders...")
lumora_orders = inspect_db_orders(root_dir / "lumora.db", "lumora.db")
report_data["lumora_orders"] = lumora_orders

print("Inspecting test.db orders...")
test_orders = inspect_db_orders(root_dir / "test.db", "test.db")
report_data["test_orders"] = test_orders

print("Inspecting test_lumora_sandbox.db orders...")
sandbox_orders = inspect_db_orders(backend_dir / "test_lumora_sandbox.db", "test_lumora_sandbox.db")
report_data["sandbox_orders"] = sandbox_orders

# ==============================================================================
# PHASE 6: COMPARATIVE MATRIX ACROSS ALL DATABASES
# ==============================================================================
db_files = {
    "lumora.db (root)": root_dir / "lumora.db",
    "lumora.db (backend)": backend_dir / "lumora.db",
    "test.db (root)": root_dir / "test.db",
    "test.db (backend)": backend_dir / "test.db",
    "test_lumora_sandbox.db": backend_dir / "test_lumora_sandbox.db",
    "test_financial_precision.db": root_dir / "test_financial_precision.db",
    "test_admin_auth.db": root_dir / "test_admin_auth.db",
    "test_payout_enterprise.db": root_dir / "test_payout_enterprise.db",
    "test_upload_auth.db": root_dir / "test_upload_auth.db",
}

matrix = {}
for name, path in db_files.items():
    if not path.exists():
        continue
    try:
        conn = sqlite3.connect(str(path))
        c = conn.cursor()
        c.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [t[0] for t in c.fetchall()]
        
        counts = {}
        for t in ("users", "orders", "payments", "refunds", "refund_requests", "products"):
            if t in tables:
                c.execute(f"SELECT COUNT(*) FROM {t};")
                counts[t] = c.fetchone()[0]
            else:
                counts[t] = 0
        
        rev = 0.0
        if "orders" in tables:
            try:
                c.execute("SELECT SUM(total_amount) FROM orders WHERE LOWER(status) IN ('completed','paid','success');")
                r = c.fetchone()[0]
                rev = float(r) if r else 0.0
            except Exception:
                pass

        matrix[name] = {
            "size_bytes": path.stat().st_size,
            "users": counts["users"],
            "orders": counts["orders"],
            "payments": counts["payments"],
            "refunds": counts["refunds"] or counts["refund_requests"],
            "products": counts["products"],
            "revenue": rev
        }
        conn.close()
    except Exception as e:
        matrix[name] = {"error": str(e)}

# Add Render PostgreSQL to matrix
try:
    from sqlalchemy import create_engine, text
    pg_engine = create_engine(RENDER_PG_URL)
    with pg_engine.connect() as conn:
        t_res = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"))
        pg_tables = [r[0] for r in t_res.fetchall()]
        pg_counts = {}
        for t in ("users", "orders", "payments", "refunds", "refund_requests", "products"):
            if t in pg_tables:
                pg_counts[t] = conn.execute(text(f"SELECT COUNT(*) FROM {t};")).fetchone()[0]
            else:
                pg_counts[t] = 0
        matrix["Render PostgreSQL"] = {
            "size_bytes": "Remote Database",
            "users": pg_counts["users"],
            "orders": pg_counts["orders"],
            "payments": pg_counts["payments"],
            "refunds": pg_counts["refunds"] or pg_counts["refund_requests"],
            "products": pg_counts["products"],
            "revenue": 0.0
        }
except Exception as e:
    matrix["Render PostgreSQL"] = {"error": str(e)}

report_data["database_matrix"] = matrix

# Save full audit JSON
output_json = root_dir / "scratch" / "p0_forensics_data.json"
output_json.write_text(json.dumps(report_data, indent=2), encoding="utf-8")
print(f"P0 Forensics Data collection completed. Saved to {output_json}")
