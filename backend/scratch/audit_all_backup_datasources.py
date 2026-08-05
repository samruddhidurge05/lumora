import sys
import os
import sqlite3
import json

backend_dir = os.path.dirname(os.path.abspath(__file__))
repo_root = os.path.dirname(backend_dir)

db_files = [
    os.path.join(repo_root, "test.db"),
    os.path.join(repo_root, "lumora.db"),
    os.path.join(backend_dir, "lumora.db"),
    os.path.join(backend_dir, "backups", "lumora_backup_20260718_233756.db"),
    os.path.join(backend_dir, "backups", "lumora_backup_pre_cleanup.db"),
    os.path.join(backend_dir, "backups", "lumora_backup_reviews_20260719_000428.db"),
    os.path.join(backend_dir, "scratch", "lumora_backup_20260729_165409.db"),
]

print("======================================================================")
print("COMPREHENSIVE MULTI-DATASOURCE AUDIT (SEARCHING ALL DATABASES/BACKUPS)")
print("======================================================================")

for db_path in db_files:
    if not os.path.exists(db_path):
        print(f"\n[NOT FOUND] {db_path}")
        continue
    
    print(f"\n" + "="*70)
    print(f"AUDITING DATABASE: {db_path} (Size: {os.path.getsize(db_path):,} bytes)")
    print("="*70)
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Check tables
        tables = [r[0] for r in cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()]
        print(f"Tables present ({len(tables)}): {', '.join(tables)}")
        
        # Check users
        if "users" in tables:
            cursor.execute("SELECT * FROM users")
            users = cursor.fetchall()
            print(f"\n  [users table] Total rows: {len(users)}")
            for u in users:
                u_dict = dict(u)
                email = u_dict.get("email", "")
                role = u_dict.get("role", "")
                name = u_dict.get("name", "")
                uid = u_dict.get("firebase_uid", "")
                if not email.lower().endswith("@lumora.io"):
                    print(f"    - NON-TEST User ID={u_dict.get('id')} | Name={name!r} | Email={email!r} | Role={role!r} | UID={uid!r}")
                else:
                    print(f"    - @lumora.io User ID={u_dict.get('id')} | Name={name!r} | Email={email!r} | Role={role!r}")
        
        # Check admin_roles
        if "admin_roles" in tables:
            cursor.execute("SELECT * FROM admin_roles")
            roles = cursor.fetchall()
            print(f"\n  [admin_roles table] Total rows: {len(roles)}")
            for r in roles:
                r_dict = dict(r)
                cursor.execute("SELECT email FROM users WHERE id = ?", (r_dict.get("user_id"),))
                u_row = cursor.fetchone()
                u_email = u_row["email"] if u_row else "ORPHAN"
                if not u_email.lower().endswith("@lumora.io"):
                    print(f"    - NON-TEST Role ID={r_dict.get('id')} | UserID={r_dict.get('user_id')} ({u_email}) | Level={r_dict.get('role_level')} | Active={r_dict.get('is_active')}")

        # Check admin_invitations
        if "admin_invitations" in tables:
            cursor.execute("SELECT * FROM admin_invitations")
            invs = cursor.fetchall()
            print(f"\n  [admin_invitations table] Total rows: {len(invs)}")
            for inv in invs:
                inv_dict = dict(inv)
                email = inv_dict.get("email", "")
                if not email.lower().endswith("@lumora.io"):
                    print(f"    - NON-TEST Inv ID={inv_dict.get('id')} | Email={email!r} | Level={inv_dict.get('role_level')} | Accepted={inv_dict.get('accepted_at')}")

        conn.close()
    except Exception as e:
        print(f"  [ERROR auditing {db_path}]: {e}")

print("\n" + "="*70)
print("AUDITING FIRESTORE BACKUP JSON FILES")
print("="*70)

json_files = [
    os.path.join(backend_dir, "backups", "firestore_backup_20260718_233756.json"),
    os.path.join(backend_dir, "backups", "firestore_backup_reviews_20260719_000428.json"),
]

for j_path in json_files:
    if not os.path.exists(j_path):
        print(f"\n[NOT FOUND] {j_path}")
        continue
    print(f"\nInspecting JSON: {j_path} ({os.path.getsize(j_path):,} bytes)")
    try:
        with open(j_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            print(f"  Top-level collections: {list(data.keys())}")
            for coll_name, coll_data in data.items():
                if isinstance(coll_data, list):
                    print(f"    Collection '{coll_name}': {len(coll_data)} items")
                    for item in coll_data:
                        if isinstance(item, dict):
                            # Print any admin / role / invite fields
                            email = item.get("email") or item.get("customerEmail") or item.get("userEmail")
                            role = item.get("role") or item.get("role_level")
                            if email or role:
                                print(f"      Item in '{coll_name}': email={email!r} role={role!r}")
    except Exception as e:
        print(f"  [ERROR reading {j_path}]: {e}")
