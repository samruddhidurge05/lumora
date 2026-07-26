"""
test_production_storage_repair.py
----------------------------------
Comprehensive production storage data-integrity test suite for Lumora.
Tests PDF, ZIP, DOCX formats, backend restarts, Firestore 429 quota failures,
B2 401 token expiration, B2 403 transaction caps, and invalid upload rejections.
"""
import io
import os
import sys
import zipfile
import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

from app.db.session import SessionLocal
from app.models.product import Product
from app.models.user import User
from app.services.product_service import ProductService
from app.services.storage_service import storage_service, B2StorageProvider


# Helper: Valid minimal binary sample bytes
def _create_sample_pdf() -> bytes:
    return b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF"


def _create_sample_zip() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("test_document.txt", "Lumora Production Storage Test Payload Content")
    return buffer.getvalue()


def _create_sample_docx() -> bytes:
    # A valid DOCX is a PK Zip archive containing [Content_Types].xml
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>')
        zf.writestr("word/document.xml", '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Sample DOCX</w:t></w:r></w:p></w:body></w:document>')
    return buffer.getvalue()


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


# Test 1 — PDF Upload & Download
def test_1_pdf_upload_and_download(db):
    pdf_bytes = _create_sample_pdf()
    vendor_id = "test_vendor_pdf"
    filename = "handbook.pdf"

    # Stage upload
    upload_res = storage_service.upload(
        file_bytes=pdf_bytes,
        filename=filename,
        content_type="application/pdf",
        vendor_id=vendor_id,
        is_image=False
    )
    assert upload_res["storage_path"] is not None
    assert upload_res["content_type"] == "application/pdf"

    # Create product
    prod = ProductService.create_product(
        db=db,
        vendor_id=vendor_id,
        title="PDF Handbook Guide",
        description="Detailed PDF Guide",
        category="E-books",
        price=19.99,
        temp_file_url=upload_res["storage_path"]
    )
    assert prod.id is not None
    assert prod.storage_path is not None
    assert "handbook.pdf" in prod.storage_path or ".pdf" in prod.storage_path

    # Verify stream content
    stream = storage_service.get_stream(prod.storage_path)
    streamed_bytes = b"".join(stream)
    assert streamed_bytes.startswith(b"%PDF-")


# Test 2 — ZIP Upload & Download
def test_2_zip_upload_and_extraction(db):
    zip_bytes = _create_sample_zip()
    vendor_id = "test_vendor_zip"
    filename = "template_kit.zip"

    upload_res = storage_service.upload(
        file_bytes=zip_bytes,
        filename=filename,
        content_type="application/zip",
        vendor_id=vendor_id,
        is_image=False
    )

    prod = ProductService.create_product(
        db=db,
        vendor_id=vendor_id,
        title="Template Kit Zip",
        description="Full Zip Bundle",
        category="Design Assets",
        price=29.99,
        temp_file_url=upload_res["storage_path"]
    )

    assert prod.storage_path.endswith(".zip")

    stream = storage_service.get_stream(prod.storage_path)
    streamed_bytes = b"".join(stream)
    
    with zipfile.ZipFile(io.BytesIO(streamed_bytes)) as zf:
        content = zf.read("test_document.txt").decode("utf-8")
        assert "Lumora Production Storage Test Payload" in content


# Test 3 — DOCX Upload & Format Preservation
def test_3_docx_upload_preserves_extension(db):
    docx_bytes = _create_sample_docx()
    vendor_id = "test_vendor_docx"
    filename = "resume_template.docx"

    upload_res = storage_service.upload(
        file_bytes=docx_bytes,
        filename=filename,
        content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        vendor_id=vendor_id,
        is_image=False
    )

    prod = ProductService.create_product(
        db=db,
        vendor_id=vendor_id,
        title="Resume Template DOCX",
        description="Editable DOCX Resume",
        category="Templates",
        price=14.99,
        temp_file_url=upload_res["storage_path"]
    )

    assert prod.storage_path.endswith(".docx")
    assert not prod.storage_path.endswith(".zip")


# Test 4 — Restart Server Persistence
def test_4_restart_persistence(db):
    pdf_bytes = _create_sample_pdf()
    vendor_id = "test_vendor_restart"
    
    upload_res = storage_service.upload(
        file_bytes=pdf_bytes,
        filename="restart_test.pdf",
        content_type="application/pdf",
        vendor_id=vendor_id,
        is_image=False
    )

    prod = ProductService.create_product(
        db=db,
        vendor_id=vendor_id,
        title="Restart Persistence Product",
        description="Testing persistence",
        category="General",
        price=9.99,
        temp_file_url=upload_res["storage_path"]
    )
    prod_id = prod.id
    saved_path = prod.storage_path

    # Simulate backend restart (fresh session query)
    new_db = SessionLocal()
    try:
        restarted_prod = new_db.query(Product).filter(Product.id == prod_id).first()
        assert restarted_prod is not None
        assert restarted_prod.storage_path == saved_path
        assert storage_service.exists(restarted_prod.storage_path)
    finally:
        new_db.close()


