from app.shared.firebase.connection import db, firebase_connected
from firebase_admin import firestore
from datetime import datetime, timezone
import logging

_logger = logging.getLogger(__name__)

def sync_product_to_firestore(product):
    if not firebase_connected or db is None:
        return
    try:
        tags = product.tags if isinstance(product.tags, list) else []
        highlights = product.highlights if isinstance(product.highlights, list) else []
        
        # Resolve thumbnail: prefer real non-Unsplash URL, fall back to image_urls[0],
        # then preview_images[0]. Never store Unsplash placeholders in Firestore.
        image_urls_list = product.image_urls if isinstance(product.image_urls, list) else []
        preview_images_list = product.preview_images if isinstance(product.preview_images, list) else []

        def _best_image(primary):
            if primary and "unsplash.com" not in primary:
                return primary
            if image_urls_list:
                return image_urls_list[0]
            if preview_images_list:
                return preview_images_list[0]
            return None

        doc_ref = db.collection("products").document(str(product.id))
        doc_ref.set({
            "title": product.title,
            "name": product.title,
            "description": product.description or "",
            "shortDesc": product.short_desc or (product.description[:150] if product.description else "Premium digital assets"),
            "short_desc": product.short_desc or "",
            "category": product.category or "General",
            "price": float(product.price or 0.0),
            "rating": float(product.rating or 5.0),
            "reviews": int(product.reviews or 0),
            "review_count": int(product.reviews or 0),
            "downloads": int(product.downloads or 0),
            # ── Image URLs ──────────────────────────────────────────────────────
            "thumbnail": _best_image(product.thumbnail),
            "preview": _best_image(product.preview),
            "imageUrl": _best_image(product.thumbnail),   # alias used by some customer views
            "creatorName": (product.seller or "Lumora").strip() or "Lumora",
            "creatorAvatar": (
                product.creator_avatar
                if getattr(product, "creator_avatar", None) and "unsplash.com" not in product.creator_avatar
                else None
            ),
            "featured": bool(product.featured),
            "isFeatured": bool(product.featured),
            "status": product.status or "published",
            "tags": tags,
            # ── Features & specs (single occurrence of each key) ────────────────
            "highlights": highlights,
            "features": product.features if isinstance(product.features, list) else [],
            "systemRequirements": product.system_requirements if isinstance(product.system_requirements, list) else [],
            "system_requirements": product.system_requirements if isinstance(product.system_requirements, list) else [],
            "whatYouGet": product.what_you_get if isinstance(product.what_you_get, list) else [],
            "what_you_get": product.what_you_get if isinstance(product.what_you_get, list) else [],
            "installationGuide": product.installation_guide or "",
            "installation_guide": product.installation_guide or "",
            # ── Metadata ────────────────────────────────────────────────────────
            "version": product.version or "v1.0.0",
            "fileSize": product.file_size or "48 MB",
            "createdAt": product.created_at.isoformat() + "Z" if product.created_at else datetime.now(timezone.utc).isoformat() + "Z",
            "updatedAt": (product.updated_at.isoformat() + "Z" if product.updated_at else datetime.now(timezone.utc).isoformat() + "Z"),
            "vendor_id": str(product.vendor_id) if product.vendor_id else None,
            "subcategory": product.subcategory or "",
            "discount": float(product.discount or 0.0),
            # ── Gallery arrays ──────────────────────────────────────────────────
            "image_urls": image_urls_list,
            "previewImages": image_urls_list if image_urls_list else preview_images_list,
            "preview_images": preview_images_list,
            "previewVideo": product.preview_video or "",
            # ── SEO ─────────────────────────────────────────────────────────────
            "seoTitle": product.seo_title or "",
            "seoDescription": product.seo_description or "",
            "visibility": product.visibility or "public",
            "license": product.license or "Personal Use",
            # ── Affiliate ───────────────────────────────────────────────────────
            "affiliate_enabled": bool(product.affiliate_enabled),
            "commission_type": product.commission_type or "percentage",
            "commission_value": float(product.commission_value or 0.0),
            # ── Download URLs — both naming conventions for full compatibility ──
            "pcloud_download_link": product.pcloud_download_link,
            "pcloudDownloadLink": product.pcloud_download_link,
            "file_url": product.file_url or None,
            "fileUrl": product.file_url or None,
            # ── Integer primary key ─────────────────────────────────────────────
            "product_id": int(product.id),
        }, merge=True)
        _logger.info("[firestore-sync] Product %s synced to Firestore (status=%s)", product.id, product.status)
    except Exception as e:
        _logger.error("[firestore-sync] ERROR syncing product %s to Firestore: %s", product.id, e, exc_info=True)
        # Do NOT re-raise — SQLite is the canonical source of truth.
        # Log the error clearly so operators can detect and investigate failures.

