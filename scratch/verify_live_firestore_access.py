"""
scratch/verify_live_firestore_access.py
----------------------------------------
Forensic Read-Only Verification Tool for Live Firestore Instance.
Collects detailed collection stats, oldest/newest timestamps, last 20 IDs,
sample emails, duplicate checks, missing required fields, and entity references.
"""

import os
import sys
import json
import datetime
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Configure Service Account Key File path
cert_file = root_dir / "lumora-e6ddc-firebase-adminsdk-fbsvc-abcf2d8c21.json"
if cert_file.exists():
    os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = str(cert_file)

def parse_doc_dt(doc_dict: dict) -> datetime.datetime:
    raw = doc_dict.get("createdAt") or doc_dict.get("created_at") or doc_dict.get("purchaseDate") or doc_dict.get("timestamp")
    if not raw:
        return datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc)
    if isinstance(raw, datetime.datetime):
        return raw
    try:
        val_str = str(raw).replace("Z", "+00:00")
        return datetime.datetime.fromisoformat(val_str)
    except Exception:
        return datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc)

def run_firestore_verification():
    print("=" * 80)
    print("ENHANCED LIVE FIRESTORE READ-ONLY FORENSIC VERIFICATION")
    print(f"Service Account Key File: {cert_file}")
    print(f"Key File Exists: {cert_file.exists()}")
    print("=" * 80)

    try:
        from app.shared.firebase.connection import db, firebase_connected
    except Exception as e:
        print(f"Failed to import Firebase connection: {e}")
        return

    print(f"Firebase Connected Flag: {firebase_connected}")
    if not firebase_connected or db is None:
        print("Firebase Admin SDK is NOT connected or initialized.")
        return

    collections_to_check = ["orders", "users", "payments", "refund_requests", "vendors", "products"]
    report = {}

    for col_name in collections_to_check:
        print(f"\nAnalyzing Firestore collection '{col_name}'...")
        try:
            stream = list(db.collection(col_name).stream())
            count = len(stream)
            doc_items = []
            seen_ids = set()
            duplicates = []

            for d in stream:
                if d.id in seen_ids:
                    duplicates.append(d.id)
                seen_ids.add(d.id)
                data = d.to_dict() or {}
                dt = parse_doc_dt(data)
                doc_items.append({"id": d.id, "dt": dt, "data": data})

            # Sort by date
            doc_items.sort(key=lambda x: x["dt"])

            oldest_doc = doc_items[0] if doc_items else None
            newest_doc = doc_items[-1] if doc_items else None
            last_20_ids = [item["id"] for item in doc_items[-20:]]

            sample_emails = list({
                item["data"].get("customerEmail") or item["data"].get("email") or item["data"].get("userEmail")
                for item in doc_items
                if item["data"].get("customerEmail") or item["data"].get("email") or item["data"].get("userEmail")
            })[:10]

            sample_order_ids = list({
                item["data"].get("orderId") or item["id"]
                for item in doc_items
                if item["data"].get("orderId") or item["id"]
            })[:10]

            # Missing required fields check
            missing_required = []
            for item in doc_items:
                d = item["data"]
                if col_name == "orders" and not (d.get("totalAmount") or d.get("total") or d.get("price") or d.get("totalINR")):
                    missing_required.append({"id": item["id"], "missing": "price/totalAmount"})
                elif col_name == "users" and not (d.get("email") or d.get("customerEmail")):
                    missing_required.append({"id": item["id"], "missing": "email"})

            col_report = {
                "status": "SUCCESS",
                "document_count": count,
                "oldest_document": {
                    "id": oldest_doc["id"] if oldest_doc else None,
                    "createdAt": oldest_doc["dt"].isoformat() if oldest_doc else None
                },
                "newest_document": {
                    "id": newest_doc["id"] if newest_doc else None,
                    "createdAt": newest_doc["dt"].isoformat() if newest_doc else None
                },
                "last_20_document_ids": last_20_ids,
                "sample_emails": sample_emails,
                "sample_order_ids": sample_order_ids if col_name == "orders" else [],
                "duplicate_ids_count": len(duplicates),
                "duplicate_ids": duplicates,
                "missing_required_fields_count": len(missing_required),
                "missing_required_fields": missing_required[:10]
            }

            report[col_name] = col_report

            print(f"---------------------------------")
            print(f"Collection: {col_name}")
            print(f"---------------------------------")
            print(f"Document Count: {count}")
            print(f"Oldest Document: ID={col_report['oldest_document']['id']} | Date={col_report['oldest_document']['createdAt']}")
            print(f"Newest Document: ID={col_report['newest_document']['id']} | Date={col_report['newest_document']['createdAt']}")
            print(f"Duplicate IDs: {len(duplicates)}")
            print(f"Missing Required Fields: {len(missing_required)}")

        except Exception as e:
            err_msg = str(e)
            is_429 = "429" in err_msg or "Quota exceeded" in err_msg or "ResourceExhausted" in err_msg
            report[col_name] = {
                "status": "429_QUOTA_EXHAUSTED" if is_429 else "ERROR",
                "error": err_msg
            }
            print(f"  [FAIL] Collection '{col_name}' read failed: {err_msg}")

    # Write report
    out_file = root_dir / "scratch" / "live_firestore_enhanced_verification.json"
    out_file.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    print(f"\nEnhanced Verification Results written to {out_file}")

if __name__ == "__main__":
    run_firestore_verification()
