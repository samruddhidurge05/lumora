import sys
import os
import sqlite3

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import SessionLocal
from app.models.review import Review as ReviewModel
from app.models.report import SQLReport as ReportModel

def inspect_all_data():
    print("=====================================================")
    print("1. RENDER POSTGRESQL DETAILED ROWS")
    print("=====================================================")
    session = SessionLocal()
    try:
        revs = session.query(ReviewModel).all()
        print(f"\n--- POSTGRESQL REVIEWS ({len(revs)} total) ---")
        for r in revs:
            print(f"  ID: {r.id} | UserID: {r.user_id} | ProductID: {r.product_id} | Rating: {r.rating} | Comment: '{r.comment}' | CreatedAt: {r.created_at}")

        reps = session.query(ReportModel).all()
        print(f"\n--- POSTGRESQL REPORTS ({len(reps)} total) ---")
        for r in reps:
            print(f"  ID: {r.id} | UserID: '{r.user_id}' | ProductID: '{r.product_id}' | Category: '{r.category}' | Status: '{r.status}' | Title: '{r.title}' | Reporter: '{r.reporter}' | Description: '{r.description}' | CreatedAt: {r.created_at}")

    except Exception as e:
        print(f"PostgreSQL query error: {e}")
    finally:
        session.close()

    print("\n=====================================================")
    print("2. LOCAL SQLITE lumora.db ROWS")
    print("=====================================================")
    sqlite_db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "lumora.db"))
    if os.path.exists(sqlite_db_path):
        conn = sqlite3.connect(sqlite_db_path)
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [t[0] for t in cursor.fetchall()]
            print("SQLite tables found:", tables)

            if "reviews" in tables:
                cursor.execute("SELECT * FROM reviews")
                rows = cursor.fetchall()
                print(f"\n--- SQLITE lumora.db REVIEWS ({len(rows)} total) ---")
                cursor.execute("PRAGMA table_info(reviews)")
                cols = [c[1] for c in cursor.fetchall()]
                print("Columns:", cols)
                for r in rows:
                    print("  Row:", r)

            if "reports" in tables:
                cursor.execute("SELECT * FROM reports")
                rows = cursor.fetchall()
                print(f"\n--- SQLITE lumora.db REPORTS ({len(rows)} total) ---")
                cursor.execute("PRAGMA table_info(reports)")
                cols = [c[1] for c in cursor.fetchall()]
                print("Columns:", cols)
                for r in rows:
                    print("  Row:", r)
        except Exception as e:
            print(f"SQLite error: {e}")
        finally:
            conn.close()
    else:
        print(f"SQLite DB file not found at {sqlite_db_path}")

    print("\n=====================================================")
    print("3. OTHER DB / BACKUP FILES DISCOVERY")
    print("=====================================================")
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    for root, dirs, files in os.walk(backend_dir):
        for f in files:
            if f.endswith(".db") or "bak" in f or "backup" in f:
                full_path = os.path.join(root, f)
                if full_path == sqlite_db_path:
                    continue
                try:
                    conn = sqlite3.connect(full_path)
                    cursor = conn.cursor()
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
                    tables = [t[0] for t in cursor.fetchall()]
                    if "reviews" in tables or "reports" in tables:
                        print(f"\nFound DB: {full_path}")
                        if "reviews" in tables:
                            cursor.execute("SELECT COUNT(*) FROM reviews")
                            rc = cursor.fetchone()[0]
                            print(f"  reviews table count: {rc}")
                            cursor.execute("SELECT * FROM reviews")
                            for row in cursor.fetchall():
                                print("    Review:", row)
                        if "reports" in tables:
                            cursor.execute("SELECT COUNT(*) FROM reports")
                            rpc = cursor.fetchone()[0]
                            print(f"  reports table count: {rpc}")
                            cursor.execute("SELECT * FROM reports")
                            for row in cursor.fetchall():
                                print("    Report:", row)
                    conn.close()
                except Exception:
                    pass

if __name__ == "__main__":
    inspect_all_data()
