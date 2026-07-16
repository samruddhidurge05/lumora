"""
One-time migration: add missing columns to affiliate_profiles table.
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

print('=== Migrating affiliate_profiles table ===')
affiliate_cols = [
    ('display_name',         'VARCHAR(150)'),
    ('short_bio',            'TEXT'),
    ('country',              'VARCHAR(100)'),
    ('youtube',              'VARCHAR(255)'),
    ('instagram',            'VARCHAR(255)'),
    ('linkedin',             'VARCHAR(255)'),
    ('preferred_categories', 'JSON'),
    ('promotion_methods',    'JSON'),
    ('primary_audience',     'VARCHAR(100)'),
    ('audience_size',        'VARCHAR(50)'),
    ('preferred_language',   'VARCHAR(50)'),
    ('preferred_currency',   'VARCHAR(10)'),
    ('timezone',             'VARCHAR(50)'),
    ('email_notifications',  'BOOLEAN DEFAULT 1'),
]

for col_name, col_def in affiliate_cols:
    add_column_if_missing('affiliate_profiles', col_name, col_def)

print('=== Migration complete ===')
