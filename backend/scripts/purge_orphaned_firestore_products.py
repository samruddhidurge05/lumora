import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# Explicitly load backend/.env FIRST
env_file = backend_dir / ".env"
if env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=str(env_file), override=True)

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.shared.firebase.connection import db as firestore_db, firebase_connected

def purge_orphaned_firestore_products():
    print("==========================================================")
    print("FIRESTORE ORPHAN PRODUCT CLEANUP & PARITY SYNC")
    print("==========================================================")
    
    db_url = os.getenv("DATABASE_URL")
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        # Fetch all active product IDs from Render PostgreSQL
        db_product_ids = {str(row[0]) for row in db.execute(text("SELECT id FROM products WHERE status NOT IN ('archived', 'deleted')")).fetchall()}
        print(f"Active Products in Render PostgreSQL: {len(db_product_ids)}")

        if not firebase_connected or firestore_db is None:
            print("ERROR: Firestore is not connected.")
            return

        # Fetch all Firestore product documents
        fs_docs = list(firestore_db.collection('products').stream())
        print(f"Total Products in Firestore collection: {len(fs_docs)}")

        orphaned = []
        for doc in fs_docs:
            if doc.id not in db_product_ids:
                orphaned.append(doc.id)

        print(f"\nIdentified {len(orphaned)} orphaned documents in Firestore (not present or active in PostgreSQL):")
        print(orphaned)

        if orphaned:
            print("\nPurging orphaned documents from Firestore...")
            purged_count = 0
            for doc_id in orphaned:
                try:
                    firestore_db.collection('products').document(doc_id).delete()
                    purged_count += 1
                except Exception as err:
                    print(f"Failed to delete Firestore doc '{doc_id}': {err}")

            print(f"Successfully purged {purged_count}/{len(orphaned)} orphaned products from Firestore.")
        else:
            print("\nFirestore is already in 100% parity with PostgreSQL!")

        # Final verification count
        final_fs_docs = list(firestore_db.collection('products').stream())
        print(f"\nFinal Firestore document count: {len(final_fs_docs)}")

    finally:
        db.close()

if __name__ == "__main__":
    purge_orphaned_firestore_products()
