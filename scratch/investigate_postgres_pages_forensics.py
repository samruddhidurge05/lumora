import sys
import json
import sqlite3
import re
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

RENDER_PG_URL = "postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni?sslmode=require"

forensic_data = {}

# ==============================================================================
# PHASE 3 & 4: READ-ONLY QUERIES AGAINST RENDER POSTGRESQL, LUMORA.DB, TEST.DB
# ==============================================================================
def query_pg():
    pg_res = {}
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(RENDER_PG_URL)
        with engine.connect() as conn:
            # Table list
            tables = [r[0] for r in conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")).fetchall()]
            pg_res["tables"] = tables

            # Query admin_invitations
            inv_rows = conn.execute(text("SELECT * FROM admin_invitations;")).fetchall() if "admin_invitations" in tables else []
            pg_res["admin_invitations"] = {
                "count": len(inv_rows),
                "rows": [dict(r._mapping) for r in inv_rows[:20]]
            }

            # Query admin_roles
            roles_rows = conn.execute(text("SELECT * FROM admin_roles;")).fetchall() if "admin_roles" in tables else []
            pg_res["admin_roles"] = {
                "count": len(roles_rows),
                "rows": [dict(r._mapping) for r in roles_rows[:20]]
            }

            # Query users with admin or team roles
            user_rows = conn.execute(text("SELECT id, name, email, role, is_active, created_at FROM users WHERE LOWER(role) IN ('admin', 'super_admin', 'team');")).fetchall() if "users" in tables else []
            pg_res["admin_users"] = {
                "count": len(user_rows),
                "rows": [dict(r._mapping) for r in user_rows[:20]]
            }

            # Query all users count
            total_users = conn.execute(text("SELECT COUNT(*) FROM users;")).fetchone()[0] if "users" in tables else 0
            pg_res["total_users_count"] = total_users

            # Query audit logs
            audit_count = conn.execute(text("SELECT COUNT(*) FROM audit_logs;")).fetchone()[0] if "audit_logs" in tables else 0
            pg_res["audit_logs_count"] = audit_count

            # Query products
            product_count = conn.execute(text("SELECT COUNT(*) FROM products;")).fetchone()[0] if "products" in tables else 0
            pg_res["products_count"] = product_count

    except Exception as e:
        pg_res["error"] = str(e)
    return pg_res

def query_sqlite(db_path: Path):
    s_res = {}
    if not db_path.exists():
        return s_res
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [r[0] for r in c.fetchall()]
        s_res["tables"] = tables

        if "admin_invitations" in tables:
            c.execute("SELECT * FROM admin_invitations;")
            rows = [dict(r) for r in c.fetchall()]
            s_res["admin_invitations"] = {"count": len(rows), "rows": rows[:20]}
        else:
            s_res["admin_invitations"] = {"count": 0, "rows": []}

        if "admin_roles" in tables:
            c.execute("SELECT * FROM admin_roles;")
            rows = [dict(r) for r in c.fetchall()]
            s_res["admin_roles"] = {"count": len(rows), "rows": rows[:20]}
        else:
            s_res["admin_roles"] = {"count": 0, "rows": []}

        if "users" in tables:
            c.execute("SELECT id, name, email, role, is_active FROM users WHERE LOWER(role) IN ('admin', 'super_admin', 'team');")
            rows = [dict(r) for r in c.fetchall()]
            s_res["admin_users"] = {"count": len(rows), "rows": rows[:20]}

            c.execute("SELECT COUNT(*) FROM users;")
            s_res["total_users_count"] = c.fetchone()[0]

        conn.close()
    except Exception as e:
        s_res["error"] = str(e)
    return s_res

forensic_data["render_postgresql"] = query_pg()
forensic_data["lumora_db_sqlite"] = query_sqlite(root_dir / "lumora.db")
forensic_data["test_db_sqlite"] = query_sqlite(root_dir / "test.db")

# ==============================================================================
# PHASE 5: CODE SEARCH FOR INVITATION AND ROLE WRITE PATHS (INSERT, UPDATE, DELETE)
# ==============================================================================
write_paths = []
for py_file in backend_dir.rglob("*.py"):
    if ".venv" in str(py_file):
        continue
    rel = str(py_file.relative_to(root_dir)).replace("\\", "/")
    txt = py_file.read_text(encoding="utf-8", errors="ignore")
    
    if "AdminInvitation" in txt or "AdminRole" in txt or "admin_invitations" in txt or "admin_roles" in txt:
        inserts = re.findall(r'(\.add\(|\.commit\(|INSERT INTO|db\.add\(AdminInvitation|db\.add\(AdminRole)', txt)
        if inserts:
            write_paths.append({
                "file": rel,
                "mentions_invitation": "AdminInvitation" in txt or "admin_invitations" in txt,
                "mentions_role": "AdminRole" in txt or "admin_roles" in txt,
                "has_db_add_or_commit": True
            })

forensic_data["backend_write_paths"] = write_paths

# Output forensic report JSON
out_file = root_dir / "scratch" / "postgres_pages_forensic_investigation.json"
out_file.write_text(json.dumps(forensic_data, indent=2, default=str), encoding="utf-8")
print(f"PostgreSQL Pages Forensic Investigation Script Complete. Saved to {out_file}")
