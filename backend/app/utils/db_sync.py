import logging
from datetime import datetime
from app.models.product import Product
from app.shared.firebase.connection import db as firestore_db, firebase_connected

logger = logging.getLogger(__name__)

def get_product_by_id(db_session, product_id: int) -> Product:
    # First query local SQLite
    product = db_session.query(Product).filter(Product.id == product_id).first()
    if product:
        return product

    # If not found in SQLite, and Firebase is connected, try to restore/sync from Firestore
    if not firebase_connected or firestore_db is None:
        logger.warning(f"[db_sync] Firebase not connected. Cannot fetch product {product_id} from Firestore.")
        return None

    try:
        logger.info(f"[db_sync] Product {product_id} not found in SQLite. Attempting to fetch from Firestore...")
        doc_ref = firestore_db.collection("products").document(str(product_id))
        doc = doc_ref.get()
        if not doc.exists:
            logger.warning(f"[db_sync] Product {product_id} not found in Firestore either.")
            return None

        data = doc.to_dict()
        logger.info(f"[db_sync] Product {product_id} found in Firestore. Restoring to SQLite...")

        # Map Firestore data back to SQLAlchemy model
        tags = data.get("tags")
        if not isinstance(tags, list):
            tags = []
        highlights = data.get("highlights")
        if not isinstance(highlights, list):
            highlights = []
        features = data.get("features")
        if not isinstance(features, list):
            features = []
        sys_req = data.get("systemRequirements") or data.get("system_requirements")
        if not isinstance(sys_req, list):
            sys_req = []
        what_you_get = data.get("whatYouGet") or data.get("what_you_get")
        if not isinstance(what_you_get, list):
            what_you_get = []
        preview_images = data.get("previewImages") or data.get("preview_images")
        if not isinstance(preview_images, list):
            preview_images = []
        image_urls = data.get("image_urls") or data.get("imageUrls") or []
        if not isinstance(image_urls, list):
            image_urls = []

        # Parse dates
        created_at = None
        updated_at = None
        created_str = data.get("createdAt")
        updated_str = data.get("updatedAt")
        if created_str:
            try:
                created_at = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
            except ValueError:
                pass
        if updated_str:
            try:
                updated_at = datetime.fromisoformat(updated_str.replace("Z", "+00:00"))
            except ValueError:
                pass

        new_prod = Product(
            id=product_id,
            title=data.get("title") or data.get("name") or "Restored Product",
            description=data.get("description") or "",
            category=data.get("category") or "General",
            price=float(data.get("price") or 0.0),
            rating=float(data.get("rating") or 5.0),
            reviews=int(data.get("reviews") or data.get("review_count") or 0),
            downloads=int(data.get("downloads") or 0),
            thumbnail=data.get("thumbnail"),
            preview=data.get("preview"),
            file_url=data.get("file_url") or data.get("fileUrl"),
            seller=data.get("creatorName") or "Lumora",
            vendor_id=data.get("vendor_id"),
            featured=bool(data.get("featured") or data.get("isFeatured")),
            trending=bool(data.get("trending")),
            new_arrival=bool(data.get("new_arrival")),
            badge=data.get("badge"),
            status="published" if (data.get("status") in ("published", "active", "approved", None) or not data.get("status")) else data.get("status"),
            tags=tags,
            highlights=highlights,
            version=data.get("version") or "v1.0.0",
            file_size=data.get("fileSize") or data.get("file_size") or "48 MB",
            last_updated=data.get("last_updated") or "Recently",
            license=data.get("license") or "Personal Use",
            affiliate_enabled=True if data.get("affiliate_enabled") is not False else False,
            commission_type=data.get("commission_type") or "percentage",
            commission_value=float(data.get("commission_value") or 0.0),
            short_desc=data.get("short_desc") or data.get("shortDesc"),
            features=features,
            system_requirements=sys_req,
            what_you_get=what_you_get,
            installation_guide=data.get("installation_guide") or data.get("installationGuide"),
            subcategory=data.get("subcategory"),
            discount=float(data.get("discount") or 0.0),
            preview_images=preview_images,
            preview_video=data.get("previewVideo"),
            seo_title=data.get("seoTitle") or data.get("seo_title"),
            seo_description=data.get("seoDescription") or data.get("seo_description"),
            visibility=data.get("visibility") or "public",
            image_urls=[],
            created_at=created_at or datetime.utcnow(),
            updated_at=updated_at or datetime.utcnow()
        )

        db_session.add(new_prod)
        db_session.commit()
        db_session.refresh(new_prod)
        logger.info(f"[db_sync] Product {product_id} successfully restored/inserted into SQLite.")
        return new_prod
    except Exception as e:
        logger.error(f"[db_sync] Error restoring product {product_id} from Firestore: {e}", exc_info=True)
        try:
            db_session.rollback()
        except Exception:
            pass
        return None
