import urllib.parse
from sqlalchemy import create_engine, text

db_url = 'postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni'

try:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'vendor_id'"))
        print(list(result))
        
        result2 = conn.execute(text("SELECT vendor_id FROM products WHERE id = 196"))
        val = list(result2)[0][0]
        print("Actual value:", repr(val))
except Exception as e:
    print(f"Error connecting to db: {e}")
