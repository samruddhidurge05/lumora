import os
import sys
import json
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

cert_file = root_dir / "lumora-e6ddc-firebase-adminsdk-fbsvc-abcf2d8c21.json"
if cert_file.exists():
    os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = str(cert_file)

def diagnose_exception():
    print("=" * 80)
    print("PHASE 1: DETAILED FIRESTORE EXCEPTION & QUOTA FORENSICS")
    print("=" * 80)

    try:
        from app.shared.firebase.connection import db, firebase_connected
    except Exception as e:
        print(f"Failed to import Firebase: {e}")
        return

    print(f"Service Account Key: {cert_file}")
    print(f"Firebase Connected: {firebase_connected}")

    if not firebase_connected or db is None:
        print("Firebase is not connected.")
        return

    try:
        print("\nAttempting query on 'orders' collection...")
        docs = list(db.collection("orders").limit(1).stream())
        print(f"Query SUCCESS! Returned {len(docs)} documents.")
    except Exception as e:
        print("\n" + "!" * 80)
        print("EXACT GOOGLE CLOUD EXCEPTION DIAGNOSTICS:")
        print("!" * 80)
        print(f"Exception Type: {type(e).__module__}.{type(e).__name__}")
        print(f"Exception String: {str(e)}")
        print(f"Exception Representation: {repr(e)}")
        print(f"Exception Args: {e.args}")

        # Check for gRPC or HTTP specific fields
        for attr in ("code", "details", "initial_metadata", "trailing_metadata", "response", "status_code"):
            if hasattr(e, attr):
                val = getattr(e, attr)
                if callable(val):
                    try:
                        val = val()
                    except Exception:
                        pass
                print(f"  {attr}: {val}")

        # If google.api_core.exceptions.GoogleAPICallError
        if hasattr(e, "errors"):
            print(f"  errors: {getattr(e, 'errors')}")

        print("\n" + "=" * 80)

if __name__ == "__main__":
    diagnose_exception()
