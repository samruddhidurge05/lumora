"""
upload_router.py
----------------
Handles file uploads for vendor product assets (digital files + preview images).
Utilizes the production StorageService with local disk fallback.

Endpoints
---------
POST /api/uploads/          Upload any file (JWT required)
POST /api/uploads/image     Upload + compress preview image (JWT required)
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status, Request
from app.dependencies import get_current_user_required
from app.models.user import User
from admin.validators.status_checks import verify_upload_allowed
from app.services.storage_service import storage_service
from app.middleware.rate_limit import limiter

router = APIRouter()

@router.post("/")
@limiter.limit("10/minute")
async def upload_product_file(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user_required),
    _allowed = Depends(verify_upload_allowed),
):
    """
    Upload a vendor product file (ZIP, PDF, Figma, etc.).
    Returns { filename, url, size } - store `url` in products.file_url.
    JWT required (vendor or admin only).
    """
    if current_user.role not in ("vendor", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors can upload product files.",
        )

    data = await file.read()
    vendor_id = str(current_user.id)
    
    # Delegate to storage service (validates extension, empty file, and size internally)
    res = storage_service.upload(
        file_bytes=data,
        filename=file.filename,
        content_type=file.content_type,
        vendor_id=vendor_id,
        is_image=False
    )

    return {
        "filename":      file.filename,
        "saved_as":      res["storage_path"],
        "url":           res["url"],
        "size_bytes":    len(data),
        "size_kb":       round(len(data) / 1024, 1),
        "hash":          res["hash"]
    }


@router.post("/image")
@limiter.limit("10/minute")
async def upload_product_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user_required),
    _allowed = Depends(verify_upload_allowed),
):
    """
    Upload a product preview image (PNG, JPG, WEBP, etc.).
    Returns { filename, url, size } - store `url` in products.preview / products.thumbnail.
    JWT required.
    """
    data = await file.read()
    vendor_id = str(current_user.id)
    
    # Delegate to storage service
    res = storage_service.upload(
        file_bytes=data,
        filename=file.filename,
        content_type=file.content_type,
        vendor_id=vendor_id,
        is_image=True
    )

    return {
        "filename":   file.filename,
        "saved_as":   res["storage_path"],
        "url":        res["url"],
        "size_bytes": len(data),
        "size_kb":    round(len(data) / 1024, 1),
        "hash":       res["hash"]
    }
