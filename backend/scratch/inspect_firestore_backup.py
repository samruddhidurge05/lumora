"""
INSPECT FIRESTORE BACKUP JSON COLLECTIONS
========================================
Inspects top-level collections in firestore_backup_20260718_233756.json
"""
import json
import os

fpath = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backups", "firestore_backup_20260718_233756.json")
with open(fpath, "r", encoding="utf-8") as f:
    data = json.load(f)

print("=" * 70)
print("FIRESTORE BACKUP (2026-07-18) COLLECTIONS AUDIT")
print("=" * 70)

for k, v in data.items():
    print(f"  Collection: '{k}' — {len(v)} documents")

if "admin" in data:
    print("\n  'admin' collection keys/docs:")
    print(json.dumps(data["admin"], indent=2)[:2000])

if "users" in data:
    print("\n  'users' collection docs sample:")
    for uid, udata in list(data["users"].items())[:10]:
        print(f"    {uid}: {udata.get('email')} | {udata.get('role')} | {udata.get('displayName')}")
