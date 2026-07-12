from app.shared.firebase.connection import db, firebase_connected
from firebase_admin import firestore
from datetime import datetime, timezone

def sync_product_to_firestore(product):
    if not firebase_connected or db is None:
        return
    try:
        tags = product.tags if isinstance(product.tags, list) else []
        highlights = product.highlights if isinstance(product.highlights, list) else []
        
        doc_ref = db.collection("products").document(str(product.id))
        doc_ref.set({
            "title": product.title,
            "name": product.title,
            "description": product.description or "",
            "shortDesc": product.short_desc or (product.description[:150] if product.description else "Premium digital assets"),
            "category": product.category or "General",
            "price": float(product.price or 0.0),
            "rating": float(product.rating or 5.0),
            "reviews": int(product.reviews or 0),
            "downloads": int(product.downloads or 0),
            "thumbnail": product.thumbnail or "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80",
            "preview": product.preview or "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80",
            "creatorName": product.seller or "Creator",
            "creatorAvatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
            "featured": bool(product.featured),
            "isFeatured": bool(product.featured),
            "status": product.status or "published",
            "tags": tags,
            "highlights": highlights,
            "version": product.version or "v1.0.0",
            "fileSize": product.file_size or "48 MB",
            "createdAt": product.created_at.isoformat() + "Z" if product.created_at else datetime.now(timezone.utc).isoformat() + "Z",
            "updatedAt": datetime.now(timezone.utc).isoformat() + "Z",
            "vendor_id": str(product.vendor_id) if product.vendor_id else None,
            "features": product.features if isinstance(product.features, list) else [],
            "systemRequirements": product.system_requirements if isinstance(product.system_requirements, list) else [],
            "whatYouGet": product.what_you_get if isinstance(product.what_you_get, list) else [],
            "installationGuide": product.installation_guide or "",
            "subcategory": product.subcategory or "",
            "discount": float(product.discount or 0.0),
            "previewImages": product.preview_images if isinstance(product.preview_images, list) else [],
            "previewVideo": product.preview_video or "",
            "seoTitle": product.seo_title or "",
            "seoDescription": product.seo_description or "",
            "visibility": product.visibility or "public",
            "license": product.license or "Personal Use",
            "affiliate_enabled": bool(product.affiliate_enabled),
            "commission_type": product.commission_type or "percentage",
            "commission_value": float(product.commission_value or 0.0)
        }, merge=True)
    except Exception as e:
        print(f"[firestore-sync] Error syncing product {product.id} to Firestore: {e}")

def delete_product_from_firestore(product_id: int):
    if not firebase_connected or db is None:
        return
    try:
        db.collection("products").document(str(product_id)).delete()
    except Exception as e:
        print(f"[firestore-sync] Error deleting product {product_id} from Firestore: {e}")

def get_platform_settings():
    if not firebase_connected or db is None:
        return {}
    try:
        doc_ref = db.collection("platformSettings").document("global")
        snap = doc_ref.get()
        if snap.exists:
            return snap.to_dict()
    except Exception as e:
        print(f"[firestore-sync] Error getting platform settings: {e}")
    return {}

def sync_order_to_firestore(order):
    """
    Sync a SQLite order to the Firestore ``orders`` collection.

    The document shape matches what every admin page (Dashboard, Analytics,
    Orders Management, Payments) expects.  Uses ``set(..., merge=True)`` keyed
    on ``orderId`` so calling this function multiple times with the same order
    is idempotent — subsequent calls update the existing document rather than
    creating duplicates (Property 4: Order sync is idempotent).

    This sync is **best-effort**: callers must wrap the call in try/except and
    must NOT roll back the SQLite order if the sync fails.  SQLite is the
    canonical source of truth.

    Requirements: 2.1, 2.2, 2.5, 15.1, 15.2
    """
    if not firebase_connected or db is None:
        return
    try:
        # Build the items list from the order's eagerly-loaded relationship.
        # ``item.product`` may be None if the product was deleted; fall back
        # gracefully so the order document is still written.
        items = order.items if hasattr(order, "items") and order.items else []

        firestore_items = []
        for item in items:
            product = getattr(item, "product", None)
            product_name = product.title if product else ""
            firestore_items.append({
                "productId":   str(item.product_id),
                "productName": product_name,
                "price":       float(item.price_paid or 0.0),
            })

        # vendorId: use the vendor from the first item's product (if available)
        first_vendor_id = ""
        if items:
            first_product = getattr(items[0], "product", None)
            if first_product and first_product.vendor_id:
                first_vendor_id = str(first_product.vendor_id)

        created_at_str = (
            order.created_at.isoformat()
            if order.created_at
            else datetime.now(timezone.utc).isoformat()
        )

        # Upsert the orders document.  ``merge=True`` ensures idempotency:
        # re-syncing the same order never creates a duplicate document.
        order_id_str = f"ORD-{order.id}"
        doc_ref = db.collection("orders").document(order_id_str)
        doc_ref.set(
            {
                "orderId":       order_id_str,
                "userId":        str(order.user_id),
                "vendorId":      first_vendor_id,
                "items":         firestore_items,
                "totalAmount":   float(order.total_amount or 0.0),
                "status":        order.status or "completed",
                "paymentMethod": order.payment_method or "",
                "createdAt":     created_at_str,
            },
            merge=True,
        )

    except Exception as e:
        print(f"[firestore-sync] Error syncing order {order.id} to Firestore: {e}")

