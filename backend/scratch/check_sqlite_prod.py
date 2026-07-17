import sqlite3

conn = sqlite3.connect('backend/test.db')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("Tables:", cursor.fetchall())
cursor.execute("SELECT id, title, thumbnail, preview, status FROM products WHERE id = 122")
print("Row 122:", cursor.fetchone())
conn.close()
