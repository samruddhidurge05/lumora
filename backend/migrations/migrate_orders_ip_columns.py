"""
migrate_orders_ip_columns.py
────────────────────────────
Idempotent standalone migration script adding client attribution columns
(ip_address, device_type, browser) to the 'orders' table in PostgreSQL / SQLite.
"""

import os
import sys
import logging

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine, text
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate_orders_table() -> None:
    engine = create_engine(settings.DATABASE_URL)
    dialect = engine.dialect.name
    logger.info(f"[migration] Running orders schema migration on dialect '{dialect}'...")

    if dialect == "postgresql":
        pg_statements = [
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS device_type VARCHAR(50)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS browser VARCHAR(100)",
        ]
        raw_conn = engine.raw_connection()
        try:
            dbapi_conn = getattr(raw_conn, "dbapi_connection", getattr(raw_conn, "driver_connection", getattr(raw_conn, "connection", None)))
            target_conn = dbapi_conn if dbapi_conn is not None else raw_conn
            try:
                if hasattr(target_conn, "autocommit"):
                    setattr(target_conn, "autocommit", True)
            except (AttributeError, TypeError):
                pass
            cur = raw_conn.cursor()
            for stmt in pg_statements:
                try:
                    cur.execute(stmt)
                    logger.info(f"[migration] Executed: {stmt}")
                except Exception as err:
                    logger.warning(f"[migration] Statement skipped or failed: {stmt} | {err}")
            cur.close()
        finally:
            raw_conn.close()

    elif dialect == "sqlite":
        with engine.connect() as conn:
            ord_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(orders)"))}
            for col_name, col_type in [("ip_address", "VARCHAR(64)"), ("device_type", "VARCHAR(50)"), ("browser", "VARCHAR(100)")]:
                if col_name not in ord_cols:
                    conn.execute(text(f"ALTER TABLE orders ADD COLUMN {col_name} {col_type}"))
                    logger.info(f"[migration] Added orders.{col_name}")
            conn.commit()

    logger.info("[migration] Orders schema migration complete!")


if __name__ == "__main__":
    migrate_orders_table()
