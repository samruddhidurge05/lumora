"""
One-time migration: add missing KYC columns to affiliate_profiles table.
Safe to run multiple times - skips columns that already exist.
"""
from app.db.database import engine
from sqlalchemy import text, inspect

inspector = inspect(engine)

def add_column_if_missing(table, col_name, col_def):
    cols = [c['name'] for c in inspector.get_columns(table)]
    if col_name not in cols:
        with engine.connect() as conn:
            conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {col_name} {col_def}'))
            conn.commit()
        print(f'  Added {table}.{col_name}')
    else:
        print(f'  OK {table}.{col_name} already exists')

print('=== Migrating affiliate_profiles KYC fields ===')
kyc_cols = [
    ('kyc_status',               "VARCHAR(30) DEFAULT 'verified'"),
    ('pan_number',               'VARCHAR(20)'),
    ('pan_holder_name',          'VARCHAR(150)'),
    ('gstin',                    'VARCHAR(20)'),
    ('is_bank_verified',         'BOOLEAN DEFAULT 1'),
    ('razorpay_contact_id',      'VARCHAR(100)'),
    ('razorpay_fund_account_id', 'VARCHAR(100)'),
]

for col_name, col_def in kyc_cols:
    add_column_if_missing('affiliate_profiles', col_name, col_def)

print('=== Migration complete ===')
