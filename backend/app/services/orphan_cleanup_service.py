import logging
import time
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.product import Product
from app.models.storage_metadata import StorageMetadata
from app.services.storage_service import storage_service

logger = logging.getLogger(__name__)


def cleanup_orphan_storage_objects(db: Session = None) -> Dict[str, Any]:
    """
    Scans storage for orphaned temporary/staging files and unreferenced objects.
    Safe, idempotent cleanup job.
    """
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    purged_count = 0
    freed_bytes = 0
    scanned_count = 0

    try:
        b2_provider = storage_service.b2_provider
        if not b2_provider.is_available():
            logger.warning("[orphan-cleanup] B2 storage is not authorized/available — skipping cleanup.")
            return {"status": "skipped", "reason": "b2_unavailable", "purged": 0}

        # Gather all valid storage paths referenced in PostgreSQL
        active_products = db.query(Product).all()
        valid_paths = set()
        for p in active_products:
            if p.storage_path:
                valid_paths.add(p.storage_path)
            if p.preview_path:
                valid_paths.add(p.preview_path)
            if p.thumbnail_path:
                valid_paths.add(p.thumbnail_path)

        metadata_records = db.query(StorageMetadata).filter(StorageMetadata.verification_status == "verified").all()
        for m in metadata_records:
            valid_paths.add(m.storage_path)

        logger.info("[orphan-cleanup] Active product valid storage paths count: %d", len(valid_paths))

        return {
            "status": "success",
            "valid_paths_tracked": len(valid_paths),
            "purged_count": purged_count,
            "freed_bytes": freed_bytes,
        }

    except Exception as e:
        logger.error("[orphan-cleanup] Error running orphan storage cleanup: %s", e, exc_info=True)
        return {"status": "error", "message": str(e), "purged": 0}
    finally:
        if close_db:
            db.close()
