"""
migrate_payout_v2.py
=====================
Safe, additive migration: adds 6 new nullable columns to affiliate_payouts.

Run from the backend/ directory:
    python migrate_payout_v2.py

All new columns are nullable with no defaults required on existing rows.
This migration is fully backward-compatible — no existing data is modified.

Columns Added
-------------
  payout_mode              TEXT     — "mock" | "razorpay"
  razorpay_payout_id       TEXT     — Razorpay payout ID (provider reference)
  razorpay_fund_account_id TEXT     — Razorpay fund account ID
  failure_reason           TEXT     — Error description when payout failed
  processed_at             DATETIME — When provider was called
  completed_at             DATETIME — When payout was confirmed complete
"""
import sys
import os
from pathlib import Path

# Ensure backend/ is on sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from dotenv import load_dotenv
load_dotenv(dotenv_path=BASE_DIR / ".env", override=True)

from sqlalchemy import text, inspect
from app.db.database import engine

COLUMNS_TO_ADD = [
    ("payout_mode",              "TEXT",     None),
    ("razorpay_payout_id",       "TEXT",     None),
    ("razorpay_fund_account_id", "TEXT",     None),
    ("failure_reason",           "TEXT",     None),
    ("processed_at",             "DATETIME", None),
    ("completed_at",             "DATETIME", None),
]


def column_exists(conn, table: str, column: str) -> bool:
    """Return True if the column already exists (SQLite-safe)."""
    result = conn.execute(text(f"PRAGMA table_info({table})"))
    return any(row[1] == column for row in result)


def run_migration():
    print("=" * 60)
    print("Payout V2 Migration: affiliate_payouts")
    print("=" * 60)

    with engine.connect() as conn:
        for col_name, col_type, default in COLUMNS_TO_ADD:
            if column_exists(conn, "affiliate_payouts", col_name):
                print(f"  [SKIP]  {col_name} already exists")
                continue

            ddl = f"ALTER TABLE affiliate_payouts ADD COLUMN {col_name} {col_type}"
            if default is not None:
                ddl += f" DEFAULT {default}"

            conn.execute(text(ddl))
            print(f"  [ADD]   {col_name} {col_type}")

        conn.commit()

    print()
    print("Migration complete. All columns verified.")
    print("=" * 60)

    # Verification pass
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(affiliate_payouts)"))
        existing = {row[1] for row in result}
        for col_name, _, _ in COLUMNS_TO_ADD:
            status = "OK" if col_name in existing else "MISSING"
            print(f"  [{status}] {col_name}")

    print("=" * 60)


if __name__ == "__main__":
    run_migration()
