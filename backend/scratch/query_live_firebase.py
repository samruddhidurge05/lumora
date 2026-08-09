import sys
import os
import firebase_admin
from firebase_admin import credentials, firestore

def query_firestore():
    cred_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "lumora-e6ddc-firebase-adminsdk-fbsvc-abcf2d8c21.json"))
    print(f"Credential path: {cred_path}")
    if not os.path.exists(cred_path):
        print("Credential file missing!")
        return

    cred = credentials.Certificate(cred_path)
    app = firebase_admin.initialize_app(cred)
    db = firestore.client(app)

    print("\n--- FIRESTORE REVIEWS COLLECTION ---")
    rev_docs = list(db.collection("reviews").stream())
    print(f"Total Firestore Reviews: {len(rev_docs)}")
    for d in rev_docs:
        print(f"  Doc ID: {d.id} => {d.to_dict()}")

    print("\n--- FIRESTORE REPORTS COLLECTION ---")
    rep_docs = list(db.collection("reports").stream())
    print(f"Total Firestore Reports: {len(rep_docs)}")
    for d in rep_docs:
        print(f"  Doc ID: {d.id} => {d.to_dict()}")

if __name__ == "__main__":
    query_firestore()
