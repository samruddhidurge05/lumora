import pytest
from fastapi import HTTPException
from app.services.storage_service import storage_service

def test_validate_empty_file():
    with pytest.raises(HTTPException) as exc:
        storage_service.validate_file(b"", "test.zip", is_image=False)
    assert exc.value.status_code == 422
    assert "empty" in exc.value.detail

def test_validate_placeholder_text():
    with pytest.raises(HTTPException) as exc:
        storage_service.validate_file(b"This is fake zip content to test uploads", "test.zip", is_image=False)
    assert exc.value.status_code == 422
    assert "placeholder" in exc.value.detail

def test_validate_image_mimetype_and_magic_numbers():
    # Valid PNG header
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR..."
    ext = storage_service.validate_file(png_bytes, "photo.png", is_image=True)
    assert ext == ".png"

    # Mismatched PNG header with JPG extension
    with pytest.raises(HTTPException) as exc:
        storage_service.validate_file(png_bytes, "photo.jpg", is_image=True)
    assert exc.value.status_code == 422
    assert "not compatible" in exc.value.detail

    # Invalid image bytes
    with pytest.raises(HTTPException) as exc:
        storage_service.validate_file(b"not an image", "photo.png", is_image=True)
    assert exc.value.status_code == 422
    assert "Invalid image content" in exc.value.detail

def test_validate_product_files():
    # Valid ZIP header
    zip_bytes = b"PK\x03\x04\x14\x00\x08\x00\x08\x00..."
    ext = storage_service.validate_file(zip_bytes, "bundle.zip", is_image=False)
    assert ext == ".zip"

    # Invalid ZIP header
    with pytest.raises(HTTPException) as exc:
        storage_service.validate_file(b"not a zip file", "bundle.zip", is_image=False)
    assert exc.value.status_code == 422
    assert "ZIP-based format" in exc.value.detail

    # Valid PDF header
    pdf_bytes = b"%PDF-1.4\n%..."
    ext = storage_service.validate_file(pdf_bytes, "document.pdf", is_image=False)
    assert ext == ".pdf"