# Test 5 — Firestore Quota Failure (429 RESOURCE_EXHAUSTED)
def test_5_firestore_quota_failure_resilience(db):
    pdf_bytes = _create_sample_pdf()
    vendor_id = "test_vendor_quota"
    
    upload_res = storage_service.upload(
        file_bytes=pdf_bytes,
        filename="quota_test.pdf",
        content_type="application/pdf",
        vendor_id=vendor_id,
        is_image=False
    )

    # Mock B2 network calls to avoid timeout, and mock Firestore sync to raise 429 Quota Exceeded exception
    with patch.object(storage_service.b2_provider, "move_file", return_value="https://f005.backblazeb2.com/file/lumora-products/perm.pdf"), \
         patch.object(storage_service.b2_provider, "verify_object_integrity", return_value=True), \
         patch("admin.firestore.admin_firestore.sync_product_to_firestore", side_effect=Exception("429 Quota Exceeded")):
        prod = ProductService.create_product(
            db=db,
            vendor_id=vendor_id,
            title="Quota Failure Resilient Product",
            description="Testing Quota Resilience",
            category="General",
            price=12.00,
            temp_file_url=upload_res["storage_path"]
        )

        # Product in PostgreSQL must remain valid and committed
        assert prod.id is not None
        assert prod.storage_path is not None
        
        fetched = db.query(Product).filter(Product.id == prod.id).first()
        assert fetched is not None


# Test 6 — B2 Authorization Expiration (401 Retry)
def test_6_b2_auth_expiration_retry():
    provider = B2StorageProvider()
    provider.auth_token = "expired_token_xyz"
    provider.auth_token_expires_at = 0  # Force expired

    # Mock requests.get/post to simulate 401 on first call, then 200 after re-authorization
    call_count = 0

    def mock_post(url, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        if "b2_authorize_account" in url:
            mock_res = MagicMock()
            mock_res.status_code = 200
            mock_res.json.return_value = {
                "authorizationToken": "fresh_token_123",
                "apiUrl": "https://api005.backblazeb2.com",
                "downloadUrl": "https://f005.backblazeb2.com"
            }
            return mock_res
        elif "b2_get_upload_url" in url:
            if call_count == 1:
                mock_res = MagicMock()
                mock_res.status_code = 401
                return mock_res
            mock_res = MagicMock()
            mock_res.status_code = 200
            mock_res.json.return_value = {
                "uploadUrl": "https://upload.backblazeb2.com/upload",
                "authorizationToken": "upload_auth_token"
            }
            return mock_res
        else:
            mock_res = MagicMock()
            mock_res.status_code = 200
            import hashlib
            expected_hash = hashlib.sha1(b"test_bytes").hexdigest()
            mock_res.json.return_value = {"contentSha1": expected_hash}
            return mock_res

    with patch("requests.post", side_effect=mock_post), patch("requests.get") as mock_get:
        mock_auth_res = MagicMock()
        mock_auth_res.status_code = 200
        mock_auth_res.json.return_value = {
            "authorizationToken": "fresh_token_123",
            "apiUrl": "https://api005.backblazeb2.com",
            "downloadUrl": "https://f005.backblazeb2.com"
        }
        mock_get.return_value = mock_auth_res

        # Attempt upload which should trigger re-auth
        res = provider.upload_file(b"test_bytes", "test.txt", "text/plain", "v1")
        assert res["storage_path"] is not None
        assert provider.auth_token == "fresh_token_123"


# Test 7 — B2 Transaction Cap Exceeded (403 No Ephemeral Fallback)
def test_7_b2_transaction_cap_exceeded_no_ephemeral_fallback():
    provider = B2StorageProvider()
    provider.b2_status = "TRANSACTION_CAP_EXCEEDED"

    with patch.object(provider, "_ensure_auth", lambda: None), \
         patch.object(provider, "is_available", lambda: False), \
         patch.object(storage_service, "provider", provider):
        with pytest.raises(HTTPException) as exc_info:
            storage_service.upload(
                file_bytes=_create_sample_pdf(),
                filename="cap_test.pdf",
                content_type="application/pdf",
                vendor_id="vendor_cap",
                is_image=False
            )
        assert exc_info.value.status_code in (500, 503)
        assert "unavailable" in exc_info.value.detail.lower() or "transaction cap" in exc_info.value.detail.lower() or "failed" in exc_info.value.detail.lower()


# Test 8 — Invalid Upload Content Rejection
def test_8_invalid_upload_content_rejection():
    # Obvious blocked placeholder content
    fake_content = b"This is fake zip content for testing"
    
    with pytest.raises(HTTPException) as exc_info:
        storage_service.upload(
            file_bytes=fake_content,
            filename="fake.zip",
            content_type="application/zip",
            vendor_id="v_fake",
            is_image=False
        )
    assert exc_info.value.status_code == 422
    assert "rejected" in exc_info.value.detail.lower() or "placeholder" in exc_info.value.detail.lower()

    # Executable file rejection
    exe_content = b"MZ\x90\x00\x03\x00\x00\x00"
    with pytest.raises(HTTPException) as exc_info2:
        storage_service.upload(
            file_bytes=exe_content,
            filename="malware.exe",
            content_type="application/x-msdownload",
            vendor_id="v_fake",
            is_image=False
        )
    assert exc_info2.value.status_code == 422
    assert "blocked" in exc_info2.value.detail.lower() or "extension" in exc_info2.value.detail.lower()
