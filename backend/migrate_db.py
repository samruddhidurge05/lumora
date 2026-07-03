"""
migrate_db.py
-------------
Safe one-time migration for lumora.db.
Adds only columns that are missing — never drops or recreates tables.
Run once:  python migrate_db.py

Idempotent: running multiple times is safe.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lumora.db")

# Each entry: (table_name, column_name, column_def)
MIGRATIONS = [
    ("products", "license", "VARCHAR(50)"),
    ("reviews", "reply", "TEXT"),
    ("vendors", "email", "VARCHAR(255)"),
    ("vendors", "phone", "VARCHAR(50)"),
    ("vendors", "store_url", "VARCHAR(255)"),
    ("vendors", "country", "VARCHAR(100)"),
    ("vendors", "github", "VARCHAR(255)"),
    ("vendors", "tagline", "VARCHAR(255)"),
    ("vendors", "instagram", "VARCHAR(255)"),
    ("vendors", "website", "VARCHAR(255)"),
    ("vendors", "twitter", "VARCHAR(255)"),
    ("vendors", "refund_policy", "TEXT"),
    ("vendors", "support_email", "VARCHAR(255)"),
    ("vendors", "response_time", "VARCHAR(50)"),
    ("vendors", "announcement", "TEXT"),
    ("vendors", "announcement_active", "BOOLEAN DEFAULT 0"),
    ("vendors", "vacation_mode", "BOOLEAN DEFAULT 0"),
    ("vendors", "vacation_message", "TEXT"),
    ("vendors", "status", "VARCHAR(50) DEFAULT 'active'"),
    ("affiliate_profiles", "status", "VARCHAR(50) DEFAULT 'active'"),
]


def get_existing_columns(cur, table: str) -> set:
    cur.execute(f"PRAGMA table_info({table})")
    return {row[1] for row in cur.fetchall()}


def run_migrations():
    if not os.path.exists(DB_PATH):
        print(f"[migrate] Database not found at {DB_PATH}. Skipping migration.")
        return

    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    applied = 0
    skipped = 0

    for table, column, col_def in MIGRATIONS:
        existing = get_existing_columns(cur, table)
        if column in existing:
            print(f"[migrate] SKIP  — {table}.{column} already exists.")
            skipped += 1
        else:
            sql = f"ALTER TABLE {table} ADD COLUMN {column} {col_def}"
            cur.execute(sql)
            print(f"[migrate] ADDED — {table}.{column} {col_def}")
            applied += 1

    conn.commit()
    conn.close()

    print(f"\n[migrate] Done. Applied: {applied}, Skipped: {skipped}")


if __name__ == "__main__":
    run_migrations()
