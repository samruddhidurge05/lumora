"""
upload_router.py
----------------
Handles file uploads for vendor product assets (digital files + preview images).
Files are stored on disk at  backend/uploads/  and the returned URL path is
saved to the products.file_url / products.preview columns — never base64.

Endpoints
---------
POST /api/uploads/          Upload any file (JWT required)
POST /api/uploads/image     Upload + compress preview image (JWT required)
"""
import os
import uuid
import shutil
import hashlib
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status, Query
from app.dependencies import get_current_user_required
from app.models.user import User
from admin.validators.status_checks import verify_vendor_active

router = APIRouter()

# ── Storage directory (backend/uploads/) ─────────────────────────────────────
UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "uploads",
)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Constants ─────────────────────────────────────────────────────────────────
MAX_FILE_BYTES  = 100 * 1024 * 1024   # 100 MB  — digital product files
MAX_IMAGE_BYTES =   5 * 1024 * 1024   # 5 MB    — preview images

ALLOWED_PRODUCT_EXTS = {
    ".zip", ".pdf", ".fig", ".sketch", ".xd", ".psd", ".ai", ".epub",
    ".docx", ".xlsx", ".pptx", ".mp4", ".mp3", ".wav", ".ttf", ".otf",
    ".json", ".csv", ".tar", ".gz", ".rar", ".7z",
}

ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_ext(filename: Optional[str]) -> str:
    """Return lower-case file extension or empty string."""
    if not filename:
        return ""
    return os.path.splitext(filename.lower())[1]


def _content_md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


def _save_bytes(data: bytes, ext: str) -> tuple[str, str]:
    """
    Write bytes to disk with a UUID-based filename.
    Returns (filename_on_disk, public_url_path).
    """
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path   = os.path.join(UPLOAD_DIR, unique_name)
    with open(file_path, "wb") as fh:
        fh.write(data)
    # Public URL served by FastAPI StaticFiles at /uploads/<filename>
    url = f"/uploads/{unique_name}"
    return unique_name, url


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/")
async def upload_product_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user_required),
    _active = Depends(verify_vendor_active),
):
    """
    Upload a vendor product file (ZIP, PDF, Figma, etc.).
    Returns { filename, url, size } — store `url` in products.file_url.
    JWT required (vendor or admin only).
    """
    if current_user.role not in ("vendor", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors can upload product files.",
        )

    ext = _safe_ext(file.filename)
    if ext not in ALLOWED_PRODUCT_EXTS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File type '{ext}' is not allowed. Allowed: {', '.join(sorted(ALLOWED_PRODUCT_EXTS))}",
        )

    data = await file.read()
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum allowed size is {MAX_FILE_BYTES // 1024 // 1024} MB.",
        )
    if len(data) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded file is empty.",
        )

    try:
        filename, url = _save_bytes(data, ext)
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save file: {exc}",
        )

    return {
        "filename":      file.filename,
        "saved_as":      filename,
        "url":           url,
        "size_bytes":    len(data),
        "size_kb":       round(len(data) / 1024, 1),
    }


@router.post("/image")
async def upload_product_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user_required),
    _active = Depends(verify_vendor_active),
):
    """
    Upload a product preview image (PNG, JPG, WEBP, etc.).
    Returns { filename, url, size } — store `url` in products.preview / products.thumbnail.
    JWT required.
    """
    ext = _safe_ext(file.filename)
    if ext not in ALLOWED_IMAGE_EXTS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Image type '{ext}' is not allowed. Allowed: {', '.join(sorted(ALLOWED_IMAGE_EXTS))}",
        )

    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image too large. Maximum size is {MAX_IMAGE_BYTES // 1024 // 1024} MB.",
        )
    if len(data) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded image is empty.",
        )

    try:
        filename, url = _save_bytes(data, ext)
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save image: {exc}",
        )

    return {
        "filename":   file.filename,
        "saved_as":   filename,
        "url":        url,
        "size_bytes": len(data),
        "size_kb":    round(len(data) / 1024, 1),
    }
