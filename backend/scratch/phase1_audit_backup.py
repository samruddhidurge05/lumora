import sys
import os
import sqlite3

backup_path = os.path.join("scratch", "lumora_backup_20260729_165409.db")
if not os.path.exists(backup_path):
    print(f"Backup path not found: {backup_path}")
    sys.exit(1)

conn = sqlite3.connect(backup_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("======================================================================")
print("AUDITING PRE-CLEANUP BACKUP DATABASE: lumora_backup_20260729_165409.db")
print("======================================================================")

# 1. Audit ALL Users in backup
cursor.execute("SELECT * FROM users")
all_users = cursor.fetchall()
non_lumora_io_users = [u for u in all_users if not u["email"].lower().endswith("@lumora.io")]

print(f"\n1. ALL USERS IN BACKUP (Total: {len(all_users)})")
print(f"   Non-@lumora.io Users (Total: {len(non_lumora_io_users)}):")
for u in non_lumora_io_users:
    print(f"   - ID={u['id']} | Name={u['name']!r} | Email={u['email']!r} | Role={u['role']!r} | UID={u['firebase_uid']!r} | Active={u['is_active']} | Created={u['created_at']}")

lumora_io_admin_users = [u for u in all_users if u["email"].lower().endswith("@lumora.io") and u["role"] == "admin"]
print(f"   @lumora.io admin Users count: {len(lumora_io_admin_users)}")

# 2. Audit ALL AdminRoles in backup
cursor.execute("SELECT * FROM admin_roles")
all_roles = cursor.fetchall()
print(f"\n2. ALL ADMIN ROLES IN BACKUP (Total: {len(all_roles)})")
non_lumora_io_roles = []
for r in all_roles:
    cursor.execute("SELECT name, email, role FROM users WHERE id = ?", (r["user_id"],))
    u = cursor.fetchone()
    if not u or not u["email"].lower().endswith("@lumora.io"):
        u_info = f"{u['name']} ({u['email']})" if u else "ORPHAN (NO USER)"
        non_lumora_io_roles.append((r, u_info))

print(f"   Non-@lumora.io AdminRoles (Total: {len(non_lumora_io_roles)}):")
for r, u_info in non_lumora_io_roles:
    print(f"   - Role ID={r['id']} | UserID={r['user_id']} ({u_info}) | Level={r['role_level']} | Active={r['is_active']} | Activated={r['activated_at']}")

# 3. Audit ALL AdminInvitations in backup
cursor.execute("SELECT * FROM admin_invitations")
all_invs = cursor.fetchall()
non_lumora_io_invs = [inv for inv in all_invs if not inv["email"].lower().endswith("@lumora.io")]

print(f"\n3. ALL ADMIN INVITATIONS IN BACKUP (Total: {len(all_invs)})")
print(f"   Non-@lumora.io Invitations (Total: {len(non_lumora_io_invs)}):")
for inv in non_lumora_io_invs:
    print(f"   - Inv ID={inv['id']} | Email={inv['email']!r} | Level={inv['role_level']} | InvitedBy={inv['invited_by']} | Accepted={inv['accepted_at']} | Revoked={inv['revoked_at']} | Expires={inv['expires_at']}")

# 4. Audit AuditLogs in backup
cursor.execute("SELECT * FROM audit_logs ORDER BY id DESC")
all_logs = cursor.fetchall()
print(f"\n4. AUDIT LOGS IN BACKUP (Total: {len(all_logs)})")
non_test_logs = []
for l in all_logs:
    uid = l["admin_user_id"]
    if uid:
        cursor.execute("SELECT email FROM users WHERE id = ?", (uid,))
        u = cursor.fetchone()
        email = u["email"] if u else ""
        if not email or not email.lower().endswith("@lumora.io"):
            non_test_logs.append((l, email or f"User#{uid}"))
    else:
        non_test_logs.append((l, "ANONYMOUS/SYSTEM"))

print(f"   Non-test Audit Logs (Total: {len(non_test_logs)}):")
for l, email in non_test_logs[:30]:
    print(f"   - Log ID={l['id']} | AdminID={l['admin_user_id']} ({email}) | Action={l['action']} | Target={l['target_type']}#{l['target_id']} | Time={l['created_at']}")

# 5. Audit AdminEmailLogs in backup
cursor.execute("SELECT * FROM admin_email_logs ORDER BY id DESC")
all_email_logs = cursor.fetchall()
non_test_email_logs = [el for el in all_email_logs if not el["recipient"].lower().endswith("@lumora.io")]
print(f"\n5. ADMIN EMAIL LOGS IN BACKUP (Total: {len(all_email_logs)})")
print(f"   Non-@lumora.io Email Logs (Total: {len(non_test_email_logs)}):")
for el in non_test_email_logs:
    print(f"   - ID={el['id']} | InvID={el['invitation_id']} | Event={el['event']} | Recipient={el['recipient']} | Provider={el['provider']} | Time={el['created_at']}")

conn.close()