def delete_product_from_firestore(product_id: int) -> dict:
    """
    Delete a product document from Firestore.

    Checks for cross-collection references (orders, reviews, downloads) and
    logs them as warnings, but ALWAYS deletes the product document.  Referential
    integrity in Firestore is informational — SQLite is the canonical source and
    the admin has authority to delete.

    Returns:
        {"deleted": True, "references": [...]}    — deleted, references logged
        {"deleted": False, "reason": "..."}        — Firestore unavailable or exception
    """
    if not firebase_connected or db is None:
        return {"deleted": False, "reason": "firestore_unavailable", "references": []}
    try:
        pid = str(product_id)
        references = []

        # Check orders collection (items array contains productId)
        for doc in db.collection("orders").stream():
            data = doc.to_dict() or {}
            items = data.get("items", [])
            if any(str(item.get("productId", "")) == pid for item in items):
                references.append({"collection": "orders", "doc_id": doc.id})

        # Check reviews
        for doc in db.collection("reviews").where("productId", "==", pid).stream():
            references.append({"collection": "reviews", "doc_id": doc.id})

        # Check downloads
        for doc in db.collection("downloads").where("productId", "==", pid).stream():
            references.append({"collection": "downloads", "doc_id": doc.id})

        if references:
            _logger.warning(
                "[firestore-sync] Deleting product %s which has %d cross-collection references: %s",
                product_id, len(references), references,
            )

        # Always delete — admin has authority; references are logged above
        db.collection("products").document(pid).delete()
        _logger.info("[firestore-sync] Product %s deleted from Firestore", product_id)
        return {"deleted": True, "references": references}
    except Exception as e:
        _logger.error("[firestore-sync] ERROR deleting product %s from Firestore: %s", product_id, e, exc_info=True)
        return {"deleted": False, "reason": "exception", "references": []}

def get_platform_settings():
    if not firebase_connected or db is None:
        return {}
    try:
        doc_ref = db.collection("platformSettings").document("global")
        snap = doc_ref.get()
        if snap.exists:
            return snap.to_dict()
    except Exception:
        # Silently swallow quota/offline errors — platform settings are non-critical.
        # Caller falls back to local state or defaults.
        pass
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

