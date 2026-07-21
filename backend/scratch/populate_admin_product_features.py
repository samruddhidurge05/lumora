"""
populate_admin_product_features.py
------------------------------------
Populates features + highlights for admin-created products (115-120)
that have empty features/highlights due to the pre-fix bug.
Features are derived from each product's description and category.
After populating SQLite, re-syncs to Firestore.

Run from backend/ directory:
    .venv/Scripts/python.exe scratch/populate_admin_product_features.py
"""
import sys, os
_B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _B)
_e = os.path.join(_B, ".env")
if os.path.exists(_e):
    with open(_e) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())

from app.db.session import SessionLocal
from app.models.product import Product
from admin.firestore.admin_firestore import sync_product_to_firestore

# Features to assign per product (based on their titles/descriptions)
PRODUCT_FEATURES = {
    115: {  # UI Design Icon Pack & Guide
        "features": [
            "500+ premium vector icons in SVG & PNG",
            "Organized by category for fast browsing",
            "Scalable to any size without quality loss",
            "Commercial usage license included",
            "Figma & Adobe Illustrator compatible",
            "Free lifetime updates included",
        ],
        "highlights": [
            "500+ premium vector icons in SVG & PNG",
            "Figma & Adobe Illustrator compatible",
            "Commercial usage license included",
            "Free lifetime updates included",
        ]
    },
    116: {  # The Personal Budget Planner
        "features": [
            "Monthly income & expense tracker",
            "Automatic savings goal calculator",
            "Visual charts for spending categories",
            "Bill payment reminder system",
            "Works in Google Sheets & Excel",
            "One-time purchase, lifetime access",
        ],
        "highlights": [
            "Monthly income & expense tracker",
            "Automatic savings goal calculator",
            "Works in Google Sheets & Excel",
            "One-time purchase, lifetime access",
        ]
    },
    117: {  # Study Planner & Exam Organizer
        "features": [
            "Weekly and monthly study schedule templates",
            "Exam countdown and priority planner",
            "Subject-wise progress tracker",
            "Revision notes and flashcard system",
            "Compatible with Notion and PDF readers",
            "Printable A4 & A5 formats included",
        ],
        "highlights": [
            "Weekly and monthly study schedule templates",
            "Subject-wise progress tracker",
            "Compatible with Notion and PDF readers",
            "Printable A4 & A5 formats included",
        ]
    },
    118: {  # The Freelancer Client Toolkit
        "features": [
            "Client onboarding questionnaire template",
            "Project proposal and contract templates",
            "Invoice and payment tracking system",
            "Weekly productivity planner for freelancers",
            "Client communication scripts included",
            "Works in Notion, Google Docs & PDF",
        ],
        "highlights": [
            "Client onboarding questionnaire template",
            "Project proposal and contract templates",
            "Invoice and payment tracking system",
            "Works in Notion, Google Docs & PDF",
        ]
    },
    119: {  # The Healthy Habit Tracker
        "features": [
            "31-day habit tracking calendar",
            "Workout, water and sleep log",
            "Weekly meal planner template",
            "Monthly progress dashboard",
            "Mood and energy level tracker",
            "Printable and digital formats included",
        ],
        "highlights": [
            "31-day habit tracking calendar",
            "Workout, water and sleep log",
            "Weekly meal planner template",
            "Monthly progress dashboard",
        ]
    },
    120: {  # The Small Business Startup Workbook
        "features": [
            "Business model canvas template",
            "Market research and competitor analysis worksheet",
            "Startup financial projection planner",
            "Brand identity checklist",
            "Launch roadmap with milestone tracker",
            "Editable in Notion, Word & Google Docs",
        ],
        "highlights": [
            "Business model canvas template",
            "Market research and competitor analysis worksheet",
            "Startup financial projection planner",
            "Editable in Notion, Word & Google Docs",
        ]
    },
}

def main():
    session = SessionLocal()
    try:
        updated = 0
        for pid, data in PRODUCT_FEATURES.items():
            p = session.query(Product).filter(Product.id == pid).first()
            if not p:
                print(f"[skip] ID={pid} not found in SQLite")
                continue

            current_features = p.features if isinstance(p.features, list) else []
            if current_features:
                print(f"[skip] ID={pid} '{p.title}' already has features: {current_features}")
                continue

            p.features = data["features"]
            p.highlights = data["highlights"]
            updated += 1
            print(f"[set]  ID={pid} '{p.title}' ? {len(data['features'])} features added")

        if updated > 0:
            session.commit()
            print(f"\n[ok] SQLite updated: {updated} products\n")

            # Re-sync to Firestore
            print("[sync] Syncing updated products to Firestore...")
            session.expire_all()
            for pid in PRODUCT_FEATURES:
                p = session.query(Product).filter(Product.id == pid).first()
                if p and p.features:
                    try:
                        sync_product_to_firestore(p)
                        print(f"  ? ID={pid} '{p.title}' synced - features={p.features}")
                    except Exception as e:
                        print(f"  ? ID={pid} sync error: {e}")
        else:
            print("[ok] Nothing to update - all products already have features.")

    finally:
        session.close()

if __name__ == "__main__":
    main()