def restore_sqlite_products_from_firestore(db_session):
    """
    Safe recovery logic: Restore published products from Firestore to SQLite
    in case the SQLite database was reset.
    Rules: Only restore active, published products (status == 'published').
    Avoid duplicates by checking if the product ID already exists in SQLite.
    """
    if not firebase_connected or db is None:
        return
    try:
        from app.models.product import Product as ProductModel
        docs = db.collection("products").where("status", "==", "published").stream()
        count = 0
        for doc in docs:
            data = doc.to_dict()
            try:
                prod_id = int(doc.id)
            except ValueError:
                continue
            # Check for existing product to prevent duplicate key constraint failure
            exists = db_session.query(ProductModel).filter(ProductModel.id == prod_id).first()
            if not exists:
                product = ProductModel(
                    id=prod_id,
                    title=data.get("title", data.get("name", "Product")),
                    description=data.get("description", ""),
                    category=data.get("category", "General"),
                    price=float(data.get("price", 0.0)),
                    rating=float(data.get("rating", 5.0)),
                    reviews=int(data.get("reviews", 0)),
                    downloads=int(data.get("downloads", 0)),
                    thumbnail=data.get("thumbnail"),
                    preview=data.get("preview"),
                    file_url=data.get("file_url", data.get("fileUrl")),
                    seller=data.get("creatorName", data.get("seller", "Creator")),
                    vendor_id=data.get("vendor_id"),
                    featured=bool(data.get("featured", data.get("isFeatured", False))),
                    trending=bool(data.get("trending", False)),
                    new_arrival=bool(data.get("new_arrival", False)),
                    badge=data.get("badge"),
                    status=data.get("status", "published"),
                    tags=data.get("tags", []),
                    highlights=data.get("highlights", []),
                    version=data.get("version", "v1.0.0"),
                    file_size=data.get("fileSize", "48 MB"),
                    last_updated=data.get("last_updated", "Recently"),
                    license=data.get("license", "Personal Use"),
                    affiliate_enabled=bool(data.get("affiliate_enabled", False)),
                    commission_type=data.get("commission_type", "percentage"),
                    commission_value=float(data.get("commission_value", 0.0)),
                    short_desc=data.get("shortDesc", data.get("short_desc")),
                    features=data.get("features", []),
                    system_requirements=data.get("systemRequirements", data.get("system_requirements", [])),
                    what_you_get=data.get("whatYouGet", data.get("what_you_get", [])),
                    installation_guide=data.get("installationGuide", data.get("installation_guide")),
                    subcategory=data.get("subcategory"),
                    discount=float(data.get("discount", 0.0)),
                    preview_images=data.get("previewImages", data.get("preview_images", [])),
                    preview_video=data.get("previewVideo", data.get("preview_video")),
                    seo_title=data.get("seoTitle", data.get("seo_title")),
                    seo_description=data.get("seoDescription", data.get("seo_description")),
                    visibility=data.get("visibility", "public"),
                )
                db_session.add(product)
                count += 1
        db_session.commit()
        print(f"[firestore-sync] Successfully restored {count} products from Firestore to SQLite.")
    except Exception as e:
        db_session.rollback()
        print(f"[firestore-sync] Error recovering products from Firestore: {e}")

