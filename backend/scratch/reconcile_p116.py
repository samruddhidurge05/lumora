import sys
import os
import json
import hashlib

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import SessionLocal
from app.models.product import Product
from app.services.storage_service import storage_service

def reconcile_product_116():
    print("=" * 100)
    print("FINAL READ-ONLY RECONCILIATION AUDIT: PRODUCT ID 116")
    print("=" * 100)

    # 1. Fetch Product 116 from database SessionLocal
    db = SessionLocal()
    product = db.query(Product).filter(Product.id == 116).first()

    print("\n[STEP 1 — DATABASE RECORD]")
    if not product:
        print("Product 116 NOT FOUND in database!")
        return

    db_record = {
        "id": product.id,
        "title": product.title,
        "file_url": product.file_url,
        "storage_path": getattr(product, "storage_path", None),
        "pcloud_download_link": getattr(product, "pcloud_download_link", None),
        "created_at": str(product.created_at),
        "updated_at": str(product.updated_at),
    }
    print(json.dumps(db_record, indent=2))

    # 2. Trace Production Download Endpoint Logic
    print("\n[STEP 2 — EXACT PRODUCTION DOWNLOAD RESOLUTION]")
    # In products_router.py / download endpoint:
    # If pcloud_download_link exists, returns pCloud link.
    # Otherwise uses product.storage_path or product.file_url via storage_service
    target_path = product.storage_path or product.file_url
    print(f"Primary download target selected from DB: '{target_path}'")

    resolved_storage_path = storage_service.resolve_storage_path_from_url(target_path)
    print(f"Resolved Storage Path: '{resolved_storage_path}'")
    print(f"Active Storage Provider Type: {type(storage_service.provider).__name__}")

    # 3. Storage Existence & Header Analysis
    print("\n[STEP 3 & 4 — STORAGE OBJECT STATUS & BINARY ANALYSIS]")
    exists = storage_service.exists(resolved_storage_path)
    print(f"Object Exists via Storage Service? {exists}")

    abs_disk_path = None
    if resolved_storage_path.startswith("local://"):
        abs_disk_path = storage_service.local_provider._get_absolute_path(resolved_storage_path)
        print(f"Absolute Disk Path: '{abs_disk_path}'")
        print(f"Absolute Disk File Exists? {os.path.exists(abs_disk_path)}")

    actual_bytes = b""
    if abs_disk_path and os.path.exists(abs_disk_path):
        with open(abs_disk_path, "rb") as f:
            actual_bytes = f.read()
    else:
        try:
            stream = storage_service.get_stream(resolved_storage_path)
            chunks = []
            for chunk in stream:
                chunks.append(chunk)
            actual_bytes = b"".join(chunks)
        except Exception as e:
            print(f"Stream retrieval error: {e}")

    file_size = len(actual_bytes)
    sha256_hash = hashlib.sha256(actual_bytes).hexdigest() if actual_bytes else "N/A"
    first_4 = actual_bytes[:4]
    hex_4 = " ".join(f"{b:02X}" for b in first_4) if actual_bytes else "N/A"
    ascii_4 = "".join(chr(b) if 32 <= b <= 126 else "." for b in first_4) if actual_bytes else "N/A"

    print(f"Actual Downloaded Size: {file_size:,} bytes")
    print(f"SHA-256 Checksum: {sha256_hash}")
    print(f"First 4 Bytes (Hex): {hex_4}")
    print(f"First 4 Bytes (ASCII): {ascii_4}")
    print(f"Magic Signature Is %PDF? {first_4.startswith(b'%PDF')}")

    # 5. Reconciliation Output
    print("\n" + "=" * 100)
    print("RECONCILIATION FINDINGS SUMMARY")
    print("=" * 100)
    print(f"1. Current DB file_url:        {product.file_url}")
    print(f"2. Current DB storage_path:    {product.storage_path}")
    print(f"3. Exact Object Exists:        {exists}")
    print(f"4. Exact Byte Count:           {file_size} bytes (Expected: 219,726 bytes)")
    print(f"5. Magic Bytes:                {hex_magic if 'hex_magic' in locals() else hex_4} ({ascii_4})")
    print(f"6. Earlier PDF Still Exists:   {file_size == 219726 and first_4.startswith(b'%PDF')}")
    print("=" * 100)

if __name__ == "__main__":
    reconcile_product_116()
