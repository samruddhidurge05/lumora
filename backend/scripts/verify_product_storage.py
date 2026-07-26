import sys
import os
from typing import Any, Dict

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.session import SessionLocal
from app.models.product import Product
from app.services.storage_service import storage_service
from app.shared.firebase.connection import db as fs_db, firebase_connected

def verify_product_storage(product_id: int) -> Dict[str, Any]:
    """
    Forensic read-only storage verification command for a given product ID.
    Performs physical B2 verification, PostgreSQL check, path security checks,
    and Firestore mirror status check.
    """
    db_session = SessionLocal()
    report: Dict[str, Any] = {
        "product_id": product_id,
        "postgresql_exists": False,
        "storage_path": None,
        "file_url": None,
        "b2_physical_exists": False,
        "b2_reference_match": False,
        "temp_path_detected": False,
        "pcloud_path_detected": False,
        "firestore_mirror": "UNKNOWN",
        "status": "NOT SAFE"
    }

    try:
        product = db_session.query(Product).filter(Product.id == product_id).first()
        if not product:
            print(f"\n[verify_product_storage] Product ID {product_id} NOT FOUND in PostgreSQL.")
            return report

        report["postgresql_exists"] = True
        report["storage_path"] = product.storage_path
        report["file_url"] = product.file_url

        # Check for temporary or pcloud references
        sp_str = str(product.storage_path or "")
        fu_str = str(product.file_url or "")

        if "/temp/" in sp_str or "/temp/" in fu_str or "temp/" in sp_str or "temp/" in fu_str:
            report["temp_path_detected"] = True

        if "pcloud" in sp_str.lower() or "pcloud" in fu_str.lower():
            report["pcloud_path_detected"] = True

        # Physical Backblaze B2 Object Verification
        if product.storage_path:
            b2 = storage_service.b2_provider
            b2_exists = b2.exists(product.storage_path)
            report["b2_physical_exists"] = b2_exists
            if b2_exists and (product.storage_path.startswith("b2://") or "products/" in product.storage_path):
                report["b2_reference_match"] = True

        # Firestore mirror check
        if firebase_connected and fs_db is not None:
            try:
                fs_doc = fs_db.collection("products").document(str(product_id)).get()
                if fs_doc.exists:
                    report["firestore_mirror"] = "PASS"
                else:
                    report["firestore_mirror"] = "MISSING_MIRROR"
            except Exception as fs_err:
                report["firestore_mirror"] = f"WARN ({fs_err})"

        # Overall Status
        if (
            report["postgresql_exists"] and
            report["b2_physical_exists"] and
            not report["temp_path_detected"] and
            not report["pcloud_path_detected"]
        ):
            report["status"] = "SAFE"
        else:
            report["status"] = "NOT SAFE"

    finally:
        db_session.close()

    print("\nPRODUCT STORAGE STATUS")
    print("======================")
    print(f"Product ID:         {product_id}")
    print(f"PostgreSQL:        {'PASS' if report['postgresql_exists'] else 'FAIL'}")
    print(f"Permanent B2 file: {'PASS' if report['b2_physical_exists'] else 'FAIL'}")
    print(f"B2 reference match:{'PASS' if report['b2_reference_match'] else 'FAIL'}")
    print(f"Temporary path:    {'FAIL (TEMP DETECTED)' if report['temp_path_detected'] else 'PASS'}")
    print(f"pCloud reference:  {'FAIL (PCLOUD DETECTED)' if report['pcloud_path_detected'] else 'PASS'}")
    print(f"Firestore mirror:  {report['firestore_mirror']}")
    print(f"PERMANENCE STATUS: {report['status']}\n")

    return report

if __name__ == "__main__":
    target_id = 128
    if len(sys.argv) > 1:
        try:
            target_id = int(sys.argv[1])
        except ValueError:
            pass
    verify_product_storage(target_id)
