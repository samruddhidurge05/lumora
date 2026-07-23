import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.product_service import _extract_file_extension
from app.services.storage_service import storage_service

def run_tests():
    print("=" * 80)
    print("TESTING PRODUCT FILE EXTENSION PRESERVATION PIPELINE")
    print("=" * 80)

    # 1. Test Extension Extraction Helper
    test_cases = [
        ("uploads/vendors/1/temp/sample_document.pdf", ".pdf"),
        ("uploads/vendors/1/temp/archive_package.zip", ".zip"),
        ("uploads/vendors/1/temp/report_draft.docx", ".docx"),
        ("uploads/vendors/1/temp/spreadsheet.xlsx", ".xlsx"),
        ("uploads/vendors/1/temp/presentation.pptx", ".pptx"),
        ("uploads/vendors/1/temp/video_preview.mp4", ".mp4"),
        ("uploads/vendors/1/temp/raw_asset_no_ext", ".bin"),
        ("uploads/vendors/1/temp/path_traversal/../bad", ".bin"),
    ]

    print("\n[Step 1] Unit Testing _extract_file_extension():")
    all_passed = True
    for input_path, expected_ext in test_cases:
        res_ext = _extract_file_extension(input_path, default_ext=".bin")
        match = (res_ext == expected_ext)
        print(f"  Input: '{input_path}' => Extracted: '{res_ext}' (Expected: '{expected_ext}') [{'PASS' if match else 'FAIL'}]")
        if not match:
            all_passed = False

    if not all_passed:
        print("\n❌ Helper unit tests failed!")
        sys.exit(1)

    print("\n[Step 2] Testing Storage Path Generation with Preserved Extension:")
    sample_types = [
        ("PDF", "document.pdf", ".pdf", b"%PDF-1.4\n%test\n"),
        ("ZIP", "package.zip", ".zip", b"PK\x03\x04\x0a\x00\x00\x00"),
        ("DOCX", "report.docx", ".docx", b"PK\x03\x04\x14\x00\x06\x00"),
    ]

    for name, sample_file, expected_ext, magic_bytes in sample_types:
        # Simulate temp upload path
        temp_url = f"/uploads/vendors/test-vendor/temp/12345{expected_ext}"
        extracted_ext = _extract_file_extension(temp_url, default_ext=".bin")

        # Test move_to_permanent simulation
        storage_path, perm_url = storage_service.move_to_permanent(
            source_path=temp_url,
            vendor_id="test-vendor",
            product_id=9999,
            filename=f"product-9999{extracted_ext}",
            is_image=False,
            asset_type="file"
        )

        perm_ext = os.path.splitext(perm_url)[1]
        print(f"\n  Format: {name}")
        print(f"    Original File: {sample_file}")
        print(f"    Temp URL Ext:  {extracted_ext}")
        print(f"    Perm URL:      {perm_url}")
        print(f"    Perm Ext:      {perm_ext}")
        print(f"    Magic Bytes:   {magic_bytes[:4]} (Hex: {' '.join(f'{b:02X}' for b in magic_bytes[:4])})")

        assert perm_ext == expected_ext, f"Extension mismatch! Expected {expected_ext}, got {perm_ext}"

    print("\n" + "=" * 80)
    print("ALL UPLOAD PIPELINE EXTENSION TESTS PASSED OK!")
    print("=" * 80)

if __name__ == "__main__":
    run_tests()
