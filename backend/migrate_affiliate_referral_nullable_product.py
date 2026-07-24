"""
migrate_affiliate_referral_nullable_product.py
================================================
Makes affiliate_referrals.product_id nullable.

Why:
    The track-click endpoint creates AffiliateReferral rows when the referral
    URL has no product_id (plain ?ref=CODE links). The previous NOT NULL
    constraint prevented this, causing silent attribution failures for
    no-product-id referral flows.

Run once on the live database:
    python migrate_affiliate_referral_nullable_product.py
"""
from sqlalchemy import create_engine, text
from app.core.config import settings

engine = create_engine(str(settings.DATABASE_URL))

with engine.connect() as conn:
    # Detect dialect
    dialect = engine.dialect.name

    if "postgres" in dialect:
        print("[migrate] PostgreSQL: dropping NOT NULL on affiliate_referrals.product_id ...")
        conn.execute(text(
            "ALTER TABLE affiliate_referrals ALTER COLUMN product_id DROP NOT NULL;"
        ))
        conn.commit()
        print("[migrate] Done.")
    elif "sqlite" in dialect:
        # SQLite does not support ALTER COLUMN.
        # The column is already effectively nullable in SQLite because NOT NULL
        # enforcement is loose; no action needed for local dev.
        print("[migrate] SQLite detected — no migration needed (SQLite ignores FK NOT NULL for nullable FKs).")
    else:
        print(f"[migrate] Unknown dialect '{dialect}' — please run the equivalent ALTER TABLE manually.")
        print("  SQL: ALTER TABLE affiliate_referrals ALTER COLUMN product_id DROP NOT NULL;")
