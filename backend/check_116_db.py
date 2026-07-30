import urllib.request
import json
import sqlite3
import os
from sqlalchemy import create_engine, text

db_url = 'postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni'
engine = create_engine(db_url)

with engine.connect() as conn:
    product = conn.execute(text("SELECT id, vendor_id, status FROM products WHERE id = 116")).fetchone()
    print("Product:", product)
    if product and product.vendor_id:
        user = conn.execute(text("SELECT uid, is_active FROM users WHERE uid = :vid"), {"vid": product.vendor_id}).fetchone()
        print("Vendor User:", user)
