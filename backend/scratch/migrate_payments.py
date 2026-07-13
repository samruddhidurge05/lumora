import sqlite3

def migrate():
    conn = sqlite3.connect('backend/test.db')
    cursor = conn.cursor()
    
    print("Starting payments table schema migration...")
    
    # 1. Create the new payments table with order_id nullable
    cursor.execute("""
    CREATE TABLE payments_new (
        id INTEGER NOT NULL, 
        order_id INTEGER, 
        gateway VARCHAR(30), 
        gateway_ref VARCHAR(120), 
        amount FLOAT NOT NULL, 
        currency VARCHAR(10), 
        status VARCHAR(20), 
        method VARCHAR(30), 
        receipt TEXT, 
        created_at DATETIME, 
        payment_ref VARCHAR(64), 
        vendor_ids TEXT, 
        gateway_order_id VARCHAR(120), 
        gateway_payment_id VARCHAR(120), 
        gateway_signature VARCHAR(256), 
        discount_amount FLOAT DEFAULT 0.0, 
        tax_amount FLOAT DEFAULT 0.0, 
        payment_method VARCHAR(30), 
        failure_reason TEXT, 
        retry_count INTEGER DEFAULT 0, 
        idempotency_key VARCHAR(128), 
        promo_code VARCHAR(50), 
        affiliate_code VARCHAR(50), 
        verified_at DATETIME, 
        completed_at DATETIME, 
        refunded_at DATETIME, 
        expires_at DATETIME, 
        customer_id INTEGER, 
        updated_at DATETIME, 
        PRIMARY KEY (id), 
        FOREIGN KEY(order_id) REFERENCES orders (id)
    )
    """)
    
    # 2. Copy data from old payments table to new payments table
    cursor.execute("""
    INSERT INTO payments_new (
        id, order_id, gateway, gateway_ref, amount, currency, status, method, receipt, created_at, 
        payment_ref, vendor_ids, gateway_order_id, gateway_payment_id, gateway_signature, 
        discount_amount, tax_amount, payment_method, failure_reason, retry_count, idempotency_key, 
        promo_code, affiliate_code, verified_at, completed_at, refunded_at, expires_at, customer_id, updated_at
    ) SELECT 
        id, order_id, gateway, gateway_ref, amount, currency, status, method, receipt, created_at, 
        payment_ref, vendor_ids, gateway_order_id, gateway_payment_id, gateway_signature, 
        discount_amount, tax_amount, payment_method, failure_reason, retry_count, idempotency_key, 
        promo_code, affiliate_code, verified_at, completed_at, refunded_at, expires_at, customer_id, updated_at
    FROM payments
    """)
    
    # 3. Drop old payments table
    cursor.execute("DROP TABLE payments")
    
    # 4. Rename new payments table to payments
    cursor.execute("ALTER TABLE payments_new RENAME TO payments")
    
    # 5. Re-create indexes
    cursor.execute("CREATE UNIQUE INDEX ix_payments_payment_ref ON payments (payment_ref)")
    cursor.execute("CREATE INDEX ix_payments_customer_id ON payments (customer_id)")
    cursor.execute("CREATE INDEX ix_payments_order_id ON payments (order_id)")
    cursor.execute("CREATE INDEX ix_payments_gateway_order_id ON payments (gateway_order_id)")
    cursor.execute("CREATE INDEX ix_payments_gateway_payment_id ON payments (gateway_payment_id)")
    
    conn.commit()
    conn.close()
    print("Payments table schema migration completed successfully!")

if __name__ == '__main__':
    migrate()
