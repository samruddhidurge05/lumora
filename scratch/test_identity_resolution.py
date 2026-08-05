import sys, os
os.environ['FIREBASE_SERVICE_ACCOUNT_JSON'] = 'lumora-e6ddc-firebase-adminsdk-fbsvc-abcf2d8c21.json'
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.shared.firebase.connection import db as fs_db, firebase_connected

if firebase_connected and fs_db is not None:
    collections = ['users', 'customers', 'profiles', 'orders', 'payments', 'users_profile']
    for col in collections:
        try:
            docs = list(fs_db.collection(col).stream())
            print(f"Collection '{col}': {len(docs)} documents")
            for d in docs:
                data_str = str(d.to_dict())
                if '82' in data_str or '80' in data_str or '21' in data_str:
                    print(f"  Doc in {col} [{d.id}]: {d.to_dict()}")
        except Exception as e:
            print(f"Collection '{col}' error: {e}")
