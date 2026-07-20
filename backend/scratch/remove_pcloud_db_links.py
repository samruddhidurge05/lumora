import os
import sys
from sqlalchemy import text

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.session import SessionLocal
from app.models.product import Product
from admin.firestore.admin_firestore import sync_product_to_firestore

def clean_pcloud_from_database():
    print("=== REMOVING ALL PCLOUD LINKS FROM DATABASE ===")
    
    db = SessionLocal()
    try:
        products = db.query(Product).all()
        cleaned_count = 0
        
        for p in products:
            modified = False
            
            # 1. Clear pcloud_download_link
            if p.pcloud_download_link:
                print(f"Product ID {p.id} ('{p.title}'): Clearing pcloud_download_link = '{p.pcloud_download_link}'")
                p.pcloud_download_link = None
                modified = True

            # 2. Check file_url for pcloud
            if p.file_url and ("pcloud" in p.file_url or "publink" in p.file_url or "filedn" in p.file_url):
                print(f"Product ID {p.id} ('{p.title}'): Clearing file_url = '{p.file_url}'")
                p.file_url = None
                modified = True

            # 3. Check thumbnail
            if p.thumbnail and ("pcloud" in p.thumbnail or "publink" in p.thumbnail or "filedn" in p.thumbnail):
                print(f"Product ID {p.id} ('{p.title}'): Clearing thumbnail = '{p.thumbnail}'")
                p.thumbnail = None
                modified = True

            # 4. Check preview
            if p.preview and ("pcloud" in p.preview or "publink" in p.preview or "filedn" in p.preview):
                print(f"Product ID {p.id} ('{p.title}'): Clearing preview = '{p.preview}'")
                p.preview = None
                modified = True

            # 5. Check storage_path
            if p.storage_path and ("pcloud" in p.storage_path):
                print(f"Product ID {p.id} ('{p.title}'): Clearing storage_path = '{p.storage_path}'")
                p.storage_path = None
                modified = True

            # 6. Check image_urls list
            if p.image_urls and isinstance(p.image_urls, list):
                new_image_urls = [u for u in p.image_urls if not (isinstance(u, str) and ("pcloud" in u or "publink" in u or "filedn" in u))]
                if len(new_image_urls) != len(p.image_urls):
                    print(f"Product ID {p.id} ('{p.title}'): Filtered image_urls")
                    p.image_urls = new_image_urls
                    modified = True

            # 7. Check preview_images list
            if p.preview_images and isinstance(p.preview_images, list):
                new_preview_images = [u for u in p.preview_images if not (isinstance(u, str) and ("pcloud" in u or "publink" in u or "filedn" in u))]
                if len(new_preview_images) != len(p.preview_images):
                    print(f"Product ID {p.id} ('{p.title}'): Filtered preview_images")
                    p.preview_images = new_preview_images
                    modified = True

            if modified:
                cleaned_count += 1
                db.commit()
                # Sync updated product record to Firestore
                try:
                    sync_product_to_firestore(p)
                    print(f"  Synced product ID {p.id} to Firestore.")
                except Exception as e:
                    print(f"  Firestore sync notice: {e}")

        print(f"\nSuccessfully cleaned pCloud links from {cleaned_count} products in SQLite and Firestore.")

    finally:
        db.close()

if __name__ == "__main__":
    clean_pcloud_from_database()
