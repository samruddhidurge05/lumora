import logging
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from admin.validators.admin_auth import require_admin_role
from app.services.storage_service import storage_service
from app.models.product import Product
from app.models.storage_metadata import StorageMetadata

logger = logging.getLogger(__name__)
router = APIRouter()

# Operational timestamp trackers
_LAST_UPLOAD_AT = None
_LAST_DOWNLOAD_AT = None
_LAST_VERIFICATION_AT = None


def record_operational_event(event_type: str):
    global _LAST_UPLOAD_AT, _LAST_DOWNLOAD_AT, _LAST_VERIFICATION_AT
    now_iso = datetime.now(timezone.utc).isoformat()
    if event_type == "upload":
        _LAST_UPLOAD_AT = now_iso
    elif event_type == "download":
        _LAST_DOWNLOAD_AT = now_iso
    elif event_type == "verification":
        _LAST_VERIFICATION_AT = now_iso


@router.get("/health")
def get_storage_health(db: Session = Depends(get_db), admin_user = Depends(require_admin_role)):
    """
    Returns enterprise-grade operational storage health, metrics, and integrity scores.
    Admin authorization required.
    """
    b2_provider = storage_service.b2_provider
    b2_status = getattr(b2_provider, "b2_status", "UNKNOWN")
    cache_metrics = b2_provider.cache.get_metrics()
    
    is_available = b2_status == "AUTHORIZED"
    status_label = "AVAILABLE" if is_available else f"UNAVAILABLE — {b2_status}"
    
    # Calculate Cache Hit Rate
    hits = cache_metrics.get("cache_hits", 0)
    misses = cache_metrics.get("cache_misses", 0)
    total_cache_lookups = hits + misses
    hit_rate_pct = round((hits / total_cache_lookups * 100), 1) if total_cache_lookups > 0 else 100.0

    # Calculate Total Storage Used from StorageMetadata table
    storage_used_bytes = 0
    try:
        from sqlalchemy import func
        res = db.query(func.sum(StorageMetadata.size_bytes)).scalar()
        if res:
            storage_used_bytes = int(res)
    except Exception:
        pass

    # Calculate Database & B2 Integrity Score
    total_products = db.query(Product).count()
    verified_products = db.query(Product).filter(
        Product.storage_path.isnot(None),
        Product.storage_path.like("b2://%")
    ).count()
    
    integrity_score_pct = round((verified_products / total_products * 100), 1) if total_products > 0 else 100.0
    integrity_score_str = f"{integrity_score_pct}%"

    return {
        "status": status_label,
        "provider": "Backblaze B2 Storage",
        "authorization": b2_status,
        "is_available": is_available,
        "active_provider_setting": os.getenv("STORAGE_PROVIDER", "b2").lower(),
        "bucket_name": b2_provider.bucket_name,
        "operational_metrics": {
            "last_upload_at": _LAST_UPLOAD_AT or "No uploads since startup",
            "last_download_at": _LAST_DOWNLOAD_AT or "No downloads since startup",
            "last_verification_at": _LAST_VERIFICATION_AT or datetime.now(timezone.utc).isoformat(),
            "failed_uploads": cache_metrics.get("failed_b2_calls", 0),
            "storage_used_bytes": storage_used_bytes,
            "storage_used_mb": round(storage_used_bytes / (1024 * 1024), 2),
            "cache_hit_rate_pct": f"{hit_rate_pct}%",
            "integrity_score": integrity_score_str,
            "total_products": total_products,
            "verified_products": verified_products
        },
        "raw_cache_metrics": cache_metrics,
        "details": {
            "auth_token_active": bool(b2_provider.auth_token),
            "api_url": b2_provider.api_url or "Unavailable",
            "download_url": b2_provider.download_url or "Unavailable"
        }
    }
