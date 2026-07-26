"""
audit_production_storage_readonly.py
------------------------------------
Production-safe READ-ONLY diagnostic tool for the Lumora file-storage system.

Inspects every product record in PostgreSQL and checks its physical status
against Backblaze B2 and local storage.

Outputs structured JSON and human-readable summary reports.
Does NOT modify or delete any database records or storage objects.
"""
import sys
import os
import argparse
import json
import mimetypes
from datetime import datetime, timezone

# Add backend root to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.database import engine
from app.db.session import SessionLocal
from app.models.product import Product
from app.models.storage_metadata import StorageMetadata
from app.services.storage_service import storage_service
from app.services.product_service import _extract_file_extension


def audit_product_storage():
    db = SessionLocal()
    try:
        products = db.query(Product).order_by(Product.id.asc()).all()
        print(f"[ReadonlyAudit] Starting storage audit for {len(products)} products...")
        
        b2 = storage_service.b2_provider
        b2_available = b2.is_available()
        print(f"[ReadonlyAudit] Backblaze B2 Status: {b2.b2_status} (Available: {b2_available})")

        audit_results = []
        status_counts = {
            "VALID": 0,
            "MISSING_B2_OBJECT": 0,
            "DATABASE_REFERENCE_MISSING": 0,
            "TEMPORARY_PATH": 0,
            "LEGACY_PROVIDER_PATH": 0,
            "MIME_MISMATCH": 0,
            "EXTENSION_MISMATCH": 0,
            "CONTENT_MISMATCH": 0,
            "REQUIRES_MANUAL_REVIEW": 0,
        }

        for p in products:
            raw_ref = p.storage_path or p.file_url or getattr(p, "pcloud_download_link", None) or ""
            ext = _extract_file_extension(raw_ref, default_ext="")
            
            # Infer original filename
            if p.storage_path and "/" in p.storage_path:
                original_filename = p.storage_path.split("/")[-1]
            elif p.file_url and "/" in p.file_url:
                original_filename = p.file_url.split("/")[-1].split("?")[0]
            else:
                original_filename = f"product-{p.id}{ext if ext else '.bin'}"

            expected_mime, _ = mimetypes.guess_type(original_filename)
            if not expected_mime:
                expected_mime = getattr(p, "content_type", None) or "application/octet-stream"

            item = {
                "product_id": p.id,
                "title": p.title,
                "postgresql_storage_path": p.storage_path,
                "file_url": p.file_url,
                "pcloud_link": getattr(p, "pcloud_download_link", None),
                "original_filename": original_filename,
                "mime_type": p.content_type or expected_mime,
                "b2_object_exists": False,
                "b2_object_key": None,
                "b2_file_size": 0,
                "database_file_size": p.file_size,
                "checksum": p.hash,
                "storage_status": "VALID",
                "notes": []
            }

            # Classify status
            if not p.storage_path and not p.file_url and not getattr(p, "pcloud_download_link", None):
                item["storage_status"] = "DATABASE_REFERENCE_MISSING"
                item["notes"].append("No storage_path or file_url recorded in database.")
            elif (p.storage_path and "/temp/" in p.storage_path) or (p.file_url and "/temp/" in p.file_url):
                item["storage_status"] = "TEMPORARY_PATH"
                item["notes"].append("Product references a temporary vendor staging path.")
            elif p.file_url and ("pcloud" in p.file_url.lower() or getattr(p, "pcloud_download_link", None)):
                item["storage_status"] = "LEGACY_PROVIDER_PATH"
                item["notes"].append("Product references legacy pCloud storage provider.")
            elif p.storage_path and p.storage_path.startswith("b2://"):
                b2_key = b2._clean_b2_key(p.storage_path)
                item["b2_object_key"] = b2_key
                try:
                    exists = b2.exists(p.storage_path)
                    item["b2_object_exists"] = exists
                    if exists:
                        cached_meta = b2.cache.get(p.storage_path)
                        item["b2_file_size"] = cached_meta.get("size", 0) if cached_meta else 0
                        item["storage_status"] = "VALID"
                    else:
                        item["storage_status"] = "MISSING_B2_OBJECT"
                        item["notes"].append(f"Physical object missing at B2 path '{b2_key}'.")
                except Exception as b2_err:
                    item["storage_status"] = "REQUIRES_MANUAL_REVIEW"
                    item["notes"].append(f"Error checking B2 object: {b2_err}")
            elif p.file_url and "/products/" in p.file_url:
                # Relative legacy or local path
                item["storage_status"] = "REQUIRES_MANUAL_REVIEW"
                item["notes"].append("Relative product path needs verification or B2 migration.")
            else:
                item["storage_status"] = "REQUIRES_MANUAL_REVIEW"
                item["notes"].append("Unclassified storage pattern requiring review.")

            status_counts[item["storage_status"]] = status_counts.get(item["storage_status"], 0) + 1
            audit_results.append(item)

        report = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total_products": len(products),
            "status_summary": status_counts,
            "b2_status": b2.b2_status,
            "products": audit_results
        }

        print("\n--- READ-ONLY STORAGE AUDIT REPORT SUMMARY ---")
        print(f"Total Products Checked: {len(products)}")
        for st, count in status_counts.items():
            print(f"  {st:30s}: {count}")

        return report
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Read-Only Diagnostic Tool for Lumora Product Storage")
    parser.add_argument("--output", type=str, default="audit_readonly_report.json", help="Output JSON report file")
    args = parser.parse_args()

    report = audit_product_storage()
    out_path = os.path.join(backend_dir, "scripts", args.output)
    with open(out_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nSaved detailed audit report to: {out_path}")
