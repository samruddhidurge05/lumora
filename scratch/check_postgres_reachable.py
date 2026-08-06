from sqlalchemy import create_engine, text

RENDER_PG_URL = "postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni?sslmode=require"

def check():
    print(f"Testing connection to Render PostgreSQL: dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com")
    try:
        engine = create_engine(RENDER_PG_URL)
        with engine.connect() as conn:
            res = conn.execute(text("SELECT 1;"))
            val = res.fetchone()[0]
            print(f"Render PostgreSQL Connection SUCCESS! SELECT 1 returned: {val}")
    except Exception as e:
        print(f"Render PostgreSQL Connection FAILED: {e}")

if __name__ == "__main__":
    check()
