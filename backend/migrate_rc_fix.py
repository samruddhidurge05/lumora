"""
RC Fix Migration - adds missing columns to payments and conversations tables.
Run once: python migrate_rc_fix.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "lumora.db")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# -- payments migrations -------------------------------------------------------
payments_to_add = [
    ("payment_ref",        "TEXT"),
    ("vendor_ids",         "TEXT"),
    ("gateway_order_id",   "TEXT"),
    ("gateway_payment_id", "TEXT"),
    ("gateway_signature",  "TEXT"),
    ("discount_amount",    "REAL DEFAULT 0.0"),
    ("tax_amount",         "REAL DEFAULT 0.0"),
    ("payment_method",     "TEXT"),
    ("failure_reason",     "TEXT"),
    ("retry_count",        "INTEGER DEFAULT 0"),
    ("idempotency_key",    "TEXT"),
    ("promo_code",         "TEXT"),
    ("affiliate_code",     "TEXT"),
    ("customer_id",        "INTEGER"),
    ("updated_at",         "DATETIME"),
    ("verified_at",        "DATETIME"),
    ("completed_at",       "DATETIME"),
    ("refunded_at",        "DATETIME"),
    ("expires_at",         "DATETIME"),
]

cursor.execute("PRAGMA table_info(payments)")
existing_payments = {row[1] for row in cursor.fetchall()}

for col, coltype in payments_to_add:
    if col not in existing_payments:
        cursor.execute(f"ALTER TABLE payments ADD COLUMN {col} {coltype}")
        print(f"  + payments.{col}")
    else:
        print(f"  = payments.{col} (already exists)")

# Backfill payment_ref with a unique value for any existing rows
cursor.execute(
    "UPDATE payments SET payment_ref = 'LUM-LEGACY-' || CAST(id AS TEXT) WHERE payment_ref IS NULL"
)
print("  backfilled payment_ref for legacy rows")

# -- conversations migrations --------------------------------------------------
conversations_to_add = [
    ("type",        "TEXT DEFAULT 'support_ticket'"),
    ("status",      "TEXT DEFAULT 'open'"),
    ("category",    "TEXT"),
    ("title",       "TEXT"),
    ("resolved_at", "DATETIME"),
]

cursor.execute("PRAGMA table_info(conversations)")
existing_convs = {row[1] for row in cursor.fetchall()}

for col, coltype in conversations_to_add:
    if col not in existing_convs:
        cursor.execute(f"ALTER TABLE conversations ADD COLUMN {col} {coltype}")
        print(f"  + conversations.{col}")
    else:
        print(f"  = conversations.{col} (already exists)")

conn.commit()
conn.close()
print("\nMigration complete.")
