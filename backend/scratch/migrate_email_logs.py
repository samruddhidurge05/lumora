import sys
import os
import sqlite3

db_path = "lumora.db"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check table info for admin_email_logs
cursor.execute("PRAGMA table_info(admin_email_logs)")
columns = [row[1] for row in cursor.fetchall()]
print(f"Current admin_email_logs columns: {columns}")

if "message_id" not in columns:
    print("Adding 'message_id' column to admin_email_logs table...")
    cursor.execute("ALTER TABLE admin_email_logs ADD COLUMN message_id VARCHAR(255)")
    conn.commit()
    print("Column 'message_id' added successfully.")
else:
    print("Column 'message_id' already exists.")

cursor.execute("PRAGMA table_info(admin_email_logs)")
updated_columns = [row[1] for row in cursor.fetchall()]
print(f"Updated admin_email_logs columns: {updated_columns}")

conn.close()
