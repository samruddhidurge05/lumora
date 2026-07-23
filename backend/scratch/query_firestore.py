import sys
import os
import traceback

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)

# Set environment variables if needed
os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = os.path.join(project_root, "app", "shared", "firebase", "serviceAccountKey.json")

from app.shared.firebase.connection import db as firestore_db, firebase_connected

def query_firestore():
    print("=" * 80)
    print("TESTING FIRESTORE REPORTS QUERY DIRECTLY")
    print("=" * 80)
    print("Firebase Connected:", firebase_connected)
    if not firebase_connected or firestore_db is None:
        print("Firebase not connected!")
        return

    try:
        # Let's try stream
        print("Querying collection 'reports'...")
        docs = firestore_db.collection("reports").stream()
        print("Stream completed. Docs found:")
        count = 0
        for doc in docs:
            print(f"Doc ID: {doc.id} -> {doc.to_dict()}")
            count += 1
            if count >= 5:
                break
        print(f"Done. Printed {count} docs.")
    except Exception as e:
        print("Error during stream:")
        traceback.print_exc()

if __name__ == "__main__":
    query_firestore()
