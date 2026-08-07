import os
import sys
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)

from dotenv import load_dotenv
load_dotenv(os.path.join(project_root, ".env"))

from app.db.session import SessionLocal
from app.shared.firebase.connection import db as fdb, firebase_connected
from app.models import (
    RefundRequest, ProductDownloadEvent, Order, User, AffiliateProfile, Review, SQLReport
)

def inspect_candidates():
    print("=" * 100)
    print("FORENSIC INSPECTION OF CANDIDATE MISSING RECORDS")
    print("=" * 100)

    session = SessionLocal()

    if not firebase_connected or fdb is None:
        print("\n[ERROR] Firebase Admin SDK is not connected or db is None.")
        print("Please check your .env file and ensure FIREBASE_SERVICE_ACCOUNT_JSON or serviceAccountKey.json is valid.")
        session.close()
        return

    # 1. Refund Requests
    print("\n--- FIRESTORE REFUND REQUESTS (5) vs PG (1) ---")
    pg_ref_ids = set(r.id for r in session.query(RefundRequest.id).all())
    print(f"PG Refund Request IDs: {pg_ref_ids}")
    fs_ref_docs = list(fdb.collection("refund_requests").stream())
    if not fs_ref_docs:
        fs_ref_docs = list(fdb.collection("refunds").stream())
    for d in fs_ref_docs:
        data = d.to_dict() or {}
        print(f"  FS Refund Doc ID: {d.id} => {data}")

    # 2. Download Events
    print("\n--- FIRESTORE DOWNLOAD EVENTS (7) vs PG (1) ---")
    pg_dl_ids = set(d.id for d in session.query(ProductDownloadEvent.id).all())
    print(f"PG Download Event IDs: {pg_dl_ids}")
    fs_dl_docs = list(fdb.collection("downloads").stream())
    for d in fs_dl_docs:
        data = d.to_dict() or {}
        print(f"  FS Download Doc ID: {d.id} => {data}")

    # 3. Orders missing in PG
    print("\n--- FIRESTORE ORDERS (81) vs PG (78) ---")
    pg_orders = {o.id: o for o in session.query(Order).all()}
    fs_orders = list(fdb.collection("orders").stream())
    for d in fs_orders:
        data = d.to_dict() or {}
        # Parse ID
        oid_raw = d.id
        oid_num = None
        if oid_raw.startswith("ORD-") and oid_raw[4:].isdigit():
            oid_num = int(oid_raw[4:])
        elif oid_raw.isdigit():
            oid_num = int(oid_raw)
        
        if oid_num and oid_num not in pg_orders:
            print(f"  Missing Order in PG -> FS Doc [{d.id}] (numeric id: {oid_num}): user_id={data.get('user_id') or data.get('userId')}, total={data.get('total') or data.get('amount')}, items={data.get('items')}, created={data.get('createdAt') or data.get('created_at')}")

    # 4. Affiliates missing in PG
    print("\n--- FIRESTORE AFFILIATES (25) vs PG (3) ---")
    pg_aff_user_ids = set(a.user_id for a in session.query(AffiliateProfile.user_id).all())
    pg_aff_codes = set(a.referral_code for a in session.query(AffiliateProfile.referral_code).all())
    print(f"PG Affiliate User IDs: {pg_aff_user_ids}")
    print(f"PG Affiliate Codes: {pg_aff_codes}")

    fs_affs = list(fdb.collection("affiliates").stream())
    for d in fs_affs:
        data = d.to_dict() or {}
        email = data.get("email")
        code = data.get("affiliateCode") or data.get("code")
        print(f"  FS Aff Doc [{d.id}]: code={code}, email={email}, name={data.get('fullName')}, status={data.get('status')}")

    session.close()

if __name__ == "__main__":
    inspect_candidates()
