"""
Insert AdminRole records for legitimate production admin accounts in PostgreSQL
"""
import psycopg2
import psycopg2.extras

db_url = 'postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni?sslmode=require'
conn = psycopg2.connect(db_url)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("SELECT id, name, email FROM users WHERE role='admin'")
admins = cur.fetchall()

for a in admins:
    cur.execute(
        "INSERT INTO admin_roles (user_id, role_level, is_active, activated_at, created_at) VALUES (%s, %s, true, NOW(), NOW())",
        (a['id'], 'super_admin')
    )
    print(f"Inserted super_admin AdminRole for user_id={a['id']} ({a['email']})")

conn.commit()

cur.execute("""
    SELECT ar.id, ar.user_id, ar.role_level, ar.is_active, u.name, u.email 
    FROM admin_roles ar 
    JOIN users u ON u.id = ar.user_id 
    WHERE ar.is_active = true
""")
print("\n=== VERIFICATION: ACTIVE TEAM MEMBERS IN POSTGRESQL ===")
for r in cur.fetchall():
    print(r)

conn.close()
