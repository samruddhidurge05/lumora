import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import SessionLocal
from app.models.review import Review as ReviewModel
from app.models.report import SQLReport as ReportModel
from app.shared.firebase.connection import db as fdb, firebase_connected

def run_forensics():
    print("=== POSTGRESQL READ-ONLY QUERY ===")
    session = SessionLocal()
    try:
        rev_count = session.query(ReviewModel).count()
        rep_count = session.query(ReportModel).count()
        print(f"SELECT COUNT(*) FROM reviews; -> {rev_count}")
        print(f"SELECT COUNT(*) FROM reports; -> {rep_count}")
        
        print("\n--- SAMPLE REVIEWS (PG) ---")
        if rev_count > 0:
            sample_revs = session.query(ReviewModel).limit(5).all()
            for r in sample_revs:
                print(f"ID: {r.id}, UserID: {r.user_id}, ProductID: {r.product_id}, Rating: {r.rating}, Comment: {r.comment}")
        else:
            print("There is no production data in PostgreSQL for reviews.")

        print("\n--- SAMPLE REPORTS (PG) ---")
        if rep_count > 0:
            sample_reps = session.query(ReportModel).limit(5).all()
            for r in sample_reps:
                print(f"ID: {r.id}, UserID: {r.user_id}, ProductID: {r.product_id}, Category: {r.category}, Status: {r.status}, Title: {r.title}")
        else:
            print("There is no production data in PostgreSQL for reports.")

    except Exception as e:
        print(f"PG Query Error: {e}")
    finally:
        session.close()

    print("\n=== FIRESTORE READ-ONLY QUERY ===")
    if firebase_connected and fdb is not None:
        try:
            rev_docs = list(fdb.collection("reviews").stream())
            rep_docs = list(fdb.collection("reports").stream())
            print(f"Firestore reviews collection count: {len(rev_docs)}")
            print(f"Firestore reports collection count: {len(rep_docs)}")

            if rev_docs:
                print("Sample Firestore review doc IDs:", [d.id for d in rev_docs[:5]])
                for d in rev_docs[:3]:
                    print(f"  Review doc {d.id}: {d.to_dict()}")

            if rep_docs:
                print("Sample Firestore report doc IDs:", [d.id for d in rep_docs[:5]])
                for d in rep_docs[:3]:
                    print(f"  Report doc {d.id}: {d.to_dict()}")

        except Exception as e:
            print(f"Firestore Query Error: {e}")
    else:
        print("Firestore not connected or db is None")

if __name__ == "__main__":
    run_forensics()
