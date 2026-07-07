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

DB_PATHS = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "test.db"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "lumora.db")
]

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
    ("users", "firebase_uid", "VARCHAR(128)"),
    ("products", "storage_path", "VARCHAR(512)"),
    ("products", "thumbnail_path", "VARCHAR(512)"),
    ("products", "preview_path", "VARCHAR(512)"),
    ("products", "content_type", "VARCHAR(100)"),
    ("products", "hash", "VARCHAR(128)"),
    ("products", "short_desc", "VARCHAR(255)"),
    ("products", "features", "TEXT"),
    ("products", "system_requirements", "TEXT"),
    ("products", "what_you_get", "TEXT"),
    ("products", "installation_guide", "TEXT"),
    ("products", "subcategory", "VARCHAR(100)"),
    ("products", "discount", "FLOAT DEFAULT 0.0"),
    ("products", "preview_images", "TEXT"),
    ("products", "preview_video", "VARCHAR(512)"),
    ("products", "seo_title", "VARCHAR(150)"),
    ("products", "seo_description", "TEXT"),
    ("products", "visibility", "VARCHAR(50) DEFAULT 'public'"),
]


def get_existing_columns(cur, table: str) -> set:
    cur.execute(f"PRAGMA table_info({table})")
    return {row[1] for row in cur.fetchall()}


def table_exists(cur, table: str) -> bool:
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    return cur.fetchone() is not None


def run_migrations_for_db(db_path: str):
    if not os.path.exists(db_path):
        return

    print(f"\n[migrate] Migrating database: {os.path.basename(db_path)}")
    conn = sqlite3.connect(db_path)
    cur  = conn.cursor()

    applied = 0
    skipped = 0

    for table, column, col_def in MIGRATIONS:
        if not table_exists(cur, table):
            print(f"[migrate] SKIP  — table '{table}' does not exist.")
            skipped += 1
            continue
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


def run_migrations():
    for db_path in DB_PATHS:
        run_migrations_for_db(db_path)


if __name__ == "__main__":
    run_migrations()

