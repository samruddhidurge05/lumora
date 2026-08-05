"""
cleanup_test_admin_records.py
==============================
One-time production database cleanup script.

Deletes all test-generated @lumora.io records from:
  - admin_roles
  - admin_invitations
  - users (where email ends with @lumora.io)

The real production admin (avikapawar08@gmail.com, id=253) is
explicitly excluded and will NOT be touched.

Run from the backend/ directory:
    python scratch/cleanup_test_admin_records.py

A dry-run mode is on by default. Set DRY_RUN = False to commit changes.
"""

import os
import sys
import shutil
from datetime import datetime

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.session import SessionLocal
from app.models.user import User
from app.models.admin_role import AdminRole
from app.models.admin_invitation import AdminInvitation
from app.models.audit_log import AuditLog

# ─── Configuration ─────────────────────────────────────────────────────────────
DRY_RUN = True          # Set to False to actually commit the deletions
BACKUP_DB = True        # Recommended: backup lumora.db before running

# ─── Safety: Emails that must NEVER be deleted ─────────────────────────────────
PROTECTED_EMAILS = {
    "avikapawar08@gmail.com",   # The real platform admin (ID=253)
}

# ─── Backup ────────────────────────────────────────────────────────────────────
def backup_database():
    db_path = os.path.join(backend_dir, "lumora.db")
    if not os.path.exists(db_path):
        print("[BACKUP] lumora.db not found — skipping backup")
        return
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(backend_dir, "scratch", f"lumora_backup_{ts}.db")
    shutil.copy2(db_path, backup_path)
    print(f"[BACKUP] Database backed up to: {backup_path}")


# ─── Main Cleanup ──────────────────────────────────────────────────────────────
def run_cleanup():
    if BACKUP_DB and not DRY_RUN:
        backup_database()

    db = SessionLocal()
    try:
        # ── 1. Identify test User IDs ──────────────────────────────────────────
        test_users = (
            db.query(User)
            .filter(User.email.like("%@lumora.io"))
            .all()
        )

        # Double-check: no protected email should be in this list
        safe_to_delete = [u for u in test_users if u.email not in PROTECTED_EMAILS]
        protected_found = [u for u in test_users if u.email in PROTECTED_EMAILS]

        if protected_found:
            print(f"[GUARD] Protected email(s) found in @lumora.io result — skipping:")
            for u in protected_found:
                print(f"  PROTECTED: {u.email!r} (id={u.id})")

        test_user_ids = [u.id for u in safe_to_delete]

        print(f"\n{'[DRY RUN] ' if DRY_RUN else ''}Cleanup Summary:")
        print(f"  @lumora.io users to delete : {len(safe_to_delete)}")

        # ── 2. Count related records ───────────────────────────────────────────
        role_count = (
            db.query(AdminRole)
            .filter(AdminRole.user_id.in_(test_user_ids))
            .count()
        )
        inv_count = (
            db.query(AdminInvitation)
            .filter(AdminInvitation.email.like("%@lumora.io"))
            .count()
        )
        audit_count = (
            db.query(AuditLog)
            .filter(AuditLog.admin_user_id.in_(test_user_ids))
            .count()
        ) if test_user_ids else 0

        print(f"  AdminRole records to delete    : {role_count}")
        print(f"  AdminInvitation records to delete: {inv_count}")
        print(f"  AuditLog records linked to test users: {audit_count}")

        if DRY_RUN:
            print("\n[DRY RUN] No changes committed. Set DRY_RUN=False to apply.")
            return

        # ── 3. Delete in correct foreign-key order ─────────────────────────────
        print("\nDeleting records...")

        # Delete AdminRoles for test users
        deleted_roles = (
            db.query(AdminRole)
            .filter(AdminRole.user_id.in_(test_user_ids))
            .delete(synchronize_session=False)
        )
        print(f"  Deleted {deleted_roles} AdminRole record(s)")

        # Delete all @lumora.io AdminInvitations (they were never real invites)
        deleted_invs = (
            db.query(AdminInvitation)
            .filter(AdminInvitation.email.like("%@lumora.io"))
            .delete(synchronize_session=False)
        )
        print(f"  Deleted {deleted_invs} AdminInvitation record(s)")

        # Delete AuditLog entries linked to test users (optional — keeps DB clean)
        if test_user_ids and audit_count > 0:
            deleted_audits = (
                db.query(AuditLog)
                .filter(AuditLog.admin_user_id.in_(test_user_ids))
                .delete(synchronize_session=False)
            )
            print(f"  Deleted {deleted_audits} AuditLog record(s)")

        # Delete the User records themselves
        deleted_users = (
            db.query(User)
            .filter(User.id.in_(test_user_ids))
            .delete(synchronize_session=False)
        )
        print(f"  Deleted {deleted_users} User record(s)")

        db.commit()
        print("\n[SUCCESS] Cleanup committed to lumora.db")

        # ── 4. Verification ───────────────────────────────────────────────────
        remaining_test_users = db.query(User).filter(User.email.like("%@lumora.io")).count()
        remaining_roles      = db.query(AdminRole).join(User, AdminRole.user_id == User.id).filter(User.email.like("%@lumora.io")).count()
        remaining_invs       = db.query(AdminInvitation).filter(AdminInvitation.email.like("%@lumora.io")).count()
        real_admins          = db.query(User).filter(User.role == "admin", ~User.email.like("%@lumora.io")).all()

        print(f"\nPost-cleanup verification:")
        print(f"  Remaining @lumora.io users      : {remaining_test_users}  (expected: 0)")
        print(f"  Remaining @lumora.io AdminRoles : {remaining_roles}  (expected: 0)")
        print(f"  Remaining @lumora.io invitations: {remaining_invs}  (expected: 0)")
        print(f"  Real production admins          : {len(real_admins)}")
        for u in real_admins:
            print(f"    - {u.email!r} (id={u.id}, name={u.name!r})")

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Cleanup failed and was rolled back: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_cleanup()
