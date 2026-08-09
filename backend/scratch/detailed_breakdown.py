import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import SessionLocal
from app.models.review import Review as ReviewModel
from app.models.report import SQLReport as ReportModel
from app.models.user import User as UserModel
from app.models.product import Product as ProductModel

def detailed_breakdown():
    session = SessionLocal()
    try:
        print("=== REVIEWS DETAILED BREAKDOWN ===")
        revs = session.query(ReviewModel).order_by(ReviewModel.id.asc()).all()
        for r in revs:
            u = session.query(UserModel).filter(UserModel.id == r.user_id).first()
            p = session.query(ProductModel).filter(ProductModel.id == r.product_id).first()
            u_info = f"{u.name} ({u.email})" if u else f"User#{r.user_id}"
            p_info = f"{p.title} (ID#{p.id})" if p else f"Product#{r.product_id}"
            print(f"Review #{r.id}: Rating={r.rating}, User={u_info}, Product={p_info}, Comment='{r.comment}', Created={r.created_at}")

        print("\n=== REPORTS DETAILED BREAKDOWN ===")
        reps = session.query(ReportModel).order_by(ReportModel.id.asc()).all()
        for r in reps:
            p = session.query(ProductModel).filter(ProductModel.id == int(r.product_id)).first() if str(r.product_id).isdigit() else None
            p_info = f"{p.title} (ID#{p.id})" if p else f"Product#{r.product_id}"
            print(f"Report #{r.id}: Category='{r.category}', Status='{r.status}', Reporter='{r.reporter}', UserID='{r.user_id}', Product={p_info}, Title='{r.title}', Desc='{r.description}', Created={r.created_at}")

    finally:
        session.close()

if __name__ == "__main__":
    detailed_breakdown()
