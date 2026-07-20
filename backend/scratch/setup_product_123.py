import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.session import SessionLocal
from app.models.product import Product
from admin.firestore.admin_firestore import sync_product_to_firestore

def setup_product_123():
    print("=================================================================")
    print("             SETTING UP PRODUCT ID 123 WITH B2 PATHS            ")
    print("=================================================================")

    db = SessionLocal()
    try:
        p123 = db.query(Product).filter(Product.id == 123).first()
        if not p123:
            print("[SQLite] Creating Product 123 record in SQLite...")
            p123 = Product(
                id=123,
                title="Study Planner & Exam Organizer",
                description="Comprehensive digital study planner, exam preparation schedule, and productivity dashboard.",
                short_desc="Digital study planner and exam organizer.",
                price=29.99,
                category="Templates",
                version="v1.0.0",
                file_size="48 MB",
                rating=5.0,
                reviews=12,
                downloads=0,
                status="published",
                visibility="public",
                vendor_id="1",
                seller="Lumora Store",
                storage_path="b2://lumora-products/private/products/123/484a8a96-105f-4f9b-9b2a-880f25f1b6e9.zip",
                file_url="https://f005.backblazeb2.com/file/lumora-products/private/products/123/484a8a96-105f-4f9b-9b2a-880f25f1b6e9.zip",
                thumbnail_path="b2://lumora-products/public/products/123/thumbnail/a531a1b7-ab77-4d1c-bd89-cef96d8b78a4.png",
                preview_path="b2://lumora-products/public/products/123/previews/c534558b-4e88-45cc-b20f-04a0eec0c99e.png",
                thumbnail="https://f005.backblazeb2.com/file/lumora-products/public/products/123/thumbnail/a531a1b7-ab77-4d1c-bd89-cef96d8b78a4.png",
                preview="https://f005.backblazeb2.com/file/lumora-products/public/products/123/previews/c534558b-4e88-45cc-b20f-04a0eec0c99e.png",
                pcloud_download_link=None,
                image_urls=["https://f005.backblazeb2.com/file/lumora-products/public/products/123/previews/c534558b-4e88-45cc-b20f-04a0eec0c99e.png"],
                preview_images=["https://f005.backblazeb2.com/file/lumora-products/public/products/123/previews/c534558b-4e88-45cc-b20f-04a0eec0c99e.png"]
            )
            db.add(p123)
        else:
            print("[SQLite] Updating existing Product 123 record with B2 storage structure...")
            p123.title = "Study Planner & Exam Organizer"
            p123.storage_path = "b2://lumora-products/private/products/123/484a8a96-105f-4f9b-9b2a-880f25f1b6e9.zip"
            p123.file_url = "https://f005.backblazeb2.com/file/lumora-products/private/products/123/484a8a96-105f-4f9b-9b2a-880f25f1b6e9.zip"
            p123.thumbnail_path = "b2://lumora-products/public/products/123/thumbnail/a531a1b7-ab77-4d1c-bd89-cef96d8b78a4.png"
            p123.preview_path = "b2://lumora-products/public/products/123/previews/c534558b-4e88-45cc-b20f-04a0eec0c99e.png"
            p123.thumbnail = "https://f005.backblazeb2.com/file/lumora-products/public/products/123/thumbnail/a531a1b7-ab77-4d1c-bd89-cef96d8b78a4.png"
            p123.preview = "https://f005.backblazeb2.com/file/lumora-products/public/products/123/previews/c534558b-4e88-45cc-b20f-04a0eec0c99e.png"
            p123.pcloud_download_link = None

        db.commit()
        db.refresh(p123)
        print("[SQLite] Successfully saved Product 123 to SQLite.")

        # Sync to Firestore
        try:
            sync_product_to_firestore(p123)
            print("[Firestore] Successfully synced Product 123 to Cloud Firestore.")
        except Exception as e:
            print(f"[Firestore Notice] {e}")

    finally:
        db.close()

if __name__ == "__main__":
    setup_product_123()
