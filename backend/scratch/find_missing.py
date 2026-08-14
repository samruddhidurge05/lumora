import sys
from sqlalchemy import create_engine, text

OLD_DB_URL = "postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni?sslmode=require"
NEW_DB_URL = "postgresql://lumoradb_user:fY8L9it8jnhUXADJVfT5snkdPg2vu105@dpg-d9svagv40ujc73dvo4ag-a.oregon-postgres.render.com/lumoradb_o3xd?sslmode=require"

def find_missing():
    try:
        old_engine = create_engine(OLD_DB_URL)
        new_engine = create_engine(NEW_DB_URL)
        
        with old_engine.connect() as old_conn, new_engine.connect() as new_conn:
            print("--- FINDING MISSING USER ---")
            old_users = old_conn.execute(text("SELECT id, email, role FROM users")).fetchall()
            new_users = new_conn.execute(text("SELECT id, email, role FROM users")).fetchall()
            for ou in old_users:
                if ou not in new_users:
                    print(f"Missing User: ID={ou[0]}, Email={ou[1]}, Role={ou[2]}")
                    
            print("\n--- FINDING MISSING PRODUCT ---")
            old_prods = old_conn.execute(text("SELECT id, title, status FROM products")).fetchall()
            new_prods = new_conn.execute(text("SELECT id, title, status FROM products")).fetchall()
            for op in old_prods:
                if op not in new_prods:
                    print(f"Missing Product: ID={op[0]}, Title={op[1]}, Status={op[2]}")
                    
            print("\n--- FINDING MISSING ORDER ITEMS ---")
            old_items = old_conn.execute(text("SELECT id, order_id, product_id, price FROM order_items")).fetchall()
            new_items = new_conn.execute(text("SELECT id, order_id, product_id, price FROM order_items")).fetchall()
            for oi in old_items:
                if oi not in new_items:
                    print(f"Missing OrderItem: ID={oi[0]}, OrderID={oi[1]}, ProductID={oi[2]}, Price={oi[3]}")
                    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    find_missing()
