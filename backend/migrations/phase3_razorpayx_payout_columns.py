"""
migrations/phase3_razorpayx_payout_columns.py
-----------------------------------------------
Adds Phase 3 RazorpayX payout tracking columns to platform_withdrawals.

Columns added:
  - razorpayx_payout_id        VARCHAR(120)   nullable, indexed
  - razorpayx_fund_account_id  VARCHAR(120)   nullable

Safe to run multiple times (idempotent).
"""

import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "lumora.db")


def column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    cursor = conn.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def run():
    db = os.path.abspath(DB_PATH)
    if not os.path.exists(db):
        print(f"[migration] Database not found at {db}. Skipping.")
        return

    conn = sqlite3.connect(db)
    try:
        conn.execute("BEGIN")

        if not column_exists(conn, "platform_withdrawals", "razorpayx_payout_id"):
            conn.execute(
                "ALTER TABLE platform_withdrawals ADD COLUMN razorpayx_payout_id VARCHAR(120)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS ix_platform_withdrawals_razorpayx_payout "
                "ON platform_withdrawals (razorpayx_payout_id)"
            )
            print("[migration] Added column: platform_withdrawals.razorpayx_payout_id")
        else:
            print("[migration] Column razorpayx_payout_id already exists — skipped.")

        if not column_exists(conn, "platform_withdrawals", "razorpayx_fund_account_id"):
            conn.execute(
                "ALTER TABLE platform_withdrawals ADD COLUMN razorpayx_fund_account_id VARCHAR(120)"
            )
            print("[migration] Added column: platform_withdrawals.razorpayx_fund_account_id")
        else:
            print("[migration] Column razorpayx_fund_account_id already exists — skipped.")

        conn.execute("COMMIT")
        print("[migration] phase3_razorpayx_payout_columns — DONE.")
    except Exception as exc:
        conn.execute("ROLLBACK")
        print(f"[migration] FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    run()
