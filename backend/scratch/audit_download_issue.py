import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.session import SessionLocal
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.services.storage_service import storage_service
from app.api.products_router import resolve_media_url, is_pcloud_link_active

def audit_download_chain():
    print("=================================================================")
    print("       COMPREHENSIVE DOWNLOAD CHAIN AUDIT & DIAGNOSTIC           ")
    print("=================================================================")
    
    print(f"\n[StorageService] Active Provider Class: {storage_service.provider.__class__.__name__}")
    print(f"[StorageService] B2 Provider Available: {storage_service.b2_provider.is_available()}")
    print(f"[StorageService] B2 Key ID Present:     {bool(storage_service.b2_provider.key_id)}")
    print(f"[StorageService] B2 Bucket Name:        {storage_service.b2_provider.bucket_name}")
    print(f"[StorageService] B2 Download URL:       {storage_service.b2_provider.download_url}")
    print(f"[StorageService] STORAGE_PROVIDER env:  {os.getenv('STORAGE_PROVIDER')}")

    db = SessionLocal()
    try:
        products = db.query(Product).all()
        print(f"\n[Database] Total Products in SQLite: {len(products)}")
        
        for p in products:
            print(f"\n--- Product ID: {p.id} | Title: {p.title} ---")
            print(f"  file_url:             {p.file_url}")
            print(f"  storage_path:         {p.storage_path}")
            print(f"  thumbnail_path:       {p.thumbnail_path}")
            print(f"  preview_path:         {p.preview_path}")
            print(f"  pcloud_download_link: {p.pcloud_download_link}")
            
            # Determine path that download endpoint would use
            has_b2 = bool((p.storage_path and "b2://" in p.storage_path) or (p.file_url and "backblazeb2.com" in p.file_url))
            has_pcloud = is_pcloud_link_active(p.pcloud_download_link) and not has_b2
            
            print(f"  [Evaluation] has_b2={has_b2}, has_pcloud={has_pcloud}")
            
            if has_pcloud:
                print(f"  [Download Mode] EXTERNAL REDIRECT -> {p.pcloud_download_link}")
            else:
                effective_storage_path = p.storage_path or p.file_url or f"pcloud://uploads/products/{p.id}/product.zip"
                print(f"  [Download Mode] STREAMING -> Effective Storage Path: {effective_storage_path}")
                
                # Check resolved storage path scheme
                resolved_path = storage_service.resolve_storage_path_from_url(effective_storage_path)
                print(f"  [Resolved Storage Scheme Path] {resolved_path}")
                
                # Check if local file fallback triggers readme zip creation!
                if resolved_path.startswith("local://") or resolved_path.startswith("pcloud://"):
                    if isinstance(storage_service.provider, (type(storage_service.local_provider), type(storage_service.pcloud_provider))):
                        provider = storage_service.local_provider if resolved_path.startswith("local://") else storage_service.pcloud_provider
                        abs_disk_path = provider._get_absolute_path(resolved_path)
                        exists_on_disk = os.path.exists(abs_disk_path)
                        print(f"  [Disk Check] Absolute Path: {abs_disk_path}")
                        print(f"  [Disk Check] Exists on Disk? {exists_on_disk}")
                        if not exists_on_disk:
                            print(f"  ?? ALERT: Physical file MISSING on disk! Calling get_stream WILL GENERATE DUMMY README ZIP!")

        # Also check Orders to see what products customers have purchased
        print("\n=================================================================")
        print("                 COMPLETED CUSTOMER ORDERS                      ")
        print("=================================================================")
        orders = db.query(Order).filter(Order.status == "completed").all()
        print(f"Total Completed Orders: {len(orders)}")
        for o in orders:
            items = db.query(OrderItem).filter(OrderItem.order_id == o.id).all()
            print(f"Order #{o.id} (User ID {o.user_id}): {[item.product_id for item in items]}")

    finally:
        db.close()

if __name__ == "__main__":
    audit_download_chain()
