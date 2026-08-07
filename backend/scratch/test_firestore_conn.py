import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)

# Load env file explicitly
from dotenv import load_dotenv
load_dotenv(os.path.join(project_root, ".env"))

print("FIREBASE_SERVICE_ACCOUNT_JSON:", os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"))

from app.shared.firebase.connection import db as firestore_db, firebase_connected

print("Firebase connected:", firebase_connected)
if firebase_connected and firestore_db is not None:
    print("Testing stream on 'reviews'...")
    rev_docs = list(firestore_db.collection("reviews").stream())
    print("Reviews count in Firestore:", len(rev_docs))
    for d in rev_docs[:5]:
        print("  Review:", d.id, d.to_dict())

    print("Testing stream on 'reports'...")
    rep_docs = list(firestore_db.collection("reports").stream())
    print("Reports count in Firestore:", len(rep_docs))
    for d in rep_docs[:5]:
        print("  Report:", d.id, d.to_dict())
