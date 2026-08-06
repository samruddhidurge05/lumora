import sys
import json
import sqlite3
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

RENDER_PG_URL = "postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni?sslmode=require"

investigation_results = {}

# ==============================================================================
# PHASE 1 & 2: CODE MAPPING OF ALL ADMIN ENDPOINTS TO THEIR DATA SOURCES & FALLBACKS
# ==============================================================================
admin_modules = [
    {
        "module": "Orders",
        "route_file": "backend/app/admin_api/orders/routes.py",
        "service_file": "backend/app/admin_api/orders/services.py",
    },
    {
        "module": "Payments",
        "route_file": "backend/app/admin_api/payments/routes.py",
        "service_file": "backend/app/admin_api/payments/services.py",
    },
    {
        "module": "Reviews",
        "route_file": "backend/app/admin_api/reviews/routes.py",
        "service_file": "backend/app/admin_api/reviews/services.py",
    },
    {
        "module": "Reports",
        "route_file": "backend/app/admin_api/reports/routes.py",
        "service_file": "backend/app/admin_api/reports/services.py",
    },
    {
        "module": "Team / Admins / Invitations",
        "route_file": "backend/admin/routes/admin_invitations.py",
        "service_file": "backend/admin/routes/admin_team.py",
    },
    {
        "module": "Customers / Users",
        "route_file": "backend/app/admin_api/customers/routes.py",
        "service_file": "backend/app/admin_api/customers/services.py",
    },
    {
        "module": "Vendors",
        "route_file": "backend/app/admin_api/vendors/routes.py",
        "service_file": "backend/app/admin_api/vendors/services.py",
    },
    {
        "module": "Affiliates",
        "route_file": "backend/admin/routes/affiliates.py",
        "service_file": "backend/admin/routes/affiliates.py",
    }
]

code_map = {}
for item in admin_modules:
    mod_name = item["module"]
    s_path = root_dir / item["service_file"]
    r_path = root_dir / item["route_file"]
    
    s_txt = s_path.read_text(encoding="utf-8", errors="ignore") if s_path.exists() else ""
    r_txt = r_path.read_text(encoding="utf-8", errors="ignore") if r_path.exists() else ""
    combined = s_txt + "\n" + r_txt

    uses_firestore = "db.collection(" in combined or "firestore" in combined.lower()
    uses_sql = "SessionLocal" in combined or "db.query(" in combined or "select(" in combined.lower()
    has_fallback = "_firestore_broken" in combined or "except" in combined

    # Check fallback details
    fallback_target = "None"
    if has_fallback:
        if "SessionLocal" in combined or "OrderModel" in combined or "UserModel" in combined:
            fallback_target = "SQL (SessionLocal / DATABASE_URL)"
        elif "json" in combined.lower() or "mock" in combined.lower():
            fallback_target = "JSON / Mock Fallback"

    code_map[mod_name] = {
        "service_file": item["service_file"],
        "route_file": item["route_file"],
        "uses_firestore": uses_firestore,
        "uses_sql": uses_sql,
        "has_fallback": has_fallback,
        "fallback_target": fallback_target
    }

investigation_results["dependency_map"] = code_map

# ==============================================================================
# PHASE 4 & 7: RENDER POSTGRESQL VS SQLITE TABLE COUNTS FOR TEAM, REVIEWS, REPORTS, ORDERS
# ==============================================================================
def inspect_pg():
    pg_data = {}
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(RENDER_PG_URL)
        with engine.connect() as conn:
            t_res = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"))
            tables = [r[0] for r in t_res.fetchall()]
            pg_data["tables_found"] = tables

            counts = {}
            for t in ("users", "admin_roles", "admin_invitations", "orders", "payments", "reviews", "reports", "products", "refund_requests"):
                if t in tables:
                    res = conn.execute(text(f"SELECT COUNT(*) FROM {t};"))
                    counts[t] = res.fetchone()[0]
                else:
                    counts[t] = 0
            pg_data["row_counts"] = counts

            # Inspect Team / Admin users in Postgres
            if "users" in tables:
                admin_res = conn.execute(text("SELECT id, name, email, role, is_active FROM users WHERE LOWER(role) IN ('admin', 'super_admin', 'team');"))
                pg_data["admin_users"] = [{"id": r[0], "name": r[1], "email": r[2], "role": r[3], "active": r[4]} for r in admin_res.fetchall()]
            
            # Inspect Admin Invitations in Postgres
            if "admin_invitations" in tables:
                inv_res = conn.execute(text("SELECT * FROM admin_invitations LIMIT 10;"))
                pg_data["invitations_count"] = conn.execute(text("SELECT COUNT(*) FROM admin_invitations;")).fetchone()[0]

    except Exception as e:
        pg_data["error"] = str(e)
    return pg_data

def inspect_sqlite(db_path: Path):
    s_data = {}
    if not db_path.exists():
        return s_data
    try:
        conn = sqlite3.connect(str(db_path))
        c = conn.cursor()
        c.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [t[0] for t in c.fetchall()]
        s_data["tables"] = tables
        
        counts = {}
        for t in ("users", "admin_roles", "admin_invitations", "orders", "payments", "reviews", "reports", "products"):
            if t in tables:
                c.execute(f"SELECT COUNT(*) FROM {t};")
                counts[t] = c.fetchone()[0]
            else:
                counts[t] = 0
        s_data["row_counts"] = counts

        if "users" in tables:
            c.execute("SELECT id, name, email, role FROM users WHERE LOWER(role) IN ('admin', 'super_admin', 'team');")
            s_data["admin_users"] = [{"id": r[0], "name": r[1], "email": r[2], "role": r[3]} for r in c.fetchall()]

        if "admin_invitations" in tables:
            c.execute("SELECT COUNT(*) FROM admin_invitations;")
            s_data["invitations_count"] = c.fetchone()[0]

        conn.close()
    except Exception as e:
        s_data["error"] = str(e)
    return s_data

investigation_results["render_postgres_data"] = inspect_pg()
investigation_results["lumora_db_data"] = inspect_sqlite(root_dir / "lumora.db")
investigation_results["test_db_data"] = inspect_sqlite(root_dir / "test.db")

# Output JSON report
out_file = root_dir / "scratch" / "data_inconsistency_investigation.json"
out_file.write_text(json.dumps(investigation_results, indent=2), encoding="utf-8")
print(f"Data Inconsistency Forensic Script complete. Saved to {out_file}")
