import os
import json

b2 = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backups", "firestore_backup_reviews_20260719_000428.json"))

with open(b2, "r", encoding="utf-8") as f:
    data = json.load(f)
    print(json.dumps(data, indent=2))
