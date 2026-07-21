import os
import sys
import json
import sqlite3

# Set up paths
WORKSPACE_DIR = r"d:\SAM(DIGI)\digital-marketplace\Digi\digital-marketplace"
os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = os.path.join(WORKSPACE_DIR, "lumora-e6ddc-firebase-adminsdk-fbsvc-abcf2d8c21.json")

BACKEND_DIR = os.path.join(WORKSPACE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.shared.firebase.connection import db, firebase_connected

def run_verification():
    print("====================================================")
    print("        POST-CLEANUP DATABASE INTEGRITY SCAN        ")
    print("====================================================")
    
    if not firebase_connected or db is None:
        print("Error: Firebase Admin SDK is not connected.")
        sys.exit(1)

    print("Fetching active records from Firestore...")
    users = {doc.id for doc in db.collection("users").stream()}
    customers = {doc.id for doc in db.collection("customers").stream()}
    vendors = {doc.id for doc in db.collection("vendors").stream()}
    affiliates = {doc.id for doc in db.collection("affiliates").stream()}
    products = {doc.id for doc in db.collection("products").stream()}
    orders = {doc.id for doc in db.collection("orders").stream()}
    
    print(f"Loaded reference sets:")
    print(f"  - Users: {len(users)}")
    print(f"  - Customers: {len(customers)}")
    print(f"  - Vendors: {len(vendors)}")
    print(f"  - Affiliates: {len(affiliates)}")
    print(f"  - Products: {len(products)}")
    print(f"  - Orders: {len(orders)}")
    print("----------------------------------------------------")

    orphans_count = 0
    broken_refs = []

    # 1. Scan reviews
    print("Scanning reviews collection...")
    for doc in db.collection("reviews").stream():
        data = doc.to_dict() or {}
        pid = data.get("productId")
        uid = data.get("customerId") or data.get("userId")
        
        if pid and str(pid) not in products:
            broken_refs.append(f"reviews/{doc.id} -> product {pid} is missing")
            orphans_count += 1
        if uid and str(uid) not in users:
            broken_refs.append(f"reviews/{doc.id} -> user {uid} is missing")
            orphans_count += 1

    # 2. Scan downloads
    print("Scanning downloads collection...")
    for doc in db.collection("downloads").stream():
        data = doc.to_dict() or {}
        pid = data.get("productId")
        uid = data.get("userId")
        
        if pid and str(pid) not in products:
            broken_refs.append(f"downloads/{doc.id} -> product {pid} is missing")
            orphans_count += 1
        if uid and str(uid) not in users:
            broken_refs.append(f"downloads/{doc.id} -> user {uid} is missing")
            orphans_count += 1

    # 3. Scan purchases
    print("Scanning purchases collection...")
    for doc in db.collection("purchases").stream():
        data = doc.to_dict() or {}
        pid = data.get("productId")
        uid = data.get("userId")
        
        if pid and str(pid) not in products:
            broken_refs.append(f"purchases/{doc.id} -> product {pid} is missing")
            orphans_count += 1
        if uid and str(uid) not in users:
            broken_refs.append(f"purchases/{doc.id} -> user {uid} is missing")
            orphans_count += 1

    # 4. Scan affiliateLinks
    print("Scanning affiliateLinks collection...")
    for doc in db.collection("affiliateLinks").stream():
        data = doc.to_dict() or {}
        pid = data.get("productId")
        vid = data.get("vendorId")
        
        if pid and str(pid) not in products and str(pid) != "demo-product":
            broken_refs.append(f"affiliateLinks/{doc.id} -> product {pid} is missing")
            orphans_count += 1
        if vid and str(vid) not in vendors and str(vid) != "vendor-mock-001":
            broken_refs.append(f"affiliateLinks/{doc.id} -> vendor {vid} is missing")
            orphans_count += 1

    # 5. Scan userNotifications
    print("Scanning userNotifications collection...")
    for doc in db.collection("userNotifications").stream():
        data = doc.to_dict() or {}
        uid = data.get("userId") or data.get("uid")
        if uid and str(uid) not in users:
            broken_refs.append(f"userNotifications/{doc.id} -> user {uid} is missing")
            orphans_count += 1

    # 6. Scan vendorNotifications
    print("Scanning vendorNotifications collection...")
    for doc in db.collection("vendorNotifications").stream():
        data = doc.to_dict() or {}
        vid = data.get("vendorId")
        oid = data.get("orderId")
        if vid and str(vid) not in vendors:
            broken_refs.append(f"vendorNotifications/{doc.id} -> vendor {vid} is missing")
            orphans_count += 1
        if oid and str(oid) not in orders:
            broken_refs.append(f"vendorNotifications/{doc.id} -> order {oid} is missing")
            orphans_count += 1

    print("----------------------------------------------------")
    print(f"Scan complete. Found {orphans_count} orphans/broken references.")
    if broken_refs:
        print("\nBroken References Details:")
        for r in broken_refs:
            print(f"  [Orphan] {r}")
    else:
        print("  OK All active references resolved successfully. Database is clean!")
        
    return orphans_count == 0

if __name__ == "__main__":
    run_verification()
