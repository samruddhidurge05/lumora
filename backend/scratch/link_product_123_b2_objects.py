import os
import sys
from dotenv import load_dotenv

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

from app.db.session import SessionLocal
from app.models.product import Product
from app.services.storage_service import storage_service
from admin.firestore.admin_firestore import sync_product_to_firestore

def link_b2_objects_to_product_123():
    print("=================================================================")
    print("      LINKING REAL BACKBLAZE B2 OBJECTS TO PRODUCT ID 123        ")
    print("=================================================================")

    # Actual files present in vendor 1 temp directory on B2:
    src_zip = "b2://lumora-products/vendors/1/temp/89447a30-9323-4c14-9b39-31a2b7d19809.zip"
    src_thumb = "b2://lumora-products/vendors/1/temp/1f1c5533-912e-462d-8cdd-1e52f987c85b.png"
    src_preview = "b2://lumora-products/vendors/1/temp/bbcd623c-0640-4163-9ae8-e97fc7afeb5e.png"

    # Move private product zip to permanent B2 structure: private/products/123/
    zip_target_path, zip_new_url = storage_service.move_to_permanent(
        source_path=src_zip,
        vendor_id="1",
        product_id=123,
        filename="product-123.zip",
        is_image=False,
        asset_type="file"
    )
    print(f"[B2 Move] Private File: {zip_target_path}")
    print(f"         URL:          {zip_new_url}")

    # Move public thumbnail to permanent B2 structure: public/products/123/thumbnail/
    thumb_target_path, thumb_new_url = storage_service.move_to_permanent(
        source_path=src_thumb,
        vendor_id="1",
        product_id=123,
        filename="thumbnail.png",
        is_image=True,
        asset_type="thumbnail"
    )
    print(f"[B2 Move] Public Thumbnail: {thumb_target_path}")
    print(f"         URL:               {thumb_new_url}")

    # Move public preview to permanent B2 structure: public/products/123/previews/
    preview_target_path, preview_new_url = storage_service.move_to_permanent(
        source_path=src_preview,
        vendor_id="1",
        product_id=123,
        filename="preview.png",
        is_image=True,
        asset_type="preview"
    )
    print(f"[B2 Move] Public Preview: {preview_target_path}")
    print(f"         URL:              {preview_new_url}")

    # Update Product 123 in SQLite & Firestore
    db = SessionLocal()
    try:
        p123 = db.query(Product).filter(Product.id == 123).first()
        if not p123:
            p123 = Product(id=123, title="Study Planner & Exam Organizer", price=29.99, status="published", vendor_id="1")
            db.add(p123)

        p123.title = "Study Planner & Exam Organizer"
        p123.status = "published"
        p123.visibility = "public"
        p123.price = 29.99
        p123.category = "Templates"
        p123.vendor_id = "1"
        p123.seller = "Lumora Store"
        
        # Assign real B2 storage paths and URLs
        p123.storage_path = zip_target_path
        p123.file_url = zip_new_url
        p123.thumbnail_path = thumb_target_path
        p123.thumbnail = thumb_new_url
        p123.preview_path = preview_target_path
        p123.preview = preview_new_url
        p123.image_urls = [preview_new_url]
        p123.preview_images = [preview_new_url]
        p123.pcloud_download_link = None

        db.commit()
        db.refresh(p123)

        print("\n[SQLite] Product ID 123 updated with real B2 objects:")
        print(f"  storage_path: {p123.storage_path}")
        print(f"  file_url:     {p123.file_url}")
        print(f"  thumbnail:    {p123.thumbnail}")
        print(f"  preview:      {p123.preview}")

        # Sync to Cloud Firestore
        try:
            sync_product_to_firestore(p123)
            print("[Firestore] Product 123 synced to Cloud Firestore with real B2 objects.")
        except Exception as e:
            print(f"[Firestore Notice] {e}")

    finally:
        db.close()

if __name__ == "__main__":
    link_b2_objects_to_product_123()
