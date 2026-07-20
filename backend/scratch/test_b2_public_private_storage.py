import os
import sys
import uuid
from sqlalchemy.orm import Session

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.storage_service import storage_service
from app.services.product_service import ProductService
from app.api.products_router import resolve_media_url
from app.db.session import SessionLocal
from app.models.product import Product

def run_tests():
    print("=== STARTING PUBLIC + PRIVATE B2 STORAGE TESTS ===")
    
    # Test 1: Storage Path Key Generation
    fake_bucket = "lumora-products"
    fake_temp_thumb = f"b2://{fake_bucket}/vendors/vendor1/temp/{uuid.uuid4()}.png"
    fake_temp_preview = f"b2://{fake_bucket}/vendors/vendor1/temp/{uuid.uuid4()}.png"
    fake_temp_file = f"b2://{fake_bucket}/vendors/vendor1/temp/{uuid.uuid4()}.zip"
    
    print("\n--- Test 1: Testing move_to_permanent Object Key Layout ---")
    thumb_path, _ = storage_service.move_to_permanent(
        source_path=fake_temp_thumb,
        vendor_id="vendor1",
        product_id=9999,
        filename="../../../malicious_thumb.png",
        is_image=True,
        asset_type="thumbnail"
    )
    print(f"Thumbnail Target Path: {thumb_path}")
    assert f"public/products/9999/thumbnail/" in thumb_path, "Thumbnail path missing public/products/9999/thumbnail/"
    assert ".." not in thumb_path.split("thumbnail/")[1], "Path traversal detected in thumbnail filename!"
    
    preview_path, _ = storage_service.move_to_permanent(
        source_path=fake_temp_preview,
        vendor_id="vendor1",
        product_id=9999,
        filename="cover..image.png",
        is_image=True,
        asset_type="preview"
    )
    print(f"Preview Target Path:   {preview_path}")
    assert f"public/products/9999/previews/" in preview_path, "Preview path missing public/products/9999/previews/"
    
    file_path, _ = storage_service.move_to_permanent(
        source_path=fake_temp_file,
        vendor_id="vendor1",
        product_id=9999,
        filename="package.zip",
        is_image=False,
        asset_type="file"
    )
    print(f"Private File Path:     {file_path}")
    assert f"private/products/9999/" in file_path, "Private file path missing private/products/9999/"
    
    print("[OK] Test 1 Passed: Public/Private folder hierarchy & filename sanitization verified!")
    
    # Test 2: URL Resolution & Access Control
    print("\n--- Test 2: Testing URL Resolution for Public vs Private Assets ---")
    public_resolved = resolve_media_url(thumb_path)
    print(f"Public Asset Resolved URL:  {public_resolved}")
    assert public_resolved.startswith("http"), "Public asset should resolve to an absolute public HTTP/CDN URL"
    assert "/file/lumora-products/public/products/9999/thumbnail/" in public_resolved
    
    private_resolved = resolve_media_url(file_path)
    print(f"Private Asset Resolved URL: {private_resolved}")
    assert private_resolved.startswith("b2://"), "Private asset MUST NOT resolve to an unauthenticated public HTTP URL!"
    assert private_resolved == file_path, "Private asset path must remain protected as b2://..."
    
    print("[OK] Test 2 Passed: Public assets resolve to CDN URLs; Private assets remain protected!")
    
    # Test 3: Database Product Creation & Media Resolution
    print("\n--- Test 3: DB Integration & Product Creation ---")
    db: Session = SessionLocal()
    try:
        # Create test product shell
        product = ProductService.create_product(
            db=db,
            vendor_id="vendor_test_b2",
            title="B2 Test Product",
            description="Test description",
            category="Templates",
            price=29.99,
            temp_file_url=fake_temp_file,
            temp_preview_url=fake_temp_preview,
            temp_thumbnail_url=fake_temp_thumb
        )
        print(f"Created Test Product ID: {product.id}")
        print(f"DB Product Storage Path: {product.storage_path}")
        print(f"DB Product Thumbnail Path: {product.thumbnail_path}")
        print(f"DB Product Preview Path:   {product.preview_path}")
        
        assert "private/products/" in product.storage_path
        assert "public/products/" in product.thumbnail_path
        assert "public/products/" in product.preview_path
        
        # Cleanup test DB product
        db.delete(product)
        db.commit()
        print("[OK] Test 3 Passed: DB Product Creation correctly assigns public/private paths!")
    finally:
        db.close()
        
    print("\n=== ALL B2 PUBLIC + PRIVATE STORAGE TESTS PASSED SUCCESSFULLY ===")

if __name__ == "__main__":
    run_tests()
