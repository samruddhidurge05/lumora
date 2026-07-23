import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.shared.firebase.connection import db, firebase_connected

def test_collections():
    print("=================================================================")
    print("           TESTING FIRESTORE COLLECTIONS CONNECTIVITY            ")
    print("=================================================================")
    print(f"Firebase Connected: {firebase_connected}")

    if db:
        try:
            collections = list(db.collections())
            print(f"Found {len(collections)} Firestore Collections:")
            for col in collections:
                docs = list(col.limit(5).stream())
                print(f"  - Collection ID: '{col.id}' (Sample Docs: {len(docs)})")
                for d in docs:
                    print(f"      * Doc ID: {d.id}")
            print("\n[SUCCESS] Firestore collections listed successfully!")
        except Exception as e:
            print(f"\n[ERROR] Failed to list Firestore collections: {e}")
    else:
        print("[ERROR] Firebase DB connection object is None!")

if __name__ == "__main__":
    test_collections()
