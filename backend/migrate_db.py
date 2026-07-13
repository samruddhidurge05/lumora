"""
One-time migration: add any missing columns to vendors and other tables.
Safe to run multiple times — skips columns that already exist.
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

print('=== Migrating vendors table ===')
vendor_cols = [
    ('upi_id',              'TEXT'),
    ('account_holder_name', 'TEXT'),
    ('bank_name',           'TEXT'),
    ('account_number',      'TEXT'),
    ('ifsc_code',           'TEXT'),
    ('refund_policy',       'TEXT'),
    ('support_email',       'TEXT'),
    ('response_time',       'TEXT DEFAULT "24 hours"'),
    ('announcement',        'TEXT'),
    ('announcement_active', 'INTEGER DEFAULT 0'),
    ('vacation_mode',       'INTEGER DEFAULT 0'),
    ('vacation_message',    'TEXT'),
    ('tagline',             'TEXT'),
    ('instagram',           'TEXT'),
    ('website',             'TEXT'),
    ('twitter',             'TEXT'),
    ('github',              'TEXT'),
    ('store_url',           'TEXT'),
    ('country',             'TEXT'),
    ('phone',               'TEXT'),
]
for col_name, col_def in vendor_cols:
    add_column_if_missing('vendors', col_name, col_def)

print('=== Migrating payments table ===')
add_column_if_missing('payments', 'items_json', 'TEXT')
add_column_if_missing('payments', 'updated_at', 'DATETIME')
add_column_if_missing('payments', 'customer_id', 'INTEGER')

print('=== Migration complete ===')
