"""
PHASE 8 — PRODUCTION FIX
========================
Cleans ALL fake @lumora.io admin records from EVERY database file
found at the project root and in backend/.

Targets:
  - root/test.db          (37 fake admins, 47 @lumora.io users, 140 invitations)
  - root/lumora.db        (clean users, but 0 admin_roles — leaves Platform Admin only)
  - backend/lumora.db     (already clean — verify only)
  - backend/scratch/*.db  (backup file with 252 fake admins — DELETE backup)

DO NOT run this from the backend/ subdirectory.
Run from project root: python cleanup_all_fake_admins.py
"""
import sqlite3
import os
import shutil
from datetime import datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(ROOT, "backend")
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

LEGIT_EMAILS = {
    "avikapawar08@gmail.com",
    "451.avikapawar@gmail.com",
    "admin@lumora.co",
    "samruddhidurge05@gmail.com",
    "admin@lumora.com",   # old legacy from test.db.bak
    "admin@gmail.com",    # old legacy
    "avikapawar4@gmail.com",  # old legacy
}

def purge_fake_admins(db_path: str, label: str):
    """Remove all @lumora.io admins, their admin_roles, admin_invitations, and audit_logs."""
    if not os.path.exists(db_path):
        print(f"  [SKIP] {label} — file not found: {db_path}")
        return

    size = os.path.getsize(db_path)
    print(f"\n{'='*65}")
    print(f"CLEANING: {label}")
    print(f"  Path: {db_path}  ({size:,} bytes)")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Check if users table exists
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cur.fetchall()]
    if "users" not in tables:
        print(f"  [SKIP] No users table.")
        conn.close()
        return

    # --- Step 1: Find all fake admin user IDs ---
    cur.execute("SELECT id, name, email, role FROM users WHERE role='admin'")
    all_admins = [dict(r) for r in cur.fetchall()]
    fake_admins = [u for u in all_admins if u["email"].lower() not in LEGIT_EMAILS]
    legit_admins = [u for u in all_admins if u["email"].lower() in LEGIT_EMAILS]

    print(f"  Legitimate admins kept: {len(legit_admins)}")
    for u in legit_admins:
        print(f"    ✅ id={u['id']} | {u['name']} | {u['email']}")
    print(f"  Fake admins to remove: {len(fake_admins)}")

    if not fake_admins:
        print(f"  [OK] No fake admins found — skipping.")
        conn.close()
        return

    fake_ids = [u["id"] for u in fake_admins]
    placeholders = ",".join(["?" for _ in fake_ids])

    # --- Step 2: Delete admin_roles for fake users ---
    deleted_roles = 0
    if "admin_roles" in tables:
        cur.execute(f"SELECT COUNT(*) FROM admin_roles WHERE user_id IN ({placeholders})", fake_ids)
        deleted_roles = cur.fetchone()[0]
        cur.execute(f"DELETE FROM admin_roles WHERE user_id IN ({placeholders})", fake_ids)
        print(f"  admin_roles deleted: {deleted_roles}")

    # --- Step 3: Delete admin_invitations for @lumora.io emails ---
    deleted_invitations = 0
    if "admin_invitations" in tables:
        cur.execute("SELECT COUNT(*) FROM admin_invitations WHERE email LIKE '%@lumora.io%'")
        deleted_invitations = cur.fetchone()[0]
        cur.execute("DELETE FROM admin_invitations WHERE email LIKE '%@lumora.io%'")
        print(f"  admin_invitations deleted: {deleted_invitations}")

    # --- Step 4: Delete audit_logs referencing fake users ---
    deleted_logs = 0
    if "audit_logs" in tables:
        cur.execute(f"SELECT COUNT(*) FROM audit_logs WHERE admin_user_id IN ({placeholders})", fake_ids)
        deleted_logs = cur.fetchone()[0]
        cur.execute(f"DELETE FROM audit_logs WHERE admin_user_id IN ({placeholders})", fake_ids)
        print(f"  audit_logs deleted: {deleted_logs}")

    # --- Step 5: Delete fake user records ---
    cur.execute(f"DELETE FROM users WHERE id IN ({placeholders})", fake_ids)
    print(f"  users deleted: {len(fake_ids)}")

    conn.commit()

    # --- Step 6: Verify ---
    cur.execute("SELECT COUNT(*) FROM users WHERE email LIKE '%@lumora.io%'")
    remaining_lumora = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM users WHERE role='admin'")
    remaining_admins = cur.fetchone()[0]
    print(f"\n  VERIFICATION AFTER CLEANUP:")
    print(f"    Remaining admin users: {remaining_admins}")
    print(f"    Remaining @lumora.io users: {remaining_lumora}")
    if remaining_admins > 0:
        cur.execute("SELECT id,name,email FROM users WHERE role='admin'")
        for r in cur.fetchall():
            print(f"      ✅ {dict(r)}")

    conn.close()
    print(f"  [DONE] Cleaned {label}")


def delete_contaminated_backup(db_path: str, label: str):
    """Delete a backup database file that was pre-contamination."""
    if not os.path.exists(db_path):
        print(f"  [SKIP] {label} — file not found: {db_path}")
        return
    # Rename to .purged instead of deleting, for safety
    purged_path = db_path + f".purged_{TIMESTAMP}"
    os.rename(db_path, purged_path)
    print(f"  [RENAMED] {label}")
    print(f"    {db_path}")
    print(f"    → {purged_path}")


print("PHASE 8 — PRODUCTION CLEANUP OF ALL FAKE ADMIN RECORDS")
print(f"Timestamp: {TIMESTAMP}\n")

# 1. Clean root/test.db — most contaminated (37 fake admins, 140 invitations)
purge_fake_admins(os.path.join(ROOT, "test.db"), "ROOT/test.db")

# 2. Clean root/lumora.db — less contaminated but has 0 admin_roles
purge_fake_admins(os.path.join(ROOT, "lumora.db"), "ROOT/lumora.db")

# 3. Verify backend/lumora.db (should already be clean)
purge_fake_admins(os.path.join(BACKEND, "lumora.db"), "BACKEND/lumora.db")

# 4. Rename the pre-cleanup backup in scratch/ (it has all 252 fake admins)
backup_db = os.path.join(BACKEND, "scratch", "lumora_backup_20260729_165409.db")
delete_contaminated_backup(backup_db, "BACKEND/scratch/lumora_backup_20260729_165409.db")

print(f"\n{'='*65}")
print("ALL CLEANUPS COMPLETE")
print(f"{'='*65}")
print()
print("NEXT STEPS FOR RENDER PRODUCTION:")
print("1. The ROOT test.db is now clean.")
print("2. Set DATABASE_URL explicitly in Render Environment Variables:")
print("   DATABASE_URL = sqlite:///./lumora.db")
print("   (Or preferably point to a persistent disk path)")
print("3. Confirm Render's working directory is 'backend/' not project root.")
print("4. Push this cleanup to git so Render pulls the clean test.db on redeploy.")
