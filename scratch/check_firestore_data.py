import os
import sys

os.environ['FIREBASE_SERVICE_ACCOUNT_JSON'] = 'lumora-e6ddc-firebase-adminsdk-fbsvc-abcf2d8c21.json'
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.shared.firebase.connection import db, firebase_connected
print('Firebase Connected:', firebase_connected)

if firebase_connected and db is not None:
    for coll in ['refunds', 'refund_requests', 'refundRequests', 'orders']:
        docs = list(db.collection(coll).stream())
        print(f"\n=== FIRESTORE COLLECTION '{coll}' (Count: {len(docs)}) ===")
        for d in docs:
            print(f"Doc ID: {d.id} => {d.to_dict()}")
