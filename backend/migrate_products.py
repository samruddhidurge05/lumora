import sys
import os
sys.path.insert(0, ".")

from app.db.database import engine
from app.models.product import Product
from sqlalchemy import inspect, text

inspector = inspect(engine)
columns_in_db = {col['name'] for col in inspector.get_columns('products')}

print("Existing columns in products table:", columns_in_db)

# We want to check all columns in the Product model
for col_name, col_obj in Product.__table__.columns.items():
    if col_name not in columns_in_db:
        print(f"Column '{col_name}' is missing. Adding...")
        # Determine the SQL type
        sql_type = str(col_obj.type)
        if "VARCHAR" in sql_type:
            sql_type = "TEXT"
        elif "BOOLEAN" in sql_type:
            sql_type = "INTEGER"
        elif "FLOAT" in sql_type:
            sql_type = "REAL"
        elif "INTEGER" in sql_type:
            sql_type = "INTEGER"
        elif "JSON" in sql_type:
            sql_type = "TEXT"
        elif "DATETIME" in sql_type:
            sql_type = "DATETIME"
        
        # Build default value
        default_clause = ""
        if col_obj.default is not None:
            val = col_obj.default.arg
            if isinstance(val, (int, float)):
                default_clause = f" DEFAULT {val}"
            elif isinstance(val, bool):
                default_clause = f" DEFAULT {1 if val else 0}"
            elif isinstance(val, str):
                default_clause = f" DEFAULT '{val}'"
            elif callable(val):
                # e.g. utcnow, list
                pass
        
        alter_query = f"ALTER TABLE products ADD COLUMN {col_name} {sql_type}{default_clause}"
        print("  Running:", alter_query)
        try:
            with engine.connect() as conn:
                conn.execute(text(alter_query))
                conn.commit()
            print(f"  Successfully added products.{col_name}")
        except Exception as e:
            print(f"  Failed to add products.{col_name}: {e}")
    else:
        print(f"Column '{col_name}' already exists.")

print("Migration complete!")
