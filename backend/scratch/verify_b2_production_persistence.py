import sys
import os
import json
import hashlib
from pathlib import Path

# Add project root and backend to python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)

from app.db.database import SessionLocal
from app.models.product import Product
from app.services.product_service import ProductService
from app.services.storage_service import storage_service

def verify_production_persistence():
    print("=" * 100)
    print("PRODUCTION-GRADE PRODUCT & ASSET PERSISTENCE VERIFICATION")
    print("=" * 100)

    # 1. Verify Active Provider
    print("\n[STEP 1 — STORAGE PROVIDER VERIFICATION]")
    print(f"Active Provider Class: {type(storage_service.provider).__name__}")
    print(f"B2 Bucket Name: {storage_service.b2_provider.bucket_name}")
    print(f"B2 Authorized? {storage_service.b2_provider.is_available()}")

    if not storage_service.b2_provider.is_available():
        print("❌ Backblaze B2 is not authorized! Please check environment credentials.")
        sys.exit(1)

    # 2. Stage test PDF binary file
    pdf_bytes = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
        b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n"
        b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF\n"
    )

    print("\n[STEP 2 — STAGING & UPLOADING TEST PDF TO BACKBLAZE B2]")
    upload_res = storage_service.upload(
        file_bytes=pdf_bytes,
        filename="TestPlanner.pdf",
        content_type="application/pdf",
        vendor_id="lumora-vendor-prod",
        is_image=False
    )

    temp_storage_path = upload_res["storage_path"]
    temp_url = upload_res["url"]
    print(f"Temp Storage Path: {temp_storage_path}")
    print(f"Temp B2 URL: {temp_url}")

    # 3. Create Product via ProductService (moves temp file to permanent B2 path)
    print("\n[STEP 3 — EXECUTING TRANSACTION: POSTGRESQL + B2 PERMANENT MOVE + FIRESTORE SYNC]")
    db = SessionLocal()

    test_product = ProductService.create_product(
        db=db,
        vendor_id="lumora-vendor-prod",
        title="Production Persistence Guide",
        description="Comprehensive production-grade architecture blueprint and deployment guide.",
        category="Ebooks & Guides",
        price=49.99,
        temp_file_url=temp_url,
        tags=["persistence", "production", "pdf"],
        highlights=["B2 Binary Storage", "PostgreSQL SSOT", "Firestore Mirror"],
        seller="Lumora Engineering",
        status="published"
    )

    prod_id = test_product.id
    perm_storage_path = test_product.storage_path
    perm_file_url = test_product.file_url

    print(f"Product Created ID: {prod_id}")
    print(f"Permanent storage_path: {perm_storage_path}")
    print(f"Permanent file_url:     {perm_file_url}")

    # 4. Verify B2 Object Existence & Binary Integrity
    print("\n[STEP 4 — VERIFYING BACKBLAZE B2 PERMANENT OBJECT]")
    b2_exists = storage_service.exists(perm_storage_path)
    print(f"B2 Object Exists? {b2_exists}")
    assert b2_exists, "B2 permanent object does not exist!"

    # Retrieve stream from B2
    stream_chunks = list(storage_service.get_stream(perm_storage_path))
    retrieved_bytes = b"".join(stream_chunks)
    retrieved_size = len(retrieved_bytes)
    first_4 = retrieved_bytes[:4]
    sha256_hash = hashlib.sha256(retrieved_bytes).hexdigest()

    print(f"Retrieved Size: {retrieved_size} bytes (Expected: {len(pdf_bytes)})")
    print(f"Retrieved Magic Bytes: {first_4} (Hex: {' '.join(f'{b:02X}' for b in first_4)})")
    print(f"SHA-256 Checksum: {sha256_hash}")

    assert first_4 == b"%PDF", "Magic bytes mismatch! Not a PDF."
    assert retrieved_size == len(pdf_bytes), "File size mismatch!"

    # 5. Verify Database Record Persistence
    print("\n[STEP 5 — VERIFYING POSTGRESQL DATABASE RECORD]")
    db.close()
    db2 = SessionLocal()
    fetched_prod = db2.query(Product).filter(Product.id == prod_id).first()

    assert fetched_prod is not None, "Product record not found in DB!"
    print(f"DB Record ID:           {fetched_prod.id}")
    print(f"DB Record Title:        {fetched_prod.title}")
    print(f"DB Record storage_path: {fetched_prod.storage_path}")
    print(f"DB Record file_url:     {fetched_prod.file_url}")
    print(f"DB Record Created At:   {fetched_prod.created_at}")

    # 6. Summary Report
    print("\n" + "=" * 100)
    print("ALL PRODUCTION PERSISTENCE CHECKS PASSED OK!")
    print("=" * 100)
    db2.close()

if __name__ == "__main__":
    verify_production_persistence()
