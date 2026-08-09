import sys
import os
import sqlite3

def find_real_reviews_and_reports():
    print("=====================================================")
    print("SEARCHING ALL DB/BAK FILES FOR NON-TEST REVIEWS/REPORTS")
    print("=====================================================")
    
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    
    db_files = []
    for root, dirs, files in os.walk(workspace_dir):
        if ".git" in root or "node_modules" in root or ".venv" in root:
            continue
        for f in files:
            if f.endswith(".db") or "bak" in f or "backup" in f or f.endswith(".sqlite"):
                db_files.append(os.path.join(root, f))

    print(f"Found {len(db_files)} potential DB files:")
    for dbf in db_files:
        print("  -", os.path.relpath(dbf, workspace_dir))

    for dbf in db_files:
        print(f"\n--- Inspecting {os.path.basename(dbf)} ---")
        try:
            conn = sqlite3.connect(dbf)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [t[0] for t in cursor.fetchall()]
            
            if "reviews" in tables:
                cursor.execute("SELECT * FROM reviews WHERE comment NOT LIKE '%Audit test%' AND comment NOT LIKE '%test%' AND comment != ''")
                non_test_revs = cursor.fetchall()
                print(f"  Non-test reviews count in {os.path.basename(dbf)}: {len(non_test_revs)}")
                for r in non_test_revs:
                    print("    Real Review:", r)

            if "reports" in tables:
                cursor.execute("SELECT * FROM reports WHERE description NOT LIKE '%Testing admin%' AND description NOT LIKE '%test%'")
                non_test_reps = cursor.fetchall()
                print(f"  Non-test reports count in {os.path.basename(dbf)}: {len(non_test_reps)}")
                for r in non_test_reps:
                    print("    Real Report:", r)
            conn.close()
        except Exception as e:
            print(f"  Error reading {dbf}: {e}")

if __name__ == "__main__":
    find_real_reviews_and_reports()
