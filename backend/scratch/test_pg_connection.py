import sys
from sqlalchemy import create_engine, text

pg_url = "postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni"

print("Connecting to PostgreSQL...")
try:
    engine = create_engine(pg_url)
    with engine.connect() as conn:
        res = conn.execute(text("SELECT version();")).fetchone()
        print("SUCCESS: Connected to PostgreSQL!")
        if res:
            print("Server Version:", res[0])
        else:
            print("Server Version: No version information returned.")
except Exception as e:
    print("FAILED Connection:", e)
    sys.exit(1)