def _refresh_pcloud_images_for_product(product_model, pcloud_share_url: str) -> bool:
    """
    Fetch fresh direct p-lux pCloud image URLs from a shared folder.
    Returns True if images were updated, False otherwise.
    """
    import urllib.request
    import json as _json

    def _extract_code(url):
        if not url or "code=" not in url:
            return None
        return url.split("code=")[1].split("&")[0].split("#")[0]

    def _get_files(code):
        req = urllib.request.Request(
            f"https://api.pcloud.com/showpublink?code={code}",
            headers={"User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            data = _json.loads(r.read().decode())
        if data.get("result") != 0:
            return {}
        return {f["name"]: f["fileid"] for f in data["metadata"].get("contents", []) if not f.get("isfolder")}

    def _get_link(code, fid):
        req = urllib.request.Request(
            f"https://api.pcloud.com/getpublinkdownload?code={code}&fileid={fid}",
            headers={"User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            data = _json.loads(r.read().decode())
        if data.get("result") == 0:
            hosts = data.get("hosts", [])
            path = data.get("path", "")
            if hosts and path:
                return f"https://{hosts[0]}{path}"
        return None

    try:
        code = _extract_code(pcloud_share_url)
        if not code:
            return False
        files = _get_files(code)
        if not files:
            return False

        png_files = [n for n in files if n.lower().endswith(".png")]
        if not png_files:
            return False

        def pick(names, kw):
            for n in names:
                if kw in n.lower():
                    return n
            return names[0] if names else None

        thumb_name    = pick(png_files, "thumbnail") or pick(png_files, "cover")
        cover_name    = pick(png_files, "cover")
        featured_name = pick(png_files, "featured")
        preview_name  = pick(png_files, "preview")

        fresh = {}
        for n in set(filter(None, [thumb_name, cover_name, featured_name, preview_name])):
            link = _get_link(code, files[n])
            if link:
                fresh[n] = link

        if not fresh:
            return False

        img_list = []
        for n in [cover_name, featured_name, preview_name, thumb_name]:
            if n and n in fresh and fresh[n] not in img_list:
                img_list.append(fresh[n])

        product_model.thumbnail  = fresh.get(thumb_name) or fresh.get(cover_name) or img_list[0]
        product_model.preview    = fresh.get(preview_name) or fresh.get(featured_name) or product_model.thumbnail
        product_model.image_urls = img_list or [product_model.thumbnail]
        return True
    except Exception as e:
        print(f"[firestore-sync] pCloud image refresh failed: {e}")
        return False


def restore_sqlite_products_from_firestore(db_session):
    """
    Auto-sync: Pull any published Firestore products missing from SQLite into SQLite.
    Also fixes broken localhost thumbnail URLs by refreshing them from pCloud.
    Runs at backend startup and can be called manually.
    """
    if not firebase_connected or db is None:
        return
    try:
        from app.models.product import Product as ProductModel

        docs = db.collection("products").where("status", "==", "published").stream()
        added = 0
        fixed = 0

        for doc in docs:
            data = doc.to_dict()
            try:
                prod_id = int(doc.id)
            except ValueError:
                continue

            exists = db_session.query(ProductModel).filter(ProductModel.id == prod_id).first()
            pcloud_link = data.get("pcloud_download_link") or data.get("pcloudDownloadLink")
            thumbnail   = data.get("thumbnail") or data.get("imageUrl", "")
            is_broken_thumb = thumbnail and "localhost" in thumbnail

            if not exists:
                # New product from Firestore — import it
                product = ProductModel(
                    id=prod_id,
                    title=data.get("title", data.get("name", "Product")),
                    description=data.get("description", ""),
                    category=data.get("category", "Productivity Tools"),
                    price=float(data.get("price", 0.0)),
                    rating=float(data.get("rating", 5.0)),
                    reviews=int(data.get("reviews", 0)),
                    downloads=int(data.get("downloads", 0)),
                    thumbnail=None if is_broken_thumb else thumbnail,
                    preview=None if is_broken_thumb else (data.get("preview") or thumbnail),
                    file_url=data.get("file_url") or data.get("fileUrl") or pcloud_link,
                    seller=data.get("creatorName", data.get("seller", "Lumora")),
                    vendor_id=data.get("vendor_id"),
                    featured=bool(data.get("featured", data.get("isFeatured", False))),
                    trending=bool(data.get("trending", False)),
                    new_arrival=True,
                    badge=data.get("badge"),
                    status="published",
                    visibility=data.get("visibility", "public"),
                    tags=data.get("tags") or [],
                    highlights=data.get("highlights") or [],
                    version=data.get("version", "v1.0.0"),
                    file_size=data.get("fileSize", "48 MB"),
                    last_updated="Recently",
                    license=data.get("license", "Personal Use"),
                    affiliate_enabled=bool(data.get("affiliate_enabled", False)),
                    commission_type=data.get("commission_type", "percentage"),
                    commission_value=float(data.get("commission_value", 0.0)),
                    short_desc=data.get("shortDesc") or data.get("short_desc") or "",
                    features=data.get("features") or [],
                    system_requirements=data.get("systemRequirements") or data.get("system_requirements") or [],
                    what_you_get=data.get("whatYouGet") or data.get("what_you_get") or [],
                    installation_guide=data.get("installationGuide") or data.get("installation_guide"),
                    subcategory=data.get("subcategory"),
                    discount=float(data.get("discount", 0.0)),
                    preview_images=data.get("previewImages") or data.get("preview_images") or [],
                    preview_video=data.get("previewVideo") or data.get("preview_video"),
                    seo_title=data.get("seoTitle") or data.get("seo_title"),
                    seo_description=data.get("seoDescription") or data.get("seo_description"),
                    pcloud_download_link=pcloud_link,
                    image_urls=[] if is_broken_thumb else (data.get("image_urls") or data.get("imageUrls") or []),
                )
                db_session.add(product)
                db_session.flush()  # get product into session so we can update it

                # Refresh pCloud images if thumbnail was broken or missing
                if pcloud_link and (is_broken_thumb or not product.thumbnail):
                    refreshed = _refresh_pcloud_images_for_product(product, pcloud_link)
                    if refreshed:
                        fixed += 1

                added += 1
            else:
                # Update existing product fields from Firestore
                exists.title = data.get("title", data.get("name", exists.title))
                exists.description = data.get("description", exists.description)
                exists.category = data.get("category", exists.category)
                exists.price = float(data.get("price", exists.price))
                exists.rating = float(data.get("rating", exists.rating))
                exists.reviews = int(data.get("reviews", exists.reviews))
                exists.downloads = int(data.get("downloads", exists.downloads))
                
                if not is_broken_thumb:
                    if thumbnail:
                        exists.thumbnail = thumbnail
                    if data.get("preview") or thumbnail:
                        exists.preview = data.get("preview") or thumbnail
                    if data.get("image_urls") or data.get("imageUrls"):
                        exists.image_urls = data.get("image_urls") or data.get("imageUrls") or []

                exists.file_url = data.get("file_url") or data.get("fileUrl") or pcloud_link or exists.file_url
                exists.seller = data.get("creatorName", data.get("seller", exists.seller))
                exists.vendor_id = data.get("vendor_id") or exists.vendor_id
                exists.featured = bool(data.get("featured", data.get("isFeatured", exists.featured)))
                exists.trending = bool(data.get("trending", exists.trending))
                exists.badge = data.get("badge", exists.badge)
                exists.visibility = data.get("visibility", exists.visibility)
                exists.tags = data.get("tags") or exists.tags
                exists.highlights = data.get("highlights") or exists.highlights
                exists.version = data.get("version", exists.version)
                exists.file_size = data.get("fileSize", exists.file_size)
                exists.license = data.get("license", exists.license)
                exists.affiliate_enabled = bool(data.get("affiliate_enabled", exists.affiliate_enabled))
                exists.commission_type = data.get("commission_type", exists.commission_type)
                exists.commission_value = float(data.get("commission_value", exists.commission_value))
                exists.short_desc = data.get("shortDesc") or data.get("short_desc") or exists.short_desc
                exists.features = data.get("features") or exists.features
                exists.system_requirements = data.get("systemRequirements") or data.get("system_requirements") or exists.system_requirements
                exists.what_you_get = data.get("whatYouGet") or data.get("what_you_get") or exists.what_you_get
                exists.installation_guide = data.get("installationGuide") or data.get("installation_guide") or exists.installation_guide
                exists.subcategory = data.get("subcategory") or exists.subcategory
                exists.discount = float(data.get("discount", exists.discount))
                exists.preview_images = data.get("previewImages") or data.get("preview_images") or exists.preview_images
                exists.preview_video = data.get("previewVideo") or data.get("preview_video") or exists.preview_video
                exists.seo_title = data.get("seoTitle") or data.get("seo_title") or exists.seo_title
                exists.seo_description = data.get("seoDescription") or data.get("seo_description") or exists.seo_description
                exists.pcloud_download_link = pcloud_link or exists.pcloud_download_link

                if pcloud_link and (is_broken_thumb or not exists.thumbnail):
                    refreshed = _refresh_pcloud_images_for_product(exists, pcloud_link)
                    if refreshed:
                        fixed += 1
                
                added += 1

        db_session.commit()
        if added:
            print(f"[firestore-sync] Auto-synced {added} products from Firestore to SQLite ({fixed} with refreshed images).")
        else:
            print("[firestore-sync] SQLite is up to date with Firestore.")

    except Exception as e:
        db_session.rollback()
        print(f"[firestore-sync] Error during Firestore sync: {e}")
        import traceback
        traceback.print_exc()




# ── Team Management Firestore Sync ────────────────────────────────────────────
# All three helpers are best-effort: they never raise and never block the
# SQLite commit that precedes them.

def _invitation_status(inv) -> str:
    """Compute invitation status string from model fields."""
    if getattr(inv, "revoked_at", None):
        return "revoked"
    if inv.accepted_at:
        return "accepted"
    now = datetime.now(timezone.utc)
    exp = inv.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now:
        return "expired"
    return "pending"


def sync_team_member_to_firestore(user, role_record) -> None:
    """
    Write / update an admin team member document in Firestore.
    Path: admin/team/members/{user.id}
    Called after: accept_invite, activate_admin, deactivate_admin, change_admin_role
    """
    if not firebase_connected or db is None:
        return
    try:
        doc_ref = db.collection("admin").document("team").collection("members").document(str(user.id))
        doc_ref.set({
            "user_id":      user.id,
            "name":         user.name or "",
            "email":        user.email or "",
            "role_level":   role_record.role_level if role_record else "admin",
            "is_active":    role_record.is_active if role_record else True,
            "activated_at": role_record.activated_at.isoformat() if role_record and role_record.activated_at else None,
            "last_login_at": user.last_login_at.isoformat() if getattr(user, "last_login_at", None) else None,
            "updated_at":   datetime.now(timezone.utc).isoformat(),
        }, merge=True)
    except Exception as e:
        print(f"[firestore-sync] Error syncing team member {user.id}: {e}")


def sync_invitation_to_firestore(invitation) -> None:
    """
    Write / update an admin invitation document in Firestore.
    Path: admin/team/invitations/{invitation.id}
    Called after: invite_admin, cancel_invitation (revoke), resend_invitation, accept_invite
    """
    if not firebase_connected or db is None:
        return
    try:
        status = _invitation_status(invitation)
        exp = invitation.expires_at
        if exp and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        doc_ref = db.collection("admin").document("team").collection("invitations").document(str(invitation.id))
        doc_ref.set({
            "id":           invitation.id,
            "email":        invitation.email,
            "invited_name": getattr(invitation, "invited_name", None),
            "role_level":   invitation.role_level,
            "status":       status,
            "expires_at":   exp.isoformat() if exp else None,
            "accepted_at":  invitation.accepted_at.isoformat() if invitation.accepted_at else None,
            "revoked_at":   invitation.revoked_at.isoformat() if getattr(invitation, "revoked_at", None) else None,
            "created_at":   invitation.created_at.isoformat() if invitation.created_at else None,
        }, merge=True)
    except Exception as e:
        print(f"[firestore-sync] Error syncing invitation {invitation.id}: {e}")


def write_admin_notification_to_firestore(user, invitation) -> None:
    """
    Write a new admin notification when a team member accepts an invitation.
    Path: admin/notifications/{uuid}
    Only super_admins read this collection — no ACL changes needed here.
    """
    if not firebase_connected or db is None:
        return
    try:
        import uuid as _uuid
        notif_id = _uuid.uuid4().hex
        doc_ref = db.collection("admin").document("notifications").collection("items").document(notif_id)
        doc_ref.set({
            "type":          "invite_accepted",
            "actor_email":   user.email or "",
            "actor_name":    user.name or user.email or "",
            "role_level":    invitation.role_level,
            "invitation_id": invitation.id,
            "created_at":    datetime.now(timezone.utc).isoformat(),
            "read":          False,
        })
    except Exception as e:
        print(f"[firestore-sync] Error writing admin notification: {e}")
