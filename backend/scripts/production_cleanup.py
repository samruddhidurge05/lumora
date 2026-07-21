import sqlite3
import os
import shutil
import json
from datetime import datetime

# Resolve local directories relative to this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
WORKSPACE_DIR = os.path.dirname(BACKEND_DIR)
BACKUP_DIR = os.path.join(BACKEND_DIR, "backups")

DB_PATH = os.path.join(BACKEND_DIR, "lumora.db")
BACKUP_DB_PATH = os.path.join(BACKUP_DIR, "lumora_backup_pre_cleanup.db")
FIRESTORE_BACKUP_PATH = os.path.join(BACKUP_DIR, "firestore_backup_pre_cleanup.json")

# Ensure backup directory exists
os.makedirs(BACKUP_DIR, exist_ok=True)

# ----------------------------------------------------
# 1. SQLite Database Backup
# ----------------------------------------------------
print("--- Starting SQLite Backup ---")
if os.path.exists(DB_PATH):
    try:
        shutil.copy2(DB_PATH, BACKUP_DB_PATH)
        print(f"Successfully backed up SQLite database to: {BACKUP_DB_PATH}")
    except Exception as e:
        print(f"ERROR backing up SQLite database: {e}")
        exit(1)
else:
    print(f"ERROR: SQLite database file not found at {DB_PATH}")
    exit(1)

# ----------------------------------------------------
# 2. SQLite Database Cleanup
# ----------------------------------------------------
print("\n--- Starting SQLite Cleanup ---")
try:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    # Tables to completely clear (operational/test data)
    tables_to_clear = [
        "orders",
        "order_items",
        "payments",
        "reviews",
        "affiliate_commissions",
        "affiliate_payouts",
        "withdrawals",
        "referral_clicks",
        "cart_items",
        "conversations",
        "messages",
        "price_alerts",
        "recently_viewed",
        "search_history",
        "wishlists",
        "verifications",
        "admin_roles"
    ]
    
    # Begin Transaction
    conn.execute("BEGIN TRANSACTION")
    
    for table in tables_to_clear:
        # Check if table exists
        cur.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
        if cur.fetchone():
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            cnt = cur.fetchone()[0]
            if cnt > 0:
                cur.execute(f"DELETE FROM {table}")
                print(f"Cleared table '{table}' ({cnt} test rows deleted)")
            else:
                print(f"Table '{table}' is already empty")
        else:
            print(f"Table '{table}' does not exist, skipping")

    # Selective cleanup of 'notifications' (delete notifications for deleted/test users)
    # Get active users
    cur.execute("SELECT id FROM users")
    active_user_ids = {row["id"] for row in cur.fetchall()}
    
    cur.execute("SELECT COUNT(*) FROM notifications")
    total_notif_before = cur.fetchone()[0]
    
    cur.execute("SELECT id, user_id FROM notifications")
    notif_rows = cur.fetchall()
    notifs_deleted = 0
    for row in notif_rows:
        if row["user_id"] not in active_user_ids:
            cur.execute("DELETE FROM notifications WHERE id = ?", (row["id"],))
            notifs_deleted += 1
            
    print(f"Cleaned 'notifications' table: deleted {notifs_deleted} orphan test notifications (before: {total_notif_before})")

    # Selective cleanup of 'user_activities' (only delete logs of test customer or deleted users)
    # The test customer is thunderstorm2998@gmail.com (ID 11 in users table)
    # Deleted users (like ID 10) should also have their activities cleared.
    cur.execute("SELECT COUNT(*) FROM user_activities")
    total_activities_before = cur.fetchone()[0]
    
    cur.execute("SELECT id, user_id FROM user_activities")
    activity_rows = cur.fetchall()
    activities_deleted = 0
    for row in activity_rows:
        u_id = row["user_id"]
        # Find if user is thunderstorm2998@gmail.com
        if u_id is not None:
            cur.execute("SELECT email FROM users WHERE id = ?", (u_id,))
            user_res = cur.fetchone()
            if not user_res:
                # User does not exist (deleted user like ID 10)
                cur.execute("DELETE FROM user_activities WHERE id = ?", (row["id"],))
                activities_deleted += 1
            elif user_res["email"] == "thunderstorm2998@gmail.com":
                # Test customer thunderstorm2998@gmail.com
                cur.execute("DELETE FROM user_activities WHERE id = ?", (row["id"],))
                activities_deleted += 1
                
    print(f"Cleaned 'user_activities' table: deleted {activities_deleted} test activities (before: {total_activities_before})")

    # Remove ONLY the known test customer (thunderstorm2998@gmail.com) from users table
    cur.execute("SELECT id, email FROM users WHERE email = 'thunderstorm2998@gmail.com'")
    test_user_row = cur.fetchone()
    if test_user_row:
        cur.execute("DELETE FROM users WHERE email = 'thunderstorm2998@gmail.com'")
        print(f"Removed test customer account: thunderstorm2998@gmail.com (ID {test_user_row['id']})")
    else:
        print("Test customer 'thunderstorm2998@gmail.com' not found in users table, skipping deletion")

    # Commit Transaction
    conn.commit()
    print("SQLite cleanup committed successfully.")
    
    # Print current users remaining in SQLite for verification
    cur.execute("SELECT id, name, email, role FROM users")
    print("\nActive users remaining in SQLite:")
    for row in cur.fetchall():
        print(f" - ID {row['id']}: {row['name']} ({row['email']}) - Role: {row['role']}")
        
    conn.close()
