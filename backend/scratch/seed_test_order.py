import sqlite3
from datetime import datetime, timezone

def seed():
    conn = sqlite3.connect('backend/test.db')
    cursor = conn.cursor()
    
    # User IDs to seed: 5 (Maitri Durge) and 6 (lumora109)
    user_ids = [5, 6]
    
    for uid in user_ids:
        # Check if the user already has this order to avoid duplicates
        cursor.execute("SELECT id FROM orders WHERE user_id=? AND payment_id=?", (uid, f"PAY-SEED-102-{uid}"))
        existing_order = cursor.fetchone()
        
        if existing_order:
            print(f"User {uid} already has seeded order.")
            continue
            
        now_str = datetime.now(timezone.utc).isoformat()
        
        # 1. Insert Order
        cursor.execute("""
            INSERT INTO orders (
                user_id, status, total_amount, currency, discount_amount, payment_method, payment_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            uid, "completed", 15.0, "INR", 0.0, "upi", f"PAY-SEED-102-{uid}", now_str, now_str
        ))
        order_id = cursor.lastrowid
        
        # 2. Insert Payment
        cursor.execute("""
            INSERT INTO payments (
                order_id, gateway, amount, currency, status, payment_ref, customer_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            order_id, "mock", 15.0, "INR", "SUCCESS", f"PAY-SEED-102-{uid}", uid, now_str, now_str
        ))
        
        # 3. Insert Order Item (Lunar Manifestation Monthly Planner - ID 102)
        cursor.execute("""
            INSERT INTO order_items (
                order_id, product_id, price_paid, download_url, downloaded, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, (
            order_id, 102, 15.0, "/api/products/102/download", True, now_str
        ))
        
        # 4. Insert Download Activity Log
        cursor.execute("""
            INSERT INTO user_activities (
                user_id, activity_type, details, created_at
            ) VALUES (?, ?, ?, ?)
        """, (
            uid, "download", "Downloaded product 'Lunar Manifestation Monthly Planner' (ID 102).", now_str
        ))
        
        print(f"Successfully seeded order, payment, and download log for user ID {uid}.")
        
    conn.commit()
    conn.close()

if __name__ == '__main__':
    seed()
