import sys
import os
from typing import cast, Any
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))

env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=str(env_path), override=True)

from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    bind = db.get_bind() if hasattr(db, "get_bind") else getattr(db, "bind", None)
    dialect_name = bind.dialect.name if bind and hasattr(bind, "dialect") else "unknown"
    if hasattr(bind, "url"):
        db_url_str = str(bind.url)
    elif hasattr(bind, "engine") and hasattr(bind.engine, "url"):
        db_url_str = str(bind.engine.url)
    else:
        db_url_str = "unknown"
    print(f"Connected DB Dialect: {dialect_name}")
    print(f"Connected DB URL: {db_url_str}")

    max_id = cast(int, db.execute(text('SELECT MAX(id) FROM products')).scalar() or 0)
    all_ids = [r[0] for r in db.execute(text('SELECT id FROM products ORDER BY id')).fetchall()]
    print(f"MAX(id) in products: {max_id}")
    print(f"Existing product IDs: {all_ids}")

    if dialect_name == "postgresql":
        seq_name = db.execute(text("SELECT pg_get_serial_sequence('products', 'id')")).scalar()
        curr_seq = db.execute(text(f"SELECT last_value FROM {seq_name}")).scalar() if seq_name else None
        print(f"Sequence name: {seq_name}")
        print(f"Current sequence last_value: {curr_seq}")
finally:
    db.close()
