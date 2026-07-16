"""
sync_firestore_to_sqlite.py
============================
Run this manually anytime your co-worker adds a new product via the admin panel.
The backend already does this automatically on startup, but you can also trigger
it manually at any time with:

    cd backend
    python scripts/sync_firestore_to_sqlite.py

What it does:
  - Finds all published products in Firestore that are not yet in SQLite
  - Imports them into SQLite with proper field mapping
  - Refreshes any broken localhost thumbnail URLs from pCloud
  - Reports how many products were added
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from admin.firestore.admin_firestore import restore_sqlite_products_from_firestore


def main():
    print("=" * 55)
    print("  Lumora: Firestore → SQLite Product Sync")
    print("=" * 55)

    db = SessionLocal()
    try:
        restore_sqlite_products_from_firestore(db)
        print("\nSync complete! Restart the backend server to serve new products.")
    except Exception as e:
        print(f"\nSync failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
