import sys
import os
import datetime
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))

env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=str(env_path), override=True)

from app.db.session import SessionLocal
from app.models.review import Review
from app.models.report import SQLReport
from sqlalchemy import text

def run_reviews_reports_verification():
    db = SessionLocal()
    try:
        bind = db.get_bind()
        if hasattr(bind, "url"):
            db_url = str(bind.url)
        elif hasattr(bind, "engine") and hasattr(bind.engine, "url"):
            db_url = str(bind.engine.url)
        else:
            db_url = "unknown"
        print("==================================================")
        print("ZERO-ASSUMPTION REVIEWS & REPORTS EMPIRICAL AUDIT")
        print("==================================================")
        print(f"Connected Database URL: {db_url}")
        assert "lumoradb_o3xd" in db_url, "Connected DB must be lumoradb_o3xd!"

        print("\n1. EMPIRICAL REVIEWS TABLE INSPECTION")
        reviews = db.query(Review).all()
        print(f"Total reviews in DB: {len(reviews)}")
        for r in reviews:
            print(f"  - Review ID={r.id} | Product ID={r.product_id} | Rating={r.rating} | Comment='{r.comment}'")
        assert len(reviews) == 2, f"Expected 2 real reviews, found {len(reviews)}"

        print("\n2. EMPIRICAL REPORTS TABLE INSPECTION")
        reports = db.query(SQLReport).all()
        print(f"Total reports in DB: {len(reports)}")
        for r in reports:
            print(f"  - Report ID={r.id} | Title='{r.title}' | Category='{r.category}' | Status='{r.status}' | Reporter='{r.reporter}'")
        assert len(reports) == 7, f"Expected 7 real reports, found {len(reports)}"

        print("\n3. EMPIRICAL WRITE TEST ON NEW DATABASE")
        timestamp_marker = f"VERIFICATION_TEST_{datetime.datetime.now(datetime.timezone.utc).isoformat()}"
        test_report = SQLReport(
            user_id=1,
            product_id=194,
            title="Empirical Verification Ticket",
            category="general",
            description=timestamp_marker,
            status="Pending",
            reporter="System Audit"
        )
        db.add(test_report)
        db.commit()
        db.refresh(test_report)

        created_id = test_report.id
        print(f"  [WRITE] Successfully inserted SQLReport ID={created_id} into lumoradb_o3xd.")

        # Read back from lumoradb_o3xd
        read_back = db.query(SQLReport).filter(SQLReport.id == created_id).first()
        assert read_back is not None, "Failed reading back newly inserted report!"
        assert read_back.description == timestamp_marker, "Description marker mismatch!"
        print(f"  [READ]  Successfully read back SQLReport ID={read_back.id} from lumoradb_o3xd.")

        # Clean up test entry
        db.delete(read_back)
        db.commit()
        print("  [CLEANUP] Cleaned up verification ticket from lumoradb_o3xd [OK]")

        print("\n==================================================")
        print("EMPIRICAL PROOF COMPLETE: REVIEWS AND REPORTS OPERATE EXCLUSIVELY ON NEW DB")
        print("==================================================")

    finally:
        db.close()

if __name__ == "__main__":
    run_reviews_reports_verification()
