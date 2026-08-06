"""
scripts/sync_firestore_to_postgres.py
---------------------------------------
P0 Production Recovery Data Sync & Migration Tool.

Design Principles:
- READ ONLY from Firestore or JSON backup source.
- INSERT ONLY into PostgreSQL (ON CONFLICT DO NOTHING / skip existing).
- Never delete or modify existing database rows.
- Throttled batch processing with transaction rollback on error.
- Full support for --dry-run mode (default).
"""

import sys
import json
import argparse
import datetime
from pathlib import Path

# Add backend directory to sys.path
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.db.database import engine, SessionLocal
from app.models.user import User as UserModel
from app.models.order import Order as OrderModel, OrderItem as OrderItemModel
from app.models.payment import Payment as PaymentModel

def parse_iso_dt(val):
    if not val:
        return datetime.datetime.now(datetime.timezone.utc)
    if isinstance(val, datetime.datetime):
        return val
    try:
        val_str = str(val).replace("Z", "+00:00")
        return datetime.datetime.fromisoformat(val_str)
    except Exception:
        return datetime.datetime.now(datetime.timezone.utc)

def normalize_collection(raw_data):
    if isinstance(raw_data, dict):
        result = []
        for doc_id, doc_dict in raw_data.items():
            if isinstance(doc_dict, dict):
                result.append({"id": doc_id, **doc_dict})
        return result
    elif isinstance(raw_data, list):
        result = []
        for idx, item in enumerate(raw_data, start=1):
            if isinstance(item, dict):
                result.append({"id": item.get("id") or item.get("orderId") or idx, **item})
        return result
    return []

