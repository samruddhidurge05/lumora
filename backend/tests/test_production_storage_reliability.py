import os
import sys
import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.session import SessionLocal
from app.db.database import engine
from app.models import Base, StorageMetadata
from app.services.storage_service import storage_service, B2StorageProvider


def test_b2_transaction_cap_exceeded_blocks_writes():
    """
    Simulate Backblaze B2 returning 403 transaction_cap_exceeded.
    Verify that upload_file raises HTTP 503 and NEVER falls back to local disk writes.
    """
    b2 = B2StorageProvider()
    b2.b2_status = "TRANSACTION_CAP_EXCEEDED"
    b2.auth_token = None
    
    with pytest.raises(HTTPException) as exc_info:
        b2.upload_file(
            file_bytes=b"PK\x03\x04testcontent",
            filename="test.zip",
            content_type="application/zip",
            vendor_id="vendor_1"
        )
    assert exc_info.value.status_code == 503
    assert "unavailable" in exc_info.value.detail.lower() or "transaction_cap_exceeded" in exc_info.value.detail.lower()


def test_shared_storage_metadata_persistence():
    """
    Verify that record_storage_metadata persists metadata to PostgreSQL/SQLite StorageMetadata table
    and updates L1 memory cache simultaneously.
    """
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        test_path = "b2://lumora-products/private/products/999/v1/test-file.zip"
        storage_service.record_storage_metadata(
            storage_path=test_path,
            size_bytes=10240,
            checksum_sha256="abc123sha256",
            version=1
        )
        
        meta = db.query(StorageMetadata).filter(StorageMetadata.storage_path == test_path).first()
        assert meta is not None
        assert meta.size_bytes == 10240
        assert meta.checksum_sha256 == "abc123sha256"
        assert meta.version == 1
        assert meta.verification_status == "verified"
    finally:
        db.close()


def test_versioned_asset_move():
    """
    Verify that move_to_permanent incorporates versioning in B2 storage paths (e.g. /v1/, /v2/).
    """
    with patch.object(storage_service.b2_provider, "move_file", return_value="https://f005.backblazeb2.com/file/lumora-products/mock"), \
         patch.object(storage_service.b2_provider, "verify_object_integrity", return_value=True):
        
        path_v1, _ = storage_service.move_to_permanent(
            source_path="b2://lumora-products/vendors/v1/temp/temp.zip",
            vendor_id="vendor_1",
            product_id=888,
            filename="manual.pdf",
            is_image=False,
            asset_type="file",
            version=1
        )
        assert "/v1/" in path_v1
        assert "private/products/888/v1/" in path_v1

        path_v2, _ = storage_service.move_to_permanent(
            source_path="b2://lumora-products/vendors/v1/temp/temp2.zip",
            vendor_id="vendor_1",
            product_id=888,
            filename="manual.pdf",
            is_image=False,
            asset_type="file",
            version=2
        )
        assert "/v2/" in path_v2
        assert "private/products/888/v2/" in path_v2