except Exception as e:
    print(f"ERROR during SQLite cleanup: {e}")
    if 'conn' in locals():
        conn.rollback()
        conn.close()
    exit(1)


# ----------------------------------------------------
# 3. Firestore Backup & Cleanup
# ----------------------------------------------------
print("\n--- Starting Firestore Backup & Cleanup ---")

# Set the environment variable for Firebase Admin SDK path
os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = os.path.join(WORKSPACE_DIR, "lumora-e6ddc-firebase-adminsdk-fbsvc-abcf2d8c21.json")

import sys
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

try:
    from app.shared.firebase.connection import db, firebase_connected
    if not firebase_connected or db is None:
        print("ERROR: Could not initialize Firebase Admin SDK connection.")
        exit(1)
        
    # Firestore collections containing operational test data
    firestore_collections = [
        "orders",
        "payments",
        "reviews",
        "downloads",
        "analytics",
        "reports",
        "withdrawals",
        "notifications",
        "userNotifications",
        "vendorNotifications",
        "affiliateConversions",
        "wishlist"
    ]
    
    # We also have subcollections under admin, like admin/notifications/items
    nested_collections = [
        ("admin/notifications/items", "admin_notifications_items")
    ]
    
    backup_data = {}
    
    # A. Perform Firestore Backup
    print("Attempting to backup Firestore collections...")
    quota_exceeded = False
    
    # 1. Backup root collections
    for coll_name in firestore_collections:
        try:
            docs = list(db.collection(coll_name).stream())
            backup_data[coll_name] = {d.id: d.to_dict() for d in docs}
            print(f" - Collection '{coll_name}': read {len(docs)} documents for backup")
        except Exception as e:
            if "Quota exceeded" in str(e) or "429" in str(e):
                print(f" - Collection '{coll_name}': Quota exceeded. Skipping backup.")
                quota_exceeded = True
            else:
                print(f" - Collection '{coll_name}': Error during backup: {e}")
                quota_exceeded = True
                
    # 2. Backup nested collections
    for path, key in nested_collections:
        try:
            parts = path.split("/")
            if len(parts) == 3:
                docs = list(db.collection(parts[0]).document(parts[1]).collection(parts[2]).stream())
                backup_data[key] = {d.id: d.to_dict() for d in docs}
                print(f" - Path '{path}': read {len(docs)} documents for backup")
        except Exception as e:
            if "Quota exceeded" in str(e) or "429" in str(e):
                print(f" - Path '{path}': Quota exceeded. Skipping backup.")
                quota_exceeded = True
            else:
                print(f" - Path '{path}': Error during backup: {e}")
                quota_exceeded = True

    # 3. Backup the target user document to delete
    target_user_uid = "48GkGwu43QPHXUYyplREFgLzKvh2" # thunderstorm2998@gmail.com
    try:
        user_snap = db.collection("users").document(target_user_uid).get()
        if user_snap.exists:
            backup_data["users_deleted"] = {target_user_uid: user_snap.to_dict()}
            print(f" - User '{target_user_uid}': read document for backup")
        else:
            user_query = db.collection("users").where("email", "==", "thunderstorm2998@gmail.com").stream()
            user_docs = list(user_query)
            if user_docs:
                backup_data["users_deleted"] = {d.id: d.to_dict() for d in user_docs}
                print(f" - User email 'thunderstorm2998@gmail.com': read {len(user_docs)} documents for backup")
    except Exception as e:
        if "Quota exceeded" in str(e) or "429" in str(e):
            print(" - User query: Quota exceeded. Skipping backup.")
            quota_exceeded = True
        else:
            print(f" - User query: Error during backup: {e}")
            quota_exceeded = True

    # Save backup file if no quota exceeded
    if not quota_exceeded:
        try:
            with open(FIRESTORE_BACKUP_PATH, "w", encoding="utf-8") as fh:
                json.dump(backup_data, fh, indent=2, default=str)
            print(f"Successfully saved Firestore backup to: {FIRESTORE_BACKUP_PATH}")
        except Exception as e:
            print(f"ERROR saving Firestore backup JSON file: {e}")
            quota_exceeded = True
            
    # B. Perform Firestore Deletion (ONLY if backup was successful and no quota issues occurred)
    if quota_exceeded:
        print("\n[WARNING] Firestore backup could not be fully completed due to Quota Exceeded (429).")
        print("Firestore deletion will NOT be executed now. Please rerun this script once the Firestore quota resets.")
    else:
        print("\nFirestore backup complete. Starting Firestore deletion...")
        
        # 1. Delete root collections
        for coll_name in firestore_collections:
            docs_to_delete = backup_data.get(coll_name, {})
            deleted_count = 0
            for doc_id in docs_to_delete:
                try:
                    db.collection(coll_name).document(doc_id).delete()
                    deleted_count += 1
                except Exception as e:
                    print(f" - Error deleting document {doc_id} in {coll_name}: {e}")
            if deleted_count > 0:
                print(f" - Collection '{coll_name}': deleted {deleted_count} documents")
            else:
                print(f" - Collection '{coll_name}': nothing to delete")
                
        # 2. Delete nested collections
        for path, key in nested_collections:
            docs_to_delete = backup_data.get(key, {})
            deleted_count = 0
            parts = path.split("/")
            for doc_id in docs_to_delete:
                try:
                    db.collection(parts[0]).document(parts[1]).collection(parts[2]).document(doc_id).delete()
                    deleted_count += 1
                except Exception as e:
                    print(f" - Error deleting document {doc_id} in {path}: {e}")
            if deleted_count > 0:
                print(f" - Path '{path}': deleted {deleted_count} documents")
            else:
                print(f" - Path '{path}': nothing to delete")
                
        # 3. Delete target test user document
        deleted_users = backup_data.get("users_deleted", {})
        for doc_id in deleted_users:
            try:
                db.collection("users").document(doc_id).delete()
                print(f" - Deleted test customer user document: users/{doc_id}")
            except Exception as e:
                print(f" - Error deleting user document users/{doc_id}: {e}")

        print("Firestore cleanup completed successfully.")

except Exception as e:
    print(f"ERROR during Firestore backup & cleanup: {e}")

print("\n--- Process Complete ---")
