"""
FORENSIC SEARCH — ALL EMAILS IN ALL TABLES OF POSTGRESQL
======================================================
Finds every single email address across all tables in production PostgreSQL
to verify if any historical teammate invitation or admin account ever existed.
"""
import psycopg2
import psycopg2.extras

db_url = 'postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni?sslmode=require'

def main():
    conn = psycopg2.connect(db_url)
    conn.set_session(readonly=True, autocommit=True)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # 1. Get all text/varchar columns in all tables
    cur.execute("""
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND data_type IN ('text', 'character varying')
    """)
    cols = cur.fetchall()

    print("=" * 70)
    print("SEARCHING ALL TABLES FOR ANY EMAIL ADDRESS (@)")
    print("=" * 70)

    found_emails = {}
    for c in cols:
        tbl = c["table_name"]
        col = c["column_name"]
        try:
            cur.execute(f"SELECT DISTINCT {col} FROM {tbl} WHERE {col} LIKE '%@%' AND length({col}) < 100")
            rows = cur.fetchall()
            for r in rows:
                val = r[col]
                if val and "@" in val and len(val.split()) == 1:
                    found_emails.setdefault(val.lower(), []).append(f"{tbl}.{col}")
        except Exception:
            pass

    print(f"\n[TOTAL UNIQUE EMAILS FOUND IN ENTIRE DATABASE]: {len(found_emails)}")
    for email in sorted(found_emails.keys()):
        locations = ", ".join(found_emails[email])
        print(f"  - {email:<40} (found in: {locations})")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
