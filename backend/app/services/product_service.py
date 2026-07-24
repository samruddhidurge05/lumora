import os
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.product import Product
from app.services.storage_service import storage_service
from app.services.activity_log_service import ActivityLogService
from admin.firestore.admin_firestore import sync_product_to_firestore, delete_product_from_firestore


def _is_external_url(url: Optional[str]) -> bool:
    """
    Returns True if the URL is an external link (HTTP/HTTPS, data URI, blob URL, Cloudflare R2,
    AWS S3, Firebase Storage, Unsplash, pCloud, etc.) that should be stored as-is and
    NOT passed through move_to_permanent() as a local disk path.
    """
    if not url:
        return False
    # If the URL contains "/temp/", it is an internal temporary upload (B2, GCS, or Local)
    # that needs to be moved to permanent storage.
    if "/temp/" in url:
        return False
    if url.startswith(("http://", "https://", "data:", "blob:", "gs://", "b2://")):
        if "/uploads/" not in url:
            return True
    return False



def _extract_file_extension(source_path: Optional[str], default_ext: str = ".bin") -> str:
    """
    Safely extract the file extension from a temporary file path or URL.
    Preserves original extensions like .pdf, .zip, .docx, .xlsx, .pptx, .mp4, .png, etc.
    Falls back to default_ext if no extension is found or if path traversal characters are present.
    """
    if not source_path:
        return default_ext
    clean_path = source_path.split('?')[0].split('#')[0]
    ext = os.path.splitext(clean_path)[1].lower()
    clean_ext = "".join(c for c in ext if c.isalnum() or c == '.')
    if not clean_ext or clean_ext.startswith("..") or "/" in clean_ext or "\\" in clean_ext:
        return default_ext
    return clean_ext


def _slugify(text: str) -> str:
    """
    Generate a clean, URL-safe slug from a product title.
    """
    import re
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r'[^a-z0-9\-]', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')


