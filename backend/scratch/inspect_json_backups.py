import os
import json

def inspect_json_backups():
    b1 = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backups", "firestore_backup_20260718_233756.json"))
    b2 = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backups", "firestore_backup_reviews_20260719_000428.json"))

    for path, name in [(b1, "firestore_backup_20260718_233756.json"), (b2, "firestore_backup_reviews_20260719_000428.json")]:
        print(f"\n=====================================================")
        print(f"INSPECTING JSON BACKUP: {name}")
        print(f"=====================================================")
        if not os.path.exists(path):
            print("File does not exist")
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    print("Keys in backup JSON:", list(data.keys()))
                    if "reviews" in data:
                        revs = data["reviews"]
                        print(f"\nFound {len(revs)} reviews in {name}:")
                        print(json.dumps(revs, indent=2))
                    if "reports" in data:
                        reps = data["reports"]
                        print(f"\nFound {len(reps)} reports in {name}:")
                        print(json.dumps(reps, indent=2))
                elif isinstance(data, list):
                    print(f"List with {len(data)} items")
                    print(json.dumps(data[:3], indent=2))
        except Exception as e:
            print(f"Error reading {name}: {e}")

if __name__ == "__main__":
    inspect_json_backups()
