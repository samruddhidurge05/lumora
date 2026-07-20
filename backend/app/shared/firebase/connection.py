import os

db = None
firebase_connected = False

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    
    # Avoid initializing multiple times
    if not firebase_admin._apps:
        # Check env var for JSON certificate or path
        cert_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        
        # If env var is not set, look in the default folders
        if not cert_path:
            base_dir = os.path.dirname(os.path.abspath(__file__)) # backend/app/shared/firebase
            path1 = os.path.join(base_dir, "serviceAccountKey.json")
            path2 = os.path.join(os.path.dirname(os.path.dirname(base_dir)), "shared", "firebase", "serviceAccountKey.json")
            if os.path.exists(path1):
                cert_path = path1
            elif os.path.exists(path2):
                cert_path = path2
            else:
                cert_path = path1

        import json
        is_json_string = False
        if cert_path:
            try:
                # Try parsing as JSON dict directly (useful for container envs like Render)
                parsed_json = json.loads(cert_path)
                if isinstance(parsed_json, dict):
                    cred = credentials.Certificate(parsed_json)
                    firebase_admin.initialize_app(cred)
                    db = firestore.client()
                    firebase_connected = True
                    is_json_string = True
                    print("[firebase-connection] Firebase Admin SDK initialized successfully via inline JSON.")
            except Exception:
                pass

        if not is_json_string:
            if cert_path and os.path.exists(cert_path):
                cred = credentials.Certificate(cert_path)
                firebase_admin.initialize_app(cred)
                db = firestore.client()
                firebase_connected = True
                print("[firebase-connection] Firebase Admin SDK initialized successfully via serviceAccountKey.json.")
            else:
                # Fall back to default credentials (for GCP environments, etc.)
                try:
                    firebase_admin.initialize_app()
                    db = firestore.client()
                    firebase_connected = True
                    print("[firebase-connection] Firebase Admin SDK initialized via Application Default Credentials.")
                except Exception:
                    print("[firebase-connection] Warning: serviceAccountKey.json not found and default auth failed. Firebase admin features will be unavailable.")
    else:
        db = firestore.client()
        firebase_connected = True
except ImportError:
    print("[firebase-connection] Warning: firebase-admin package is not installed in the Python environment. Run 'pip install firebase-admin' to enable backend admin endpoints.")
except Exception as e:
    print(f"[firebase-connection] Warning: Failed to connect to Firebase Admin: {e}")
