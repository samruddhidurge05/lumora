import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.storage_service import storage_service
from app.api.products_router import resolve_media_url

def test_clean_b2_storage():
    print("=== TESTING STORAGE SERVICE WITHOUT PCLOUD ===")
    
    # 1. Ensure PCloudStorageProvider is gone from storage_service
    assert not hasattr(storage_service, "pcloud_provider"), "pcloud_provider should be removed from storage_service!"
    print("[Pass] pcloud_provider successfully removed from StorageService")
    
    # 2. Test B2 / Local path routing in move_to_permanent
    b2_src = "b2://lumora-products/temp/test_file.zip"
    target_path, new_url = storage_service.move_to_permanent(
        source_path=b2_src,
        vendor_id="vendor_1",
        product_id=500,
        filename="test_file.zip",
        is_image=False,
        asset_type="file"
    )
    print(f"[Pass] B2 Private File Move: target_path='{target_path}'")
    assert target_path.startswith("b2://lumora-products/private/products/500/")
    
    b2_img_src = "b2://lumora-products/temp/thumb.png"
    img_target_path, img_new_url = storage_service.move_to_permanent(
        source_path=b2_img_src,
        vendor_id="vendor_1",
        product_id=500,
        filename="thumb.png",
        is_image=True,
        asset_type="thumbnail"
    )
    print(f"[Pass] B2 Public Thumbnail Move: target_path='{img_target_path}'")
    assert img_target_path.startswith("b2://lumora-products/public/products/500/thumbnail/")
    
    # 3. Test resolve_media_url for public vs private B2 paths
    public_resolved = resolve_media_url(img_target_path)
    private_resolved = resolve_media_url(target_path)
    print(f"[Pass] Resolved Public B2 URL: {public_resolved}")
    print(f"[Pass] Resolved Private B2 URL: {private_resolved}")
    assert "public/products/500/thumbnail/" in public_resolved
    assert private_resolved == target_path  # Private path remains protected!

    print("=== ALL B2 STORAGE TESTS PASSED CLEANLY WITHOUT PCLOUD ===")

if __name__ == "__main__":
    test_clean_b2_storage()
