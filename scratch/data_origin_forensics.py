import sys
import os
import json
import re
import sqlite3
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
frontend_dir = root_dir / "frontend"

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

RENDER_PG_URL = "postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni?sslmode=require"

origin_audit = {}

# ==============================================================================
# PHASE 1 & 2 & 3: REPOSITORY-WIDE WRITE & READ PATH SEARCH FOR TEAM & INVITATIONS
# ==============================================================================
team_keywords = [
    "AdminInvitation", "admin_invitations", "invite_admin", "send_invitation",
    "accept_invite", "AdminRole", "admin_roles", "TeamMember", "team/invite",
    "team/invitations", "team/accept-invite"
]

backend_occurrences = []
for py_file in backend_dir.rglob("*.py"):
    if ".venv" in str(py_file):
        continue
    rel = str(py_file.relative_to(root_dir)).replace("\\", "/")
    txt = py_file.read_text(encoding="utf-8", errors="ignore")

    for kw in team_keywords:
        if kw in txt:
            has_write = bool(re.search(r'(\.add\(|\.commit\(|INSERT INTO|db\.add|db\.delete|UPDATE)', txt))
            has_read = bool(re.search(r'(\.query\(|\.filter\(|SELECT|db\.collection)', txt))
            backend_occurrences.append({
                "file": rel,
                "keyword": kw,
                "has_write": has_write,
                "has_read": has_read
            })

origin_audit["backend_team_occurrences"] = backend_occurrences

# ==============================================================================
# PHASE 5: SEARCH FIRESTORE COLLECTIONS FOR TEAM / INVITATIONS / ADMINS
# ==============================================================================
fs_team_cols = set()
for py_file in backend_dir.rglob("*.py"):
    if ".venv" in str(py_file):
        continue
    txt = py_file.read_text(encoding="utf-8", errors="ignore")
    for col in ("invitations", "members", "team", "admins", "adminUsers", "staff", "organization", "admin_invitations"):
        if f'collection("{col}")' in txt or f"collection('{col}')" in txt:
            fs_team_cols.add(col)

origin_audit["firestore_team_collections_found"] = sorted(list(fs_team_cols))

# ==============================================================================
# PHASE 6: SEARCH MOCK DATA / STATIC ARRAYS IN FRONTEND & BACKEND
# ==============================================================================
mock_team_files = []
for file_path in (list(frontend_dir.rglob("*.jsx")) + list(frontend_dir.rglob("*.js")) + list(backend_dir.rglob("*.json"))):
    if "node_modules" in str(file_path) or ".venv" in str(file_path) or "dist" in str(file_path):
        continue
    rel = str(file_path.relative_to(root_dir)).replace("\\", "/")
    try:
        txt = file_path.read_text(encoding="utf-8", errors="ignore")
        if any(term in txt.lower() for term in ("mock_invitations", "mock_team", "initialteam", "sampleteam", "dummyteam", "mockadmin")):
            mock_team_files.append(rel)
    except Exception:
        pass

origin_audit["mock_team_files_found"] = sorted(list(set(mock_team_files)))

# ==============================================================================
# PHASE 4: CHECK BACKUP FILES IN BACKEND/BACKUPS/ FOR INVITATION/TEAM DOCUMENTS
# ==============================================================================
backup_dir = backend_dir / "backups"
backup_team_records = {}

if backup_dir.exists():
    for b_file in backup_dir.glob("*.json"):
        try:
            content = json.loads(b_file.read_text(encoding="utf-8", errors="ignore"))
            if isinstance(content, dict):
                has_inv = "invitations" in content or "admin_invitations" in content or "team" in content
                backup_team_records[b_file.name] = {
                    "keys": list(content.keys()),
                    "has_invitations": has_inv
                }
        except Exception as e:
            backup_team_records[b_file.name] = {"error": str(e)}

origin_audit["backup_team_audit"] = backup_team_records

# Output report
out_json = root_dir / "scratch" / "data_origin_forensic_report.json"
out_json.write_text(json.dumps(origin_audit, indent=2), encoding="utf-8")
print(f"Data Origin Forensic Audit Script Complete. Results saved to {out_json}")