class ProductService:
    @staticmethod
    def create_product(
        db: Session,
        vendor_id: str,
        title: str,
        description: str,
        category: str,
        price: float,
        temp_file_url: Optional[str] = None,
        temp_preview_url: Optional[str] = None,
        temp_thumbnail_url: Optional[str] = None,
        tags: Optional[list] = None,
        highlights: Optional[list] = None,
        badge: Optional[str] = None,
        seller: Optional[str] = "Creator",
        affiliate_enabled: bool = False,
        commission_type: str = "percentage",
        commission_mode: str = "percentage",
        commission_value: float = 0.0,
        affiliate_cookie_days: int = 30,
        affiliate_visibility: str = "public",
        affiliate_program_status: str = "active",
        short_desc: Optional[str] = None,
        features: Optional[list] = None,
        system_requirements: Optional[list] = None,
        what_you_get: Optional[list] = None,
        installation_guide: Optional[str] = None,
        subcategory: Optional[str] = None,
        discount: float = 0.0,
        preview_images: Optional[list] = None,
        preview_video: Optional[str] = None,
        seo_title: Optional[str] = None,
        seo_description: Optional[str] = None,
        visibility: str = "public",
        status: str = "published",
        image_urls: Optional[list] = None,
    ) -> Product:
        # We start an atomic transaction block
        moved_files = []
        try:
            # Create product shell first to get product_id
            product = Product(
                vendor_id=vendor_id,
                title=title,
                description=description,
                category=category,
                price=price,
                tags=tags,
                highlights=highlights,
                badge=badge,
                seller=seller,
                affiliate_enabled=affiliate_enabled,
                commission_type=commission_type or commission_mode or "percentage",
                commission_mode=commission_mode or commission_type or "percentage",
                commission_value=commission_value,
                affiliate_cookie_days=affiliate_cookie_days,
                affiliate_visibility=affiliate_visibility,
                affiliate_program_status=affiliate_program_status,
                status=status,
                short_desc=short_desc,
                features=features,
                system_requirements=system_requirements,
                what_you_get=what_you_get,
                installation_guide=installation_guide,
                subcategory=subcategory,
                discount=discount,
                preview_images=preview_images,
                preview_video=preview_video,
                seo_title=seo_title,
                seo_description=seo_description,
                visibility=visibility,
                image_urls=[],
            )
            db.add(product)
            db.flush() # Populate product.id

            # Move temp uploaded assets to permanent hierarchical paths:
            # vendors/{vendor_id}/products/{product_id}/...
            # External URLs (pCloud, S3, Firebase Storage, etc.) are stored as-is.
            slug = _slugify(product.title)
            display_name = f"{slug if slug else 'product'}-{product.id}"

            if temp_file_url:
                if _is_external_url(temp_file_url):
                    # External URL - store directly; no local file movement needed
                    product.file_url = temp_file_url
                else:
                    file_ext = _extract_file_extension(temp_file_url, default_ext=".bin")
                    storage_path, perm_url = storage_service.move_to_permanent(
                        source_path=temp_file_url,
                        vendor_id=vendor_id,
                        product_id=product.id,
                        filename=f"{display_name}{file_ext}",
                        is_image=False,
                        asset_type="file"
                    )
                    if storage_path:
                        product.storage_path = storage_path
                        product.file_url = perm_url
                        moved_files.append(storage_path)

            if temp_preview_url:
                if _is_external_url(temp_preview_url):
                    product.preview = temp_preview_url
                else:
                    preview_path, perm_preview = storage_service.move_to_permanent(
                        source_path=temp_preview_url,
                        vendor_id=vendor_id,
                        product_id=product.id,
                        filename=f"{display_name}-preview.png",
                        is_image=True,
                        asset_type="preview"
                    )
                    if preview_path:
                        product.preview_path = preview_path
                        product.preview = perm_preview
                        moved_files.append(preview_path)

            if temp_thumbnail_url:
                if _is_external_url(temp_thumbnail_url):
                    product.thumbnail = temp_thumbnail_url
                else:
                    thumbnail_path, perm_thumbnail = storage_service.move_to_permanent(
                        source_path=temp_thumbnail_url,
                        vendor_id=vendor_id,
                        product_id=product.id,
                        filename=f"{display_name}-thumbnail.png",
                        is_image=True,
                        asset_type="thumbnail"
                    )
                    if thumbnail_path:
                        product.thumbnail_path = thumbnail_path
                        product.thumbnail = perm_thumbnail
                        moved_files.append(thumbnail_path)

            # Strict Physical Verification of Permanent Storage Objects before PostgreSQL Commit
            pref = os.getenv("STORAGE_PROVIDER", "b2").lower()
            if pref == "b2" and not _is_test_environment():
                # Verify digital file if present
                if temp_file_url and not _is_external_url(temp_file_url):
                    if not product.storage_path or not product.storage_path.startswith("b2://") or "/temp/" in product.storage_path:
                        raise HTTPException(
                            status_code=500,
                            detail="Transactional failure: Storage path is missing or non-permanent B2 reference."
                        )
                    if not storage_service.b2_provider.verify_object_integrity(product.storage_path):
                        raise HTTPException(
                            status_code=500,
                            detail=f"Physical object verification failed for digital file '{product.storage_path}'."
                        )

                # Verify preview if present
                if temp_preview_url and not _is_external_url(temp_preview_url):
                    if getattr(product, "preview_path", None) and "/temp/" in product.preview_path:
                        raise HTTPException(
                            status_code=500,
                            detail="Transactional failure: Preview path is non-permanent B2 reference."
                        )

                # Verify thumbnail if present
                if temp_thumbnail_url and not _is_external_url(temp_thumbnail_url):
                    if getattr(product, "thumbnail_path", None) and "/temp/" in product.thumbnail_path:
                        raise HTTPException(
                            status_code=500,
                            detail="Transactional failure: Thumbnail path is non-permanent B2 reference."
                        )

            # Log activity
            from app.models.user import User
            user = db.query(User).filter(User.firebase_uid == vendor_id).first()
            if user:
                ActivityLogService.log_user_activity(
                    db=db,
                    user_id=user.id,
                    activity_type="upload_product",
                    details=f"Uploaded product '{title}' (ID {product.id})."
                )

            # Commit to SQLite/PostgreSQL (Single Source of Truth)
            db.commit()
            
            # Sync product details to Firestore for real-time customer catalogs (best-effort)
            try:
                sync_product_to_firestore(product)
            except Exception as fs_err:
                import logging
                logging.getLogger(__name__).warning("[product-service] Firestore sync failed non-fatally: %s", fs_err)
            
            return product

        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error("[product-service] Product creation database/storage transaction failed: %s", e, exc_info=True)
            db.rollback()
            # Rollback: Clean up any moved permanent files in B2/disk
            for path in moved_files:
                try:
                    storage_service.delete(path)
                except Exception:
                    pass
            raise e

    @staticmethod
    def update_product(
        db: Session,
        product_id: int,
        vendor_id: str,
        update_data: Dict[str, Any]
    ) -> Product:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # Authorization check: only owner vendor can update
        if product.vendor_id != vendor_id:
            raise HTTPException(status_code=403, detail="Not authorized to edit this product")

        # Keep track of old storage files to purge after commit, and new files to rollback on failure
        old_files_to_delete = []
        new_files_to_delete = []
        
        try:
            slug = _slugify(update_data.get("title", product.title))
            display_name = f"{slug if slug else 'product'}-{product_id}"

            # Handle digital file change
            if "file_url" in update_data and update_data["file_url"] != product.file_url:
                new_file = update_data["file_url"]
                if new_file:
                    if _is_external_url(new_file):
                        # External URL (pCloud, S3, etc.) - store directly
                        product.file_url = new_file
                    elif "/products/" not in new_file:
                        # New temporary local upload - move to permanent storage
                        if product.storage_path:
                            old_files_to_delete.append(product.storage_path)
                        file_ext = _extract_file_extension(new_file, default_ext=".bin")
                        new_storage_path, perm_url = storage_service.move_to_permanent(
                            source_path=new_file,
                            vendor_id=vendor_id,
                            product_id=product_id,
                            filename=f"{display_name}{file_ext}",
                            is_image=False,
                            asset_type="file"
                        )
                        product.storage_path = new_storage_path
                        product.file_url = perm_url
                        new_files_to_delete.append(new_storage_path)
                    else:
                        # Already-permanent local path
                        product.file_url = new_file

            # Handle preview image change
            if "preview" in update_data and update_data["preview"] != product.preview:
                new_preview = update_data["preview"]
                if new_preview:
                    if _is_external_url(new_preview):
                        product.preview = new_preview
                    elif "/products/" not in new_preview:
                        if product.preview_path:
                            old_files_to_delete.append(product.preview_path)
                        new_preview_path, perm_preview = storage_service.move_to_permanent(
                            source_path=new_preview,
                            vendor_id=vendor_id,
                            product_id=product_id,
                            filename=f"{display_name}-preview.png",
                            is_image=True,
                            asset_type="preview"
                        )
                        product.preview_path = new_preview_path
                        product.preview = perm_preview
                        new_files_to_delete.append(new_preview_path)
                    else:
                        product.preview = new_preview

            # Handle thumbnail image change
            if "thumbnail" in update_data and update_data["thumbnail"] != product.thumbnail:
                new_thumb = update_data["thumbnail"]
                if new_thumb:
                    if _is_external_url(new_thumb):
                        product.thumbnail = new_thumb
                    elif "/products/" not in new_thumb:
                        if product.thumbnail_path:
                            old_files_to_delete.append(product.thumbnail_path)
                        new_thumbnail_path, perm_thumbnail = storage_service.move_to_permanent(
                            source_path=new_thumb,
                            vendor_id=vendor_id,
                            product_id=product_id,
                            filename=f"{display_name}-thumbnail.png",
                            is_image=True,
                            asset_type="thumbnail"
                        )
                        product.thumbnail_path = new_thumbnail_path
                        product.thumbnail = perm_thumbnail
                        new_files_to_delete.append(new_thumbnail_path)
                    else:
                        product.thumbnail = new_thumb

            # Price drop check
            price_dropped = False
            old_price = product.price
            new_price = update_data.get("price")
            if new_price is not None and new_price < old_price:
                price_dropped = True

            # Update core metadata columns
            for field in (
                "title", "description", "category", "price", "tags", "highlights", "badge", "seller",
                "affiliate_enabled", "commission_type", "commission_mode", "commission_value",
                "affiliate_cookie_days", "affiliate_visibility", "affiliate_program_status",
                "short_desc", "features", "system_requirements", "what_you_get", "installation_guide",
                "subcategory", "discount", "preview_images", "preview_video", "seo_title", "seo_description", "visibility", "status"
            ):
                if field in update_data:
                    setattr(product, field, update_data[field])

            if price_dropped:
                # Trigger price alerts
                discount_percent = int(((old_price - new_price) / old_price) * 100)
                from app.models.price_alert import PriceAlert
                from app.services.notification_service import NotificationService
                
                alerts = db.query(PriceAlert).filter(
                    PriceAlert.product_id == product.id,
                    PriceAlert.active == True
                ).all()
                
                for alert in alerts:
                    msg = f"'{product.title}' has dropped from ?{int(old_price * 80)} to ?{int(new_price * 80)} ({discount_percent}% OFF)."
                    NotificationService.create_notification(
                        db=db,
                        user_id=alert.user_id,
                        title="Price Drop Alert! ?",
                        message=msg,
                        category="price_drop"
                    )
                    alert.original_price = new_price
                    alert.target_price = new_price * 0.9
                    db.add(alert)

            from app.models.user import User
            user = db.query(User).filter(User.firebase_uid == vendor_id).first()
            if user:
                ActivityLogService.log_user_activity(
                    db=db,
                    user_id=user.id,
                    activity_type="edit_product",
                    details=f"Edited product '{product.title}' (ID {product.id})."
                )

            # Commit changes
            db.commit()

            # Clean up old replaced files from storage
            for path in old_files_to_delete:
                try:
                    storage_service.delete(path)
                except Exception:
                    pass

            # Sync updated details to Firestore
            sync_product_to_firestore(product)

            # Structured log
            from app.utils.logger import log_structured_event
            log_structured_event(
                user_id=user.id if user else None,
                role="vendor",
                action="product_updated",
                module="products",
                status="success",
                details=f"Product '{product.title}' (ID {product.id}) updated by vendor {vendor_id}",
            )

            return product

        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error("[product-service] Product update transaction failed for product ID %s: %s", product_id, e, exc_info=True)
            db.rollback()
            # Clean up any new uploads since database transaction failed
            for path in new_files_to_delete:
                try:
                    storage_service.delete(path)
                except Exception:
                    pass
            raise e

    @staticmethod
    def archive_product(db: Session, product_id: int, vendor_id: str) -> Product:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # Authorization check: owner or admin
        if product.vendor_id != vendor_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this product")

        try:
            # Soft Delete / Archive product
            product.status = "archived"
            
            from app.models.user import User
            user = db.query(User).filter(User.firebase_uid == vendor_id).first()
            if user:
                ActivityLogService.log_user_activity(
                    db=db,
                    user_id=user.id,
                    activity_type="archive_product",
                    details=f"Archived/deleted product '{product.title}' (ID {product.id})."
                )

            db.commit()

            # Structured log
            from app.utils.logger import log_structured_event
            log_structured_event(
                user_id=user.id if user else None,
                role="vendor",
                action="product_archived",
                module="products",
                status="success",
                details=f"Product '{product.title}' (ID {product.id}) archived by vendor {vendor_id}",
            )

            # Update/Delete from Firestore so it disappears from customer catalog
            delete_product_from_firestore(product_id)

            return product

        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def _is_image_url(url: Optional[str]) -> bool:
        if not url:
            return False
        
        # Check scheme first - allow http, https, b2, gs, and relative/local paths
        low_url = url.lower()
        if not (low_url.startswith("http://") or low_url.startswith("https://") or 
                low_url.startswith("b2://") or low_url.startswith("gs://") or
                low_url.startswith("/") or "/uploads/" in low_url or "media/" in low_url):
            return False
            
        # Parse query params out of path for extension check
        from urllib.parse import urlparse
        try:
            parsed = urlparse(url)
            path = parsed.path.lower()
        except Exception:
            return False
            
        # Reject known non-image extensions
        non_image_exts = (
            ".pdf", ".zip", ".mp4", ".mov", ".docx", ".xlsx", ".pptx", ".tar", 
            ".gz", ".rar", ".7z", ".fig", ".sketch", ".xd", ".psd", ".ai", 
            ".epub", ".mp3", ".wav", ".ttf", ".otf"
        )
        if any(path.endswith(ext) for ext in non_image_exts):
            return False
            
        return True

    @staticmethod
    def _resolve_media_url(url: Optional[str], category: str = None) -> Optional[str]:
        if not url:
            return None
            
        # Handle B2 scheme or configuration-driven Backblaze absolute URLs
        from app.services.storage_service import storage_service
        from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
        
        b2 = storage_service.b2_provider
        bucket_name = getattr(b2, "bucket_name", None) or "lumora-products"
        download_domain = getattr(b2, "download_url", None) or "https://f005.backblazeb2.com"
        
        is_b2 = False
        file_path = None
        
        if url.startswith("b2://"):
            clean_path = url.replace("b2://", "")
            parts = clean_path.split("/", 1)
            if len(parts) == 2:
                bucket_name, file_path = parts
                is_b2 = True
        elif url.startswith("http://") or url.startswith("https://"):
            try:
                parsed_url = urlparse(url)
                parsed_download = urlparse(download_domain)
                # Check if it belongs to Backblaze and matches the bucket
                if parsed_url.netloc and (parsed_url.netloc == parsed_download.netloc or "backblazeb2.com" in parsed_url.netloc):
                    bucket_marker = f"/file/{bucket_name}/"
                    if bucket_marker in parsed_url.path:
                        file_path = parsed_url.path.split(bucket_marker, 1)[1]
                        is_b2 = True
            except Exception:
                pass
                
        if is_b2 and file_path:
            # PRIVATE assets must NEVER be converted to public direct URLs!
            if file_path.startswith("private/"):
                return url
            return f"/api/products/media/{file_path}"
                
        # Fallback to local files resolution
        url_lower = url.lower()
        if "/uploads/" in url_lower:
            # Route local uploads through the same media proxy for consistency
            try:
                path_part = url.split("/uploads/", 1)[1]
                return f"/api/products/media/{path_part}"
            except Exception:
                return url
                
        return url

    @staticmethod
    def resolve_product_media(product, db) -> Any:
        # Expunge/transient helper to prevent database write conflicts
        from sqlalchemy.orm import make_transient
        try:
            db.expunge(product)
            make_transient(product)
        except Exception:
            pass
            
        stored_thumb = product.thumbnail
        stored_preview = product.preview
        image_urls = product.image_urls if isinstance(product.image_urls, list) else []
        
        resolved_thumb = None
        resolved_preview = None
        
        # 1. Resolve stored thumbnail
        if stored_thumb:
            if ProductService._is_image_url(stored_thumb):
                resolved_thumb = ProductService._resolve_media_url(stored_thumb, product.category)
                if resolved_thumb and not ProductService._is_image_url(resolved_thumb):
                    resolved_thumb = None
                    
        # 2. Resolve stored preview
        if stored_preview:
            if ProductService._is_image_url(stored_preview):
                resolved_preview = ProductService._resolve_media_url(stored_preview, product.category)
                if resolved_preview and not ProductService._is_image_url(resolved_preview):
                    resolved_preview = None
                    
        # 3. Fallbacks
        if not resolved_thumb and image_urls:
            for first in image_urls:
                if ProductService._is_image_url(first):
                    resolved_thumb = ProductService._resolve_media_url(first, product.category)
                    if resolved_thumb:
                        break
        if not resolved_preview and image_urls:
            for first in image_urls:
                if ProductService._is_image_url(first):
                    resolved_preview = ProductService._resolve_media_url(first, product.category)
                    if resolved_preview:
                        break
                        
        product.thumbnail = resolved_thumb
        product.preview = resolved_preview
        
        # 4. Resolve file_url
        if product.file_url:
            if "/uploads/" in product.file_url:
                product.file_url = ProductService._resolve_media_url(product.file_url, product.category)
                
        # 5. Resolve gallery / image_urls / preview_images
        if product.image_urls:
            resolved_images = []
            for img in product.image_urls:
                if ProductService._is_image_url(img):
                    r = ProductService._resolve_media_url(img, product.category)
                    if r:
                        resolved_images.append(r)
                else:
                    resolved_images.append(img)
            product.image_urls = resolved_images
            
        if product.preview_images:
            resolved_pi = []
            for img in product.preview_images:
                if ProductService._is_image_url(img):
                    r = ProductService._resolve_media_url(img, product.category)
                    if r:
                        resolved_pi.append(r)
                else:
                    resolved_pi.append(img)
            product.preview_images = resolved_pi
            
        return product

    @staticmethod
    def resolve_products_media(products, db) -> Any:
        if isinstance(products, list):
            return [ProductService.resolve_product_media(p, db) for p in products]
        elif products:
            return ProductService.resolve_product_media(products, db)
        return products

