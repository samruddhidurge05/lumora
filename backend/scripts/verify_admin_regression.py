import os
import sys
import json
import sqlite3

# Reconfigure stdout to use UTF-8 to prevent charmap print errors on Windows
sys.stdout.reconfigure(encoding='utf-8')

WORKSPACE_DIR = r"d:\SAM(DIGI)\digital-marketplace\Digi\digital-marketplace"
os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = os.path.join(WORKSPACE_DIR, "lumora-e6ddc-firebase-adminsdk-fbsvc-abcf2d8c21.json")

BACKEND_DIR = os.path.join(WORKSPACE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.shared.firebase.connection import db, firebase_connected
from app.db.session import SessionLocal
from app.admin_api.admin_users.routes import list_team_members, list_invitations
from app.models.user import User

def run_regression():
    print("====================================================")
    print("      REGRESSION & INTEGRITY VERIFICATION           ")
    print("====================================================")
    
    passed = True
    errors = []

    # 1. Verify SQLite Tables Integrity & Schemas
    print("\n[Check 1] Checking SQLite Table Schemas & Constraints...")
    sqlite_db = os.path.join(BACKEND_DIR, "lumora.db")
    if not os.path.exists(sqlite_db):
        passed = False
        errors.append("SQLite database file 'lumora.db' is missing.")
    else:
        conn = sqlite3.connect(sqlite_db)
        cur = conn.cursor()
        
        # Verify tables list
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {t[0] for t in cur.fetchall()}
        required_tables = {"users", "products", "admin_invitations", "admin_roles", "audit_logs"}
        missing_tables = required_tables - tables
        if missing_tables:
            passed = False
            errors.append(f"Missing SQLite tables: {missing_tables}")
        else:
            print("  - All required SQLite tables exist. OK")

        # Verify admin_invitations columns
        cur.execute("PRAGMA table_info(admin_invitations)")
        inv_cols = {c[1] for c in cur.fetchall()}
        required_cols = {"id", "email", "role_level", "invite_token", "invited_by", "expires_at", "accepted_at", "created_at", "revoked_at", "invited_name", "message"}
        if not required_cols.issubset(inv_cols):
            passed = False
            errors.append(f"admin_invitations schema altered. Missing: {required_cols - inv_cols}")
        else:
            print("  - admin_invitations table schema is correct. OK")

        # Verify Alok's invitation in SQLite (now ID 7)
        cur.execute("SELECT email, accepted_at, revoked_at FROM admin_invitations WHERE id = 7")
        row = cur.fetchone()
        if not row:
            passed = False
            errors.append("Alok's invitation ID 7 is missing in SQLite.")
        else:
            email, accepted_at, revoked_at = row
            if email != "alokparmar251181@gmail.com":
                passed = False
                errors.append(f"Alok's invitation ID 7 email mismatch: expected alokparmar251181@gmail.com, found {email}")
            elif not accepted_at:
                passed = False
                errors.append("Alok's invitation ID 7 is not marked as accepted in SQLite.")
            elif revoked_at:
                passed = False
                errors.append("Alok's invitation ID 7 is marked as revoked in SQLite.")
            else:
                print("  - Alok's accepted invitation (ID 7) exists in SQLite. OK")
        
        conn.close()

    # 2. Verify Firestore Cleaned State
    print("\n[Check 2] Checking Firestore Production Cleanup State...")
    if not firebase_connected or db is None:
        passed = False
        errors.append("Firebase Admin SDK not connected.")
    else:
        # Check that exactly 29 genuine orders remain in Firestore
        orders_snap = db.collection("orders").get()
        if len(orders_snap) != 29:
            passed = False
            errors.append(f"Regression: Found {len(orders_snap)} orders in Firestore. Expected exactly 29 genuine orders.")
        else:
            print("  - Exactly 29 genuine orders remain in Firestore. OK")

        # Check adminAnalytics is removed
        admin_analytics = db.collection("adminAnalytics").get()
        if len(admin_analytics) > 0:
            passed = False
            errors.append("Regression: adminAnalytics collection is not empty.")
        else:
            print("  - adminAnalytics remains deleted. OK")

        # Check adminPromotions & participants
        admin_promos = db.collection("adminPromotions").get()
        promo_parts = db.collection("promotionParticipants").get()
        if len(admin_promos) > 0 or len(promo_parts) > 0:
            passed = False
            errors.append("Regression: adminPromotions or promotionParticipants returns.")
        else:
            print("  - adminPromotions & participants remain deleted. OK")

        # Check conversations
        convs = db.collection("conversations").get()
        if len(convs) > 0:
            passed = False
            errors.append("Regression: conversations collection is not empty.")
        else:
            print("  - Conversations remain deleted. OK")

        # Check reviews (0 fake reviews remain)
        revs = db.collection("reviews").get()
        if len(revs) > 0:
            passed = False
            errors.append(f"Regression: Found {len(revs)} reviews in Firestore. Mock reviews must remain deleted.")
        else:
            print("  - 0 reviews in Firestore. OK")

        # Check Alok's invitation in Firestore (ID 7)
        doc_snap = db.collection("admin").document("team").collection("invitations").document("7").get()
        if not doc_snap.exists:
            passed = False
            errors.append("Alok's invitation ID 7 is missing in Firestore.")
        else:
            fdata = doc_snap.to_dict() or {}
            if fdata.get("email") != "alokparmar251181@gmail.com":
                passed = False
                errors.append(f"Firestore invitation ID 7 email mismatch: {fdata.get('email')}")
            elif fdata.get("status") != "accepted":
                passed = False
                errors.append(f"Firestore invitation ID 7 status is '{fdata.get('status')}', expected 'accepted'")
            else:
                print("  - Alok's accepted invitation (ID 7) exists in Firestore. OK")

    # 3. Verify Active Team API Responses
    print("\n[Check 3] Verifying Active Team API Responses...")
    db_s = SessionLocal()
    try:
        admin_user = db_s.query(User).filter(User.id == 8).first()
        if not admin_user:
            passed = False
            errors.append("Super Admin user ID 8 (Avika) missing from SQLite.")
        else:
            # Call active team members
            team_res = list_team_members(db=db_s, admin_user=admin_user)
            emails = {m["email"] for m in team_res}
            expected_emails = {"alokparmar251181@gmail.com", "avikapawar08@gmail.com"}
            if not expected_emails.issubset(emails):
                passed = False
                errors.append(f"Active team API missing members. Expected at least {expected_emails}, found {emails}")
            else:
                print("  - Active team members API correctly returns Alok and Avika. OK")

            # Call invitations history
            invs_res = list_invitations(include_history=True, db=db_s, admin_user=admin_user)
            alok_inv = next((inv for inv in invs_res if inv["id"] == 7), None)
            if not alok_inv:
                passed = False
                errors.append("Invitations API response missing Alok's invitation ID 7.")
            elif alok_inv["status"] != "accepted":
                passed = False
                errors.append(f"Invitations API: Alok's invitation ID 7 status is '{alok_inv['status']}', expected 'accepted'")
            else:
                print("  - Invitations history API correctly returns Alok's invitation as accepted. OK")
    except Exception as e:
        passed = False
        errors.append(f"Exception during API checks: {e}")
    finally:
        db_s.close()

    # Final Result
    print("\n" + "=" * 50)
    print("      REGRESSION VERIFICATION RESULT               ")
    print("" + "=" * 50)
    print(f"Overall Result: {'PASS' if passed else 'FAIL'}")
    print("=" * 50)
    
    if errors:
        print("\nVerification Failures:")
        for err in errors:
            print(f"  [FAIL] {err}")
        sys.exit(1)
    else:
        print("\nAll regression check points successfully passed. OK")

if __name__ == "__main__":
    run_regression()