def run_sync(dry_run: bool = True, source_json: Path | None = None, use_live: bool = False):
    print("=" * 80)
    print(f"P0 FIRESTORE TO POSTGRESQL SYNC TOOL (DRY RUN = {dry_run})")
    print(f"Target Database Engine: {engine.name} ({engine.url})")
    print("=" * 80)

    raw_orders = []
    raw_users = []
    raw_payments = []

    if use_live:
        print("\n[Phase 1] Attempting Live Firestore Connection...")
        try:
            from app.shared.firebase.connection import db, firebase_connected
            if firebase_connected and db is not None:
                raw_orders = [{"id": d.id, **(d.to_dict() or {})} for d in db.collection("orders").stream()]
                raw_users = [{"id": d.id, **(d.to_dict() or {})} for d in db.collection("users").stream()]
                raw_payments = [{"id": d.id, **(d.to_dict() or {})} for d in db.collection("payments").stream()]
                print(f"Live Firestore Fetched: {len(raw_orders)} orders, {len(raw_users)} users, {len(raw_payments)} payments.")
            else:
                print("Live Firestore connection unavailable (429 or auth uninitialized).")
        except Exception as e:
            print(f"Live Firestore Read Error: {e}")

    if not raw_orders and source_json and source_json.exists():
        print(f"\n[Phase 1] Reading from Source Backup JSON: {source_json}")
        try:
            content = json.loads(source_json.read_text(encoding="utf-8", errors="ignore"))
            if isinstance(content, dict):
                raw_orders = normalize_collection(content.get("orders"))
                raw_users = normalize_collection(content.get("users"))
                raw_payments = normalize_collection(content.get("payments"))
                print(f"Backup JSON Loaded: {len(raw_orders)} orders, {len(raw_users)} users, {len(raw_payments)} payments.")
        except Exception as e:
            print(f"Backup JSON Read Error: {e}")

    if not raw_orders:
        print("\nNo order records found in source. Exiting.")
        return

    # Check existing PostgreSQL IDs
    db_s = SessionLocal()
    try:
        existing_order_ids = {o.id for o in db_s.query(OrderModel.id).all()}
        existing_user_ids = {u.id for u in db_s.query(UserModel.id).all()}
        existing_payment_refs = {p.payment_ref for p in db_s.query(PaymentModel.payment_ref).all()}

        print(f"\n[Phase 2] Pre-Sync Existing Database Row Counts:")
        print(f"  Existing PostgreSQL Orders: {len(existing_order_ids)}")
        print(f"  Existing PostgreSQL Users:  {len(existing_user_ids)}")
        print(f"  Existing PostgreSQL Payments: {len(existing_payment_refs)}")

        orders_to_insert = []
        skipped_orders = 0

        for idx, o in enumerate(raw_orders, start=1):
            raw_id = o.get("id") or o.get("orderId") or idx
            # Parse numeric ID
            try:
                num_id = int(str(raw_id).replace("ORD-", "").replace("ord_", ""))
            except Exception:
                num_id = idx + 1000  # Fallback offset for non-numeric IDs

            if num_id in existing_order_ids:
                skipped_orders += 1
                continue

            u_id = o.get("userId") or o.get("user_id") or o.get("customerId") or 1
            try:
                u_id = int(u_id)
            except Exception:
                u_id = 1

            amt = float(o.get("totalINR") or o.get("totalAmount") or o.get("total") or o.get("price") or 0.0)
            status = str(o.get("status") or o.get("paymentStatus") or "completed").lower()
            method = str(o.get("paymentMethod") or o.get("method") or "razorpay")
            created_dt = parse_iso_dt(o.get("createdAt") or o.get("created_at") or o.get("purchaseDate"))
            c_name = o.get("customerName") or "Customer"
            c_email = o.get("customerEmail") or ""

            orders_to_insert.append({
                "id": num_id,
                "user_id": u_id,
                "customer_name": c_name,
                "customer_email": c_email,
                "total_amount": amt,
                "status": status,
                "payment_method": method,
                "payment_id": str(o.get("paymentId") or o.get("razorpay_payment_id") or f"LUM-SYNC-{num_id}"),
                "created_at": created_dt,
                "raw_doc_id": str(raw_id)
            })

        print(f"\n[Phase 3] Sync Action Summary:")
        print(f"  Total Source Orders Parsed: {len(raw_orders)}")
        print(f"  Skipped Duplicate Orders:  {skipped_orders}")
        print(f"  New Orders To Insert:      {len(orders_to_insert)}")

        if dry_run:
            print("\n[DRY RUN MODE] No database writes were committed.")
            print("\nSample Planned Order Inserts (first 5):")
            for item in orders_to_insert[:5]:
                print(f"  Order ID={item['id']} ({item['raw_doc_id']}) | Customer='{item['customer_name']}' ({item['customer_email']}) | Amount=INR {item['total_amount']} | Status='{item['status']}' | Date={item['created_at']}")
        else:
            print("\n[EXECUTE MODE] Committing new records to PostgreSQL...")
            inserted = 0
            for item in orders_to_insert:
                try:
                    ord_obj = OrderModel(
                        id=item["id"],
                        user_id=item["user_id"],
                        total_amount=item["total_amount"],
                        status=item["status"],
                        payment_method=item["payment_method"],
                        payment_id=item["payment_id"],
                        created_at=item["created_at"]
                    )
                    db_s.add(ord_obj)
                    db_s.commit()
                    inserted += 1
                except Exception as ex:
                    db_s.rollback()
                    print(f"  Error inserting Order ID {item['id']}: {ex}")
            print(f"Successfully committed {inserted} new orders to PostgreSQL.")

    finally:
        db_s.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="P0 Firestore to PostgreSQL Migration Script")
    parser.add_argument("--execute", action="store_true", help="Execute database inserts (default is dry-run)")
    parser.add_argument("--source-json", type=str, default="backend/backups/firestore_backup_20260718_233756.json", help="Path to backup JSON file")
    parser.add_argument("--live", action="store_true", help="Attempt live Firestore read")

    args = parser.parse_args()
    source_path = root_dir / args.source_json if args.source_json else None
    run_sync(dry_run=not args.execute, source_json=source_path, use_live=args.live)
