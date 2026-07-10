import sqlite3

conn = sqlite3.connect('lumora.db')
cur = conn.cursor()

# Check if column already exists
cols = [r[1] for r in cur.execute('PRAGMA table_info(users)').fetchall()]
if 'firebase_uid' not in cols:
    cur.execute('ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(128)')
    conn.commit()
    print("Added firebase_uid column to users table")
else:
    print("firebase_uid already exists")

conn.close()
