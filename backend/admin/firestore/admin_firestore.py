from app.shared.firebase.connection import db, firebase_connected
from firebase_admin import firestore
from datetime import datetime, timezone
import logging

_logger = logging.getLogger(__name__)

def sync_product_to_firestore(product):
    if not firebase_connected or db is None:
        return
    try:
        # Resolve media urls using ProductService helper before syncing to Firestore
        from app.services.product_service import ProductService
        from app.db.session import SessionLocal
        temp_db = SessionLocal()
        try:
            # resolve_product_media expunges the product and returns a detached copy
            # so we don't pollute the active db session
            resolved_product = ProductService.resolve_product_media(product, temp_db)
        except Exception:
            resolved_product = product
        finally:
            temp_db.close()

        tags = resolved_product.tags if isinstance(resolved_product.tags, list) else []
        highlights = resolved_product.highlights if isinstance(resolved_product.highlights, list) else []
        
        # Resolve thumbnail: prefer real non-Unsplash URL, fall back to image_urls[0],
        # then preview_images[0]. Never store Unsplash placeholders in Firestore.
        image_urls_list = resolved_product.image_urls if isinstance(resolved_product.image_urls, list) else []
        preview_images_list = resolved_product.preview_images if isinstance(resolved_product.preview_images, list) else []

        def _best_image(primary):
            if primary and "unsplash.com" not in primary:
                return primary
            if image_urls_list:
                return image_urls_list[0]
            if preview_images_list:
                return preview_images_list[0]
            return None

        doc_ref = db.collection("products").document(str(resolved_product.id))
        doc_ref.set({
            "title": resolved_product.title,
            "name": resolved_product.title,
            "description": resolved_product.description or "",
            "shortDesc": resolved_product.short_desc or (resolved_product.description[:150] if resolved_product.description else "Premium digital assets"),
            "short_desc": resolved_product.short_desc or "",
            "category": resolved_product.category or "General",
            "price": float(resolved_product.price or 0.0),
            "rating": float(resolved_product.rating or 5.0),
            "reviews": int(resolved_product.reviews or 0),
            "review_count": int(resolved_product.reviews or 0),
            "downloads": int(resolved_product.downloads or 0),
            # -- Image URLs ------------------------------------------------------
            "thumbnail": _best_image(resolved_product.thumbnail),
            "preview": _best_image(resolved_product.preview),
            "imageUrl": _best_image(resolved_product.thumbnail),   # alias used by some customer views
            "creatorName": (resolved_product.seller or "Lumora").strip() or "Lumora",
            "creatorAvatar": (
                resolved_product.creator_avatar
                if getattr(resolved_product, "creator_avatar", None) and "unsplash.com" not in resolved_product.creator_avatar
                else None
            ),
            "featured": bool(resolved_product.featured),
            "isFeatured": bool(resolved_product.featured),
            "status": resolved_product.status or "published",
            "tags": tags,
            # -- Features & specs (single occurrence of each key) ----------------
            "highlights": highlights,
            "features": resolved_product.features if isinstance(resolved_product.features, list) else [],
            "systemRequirements": resolved_product.system_requirements if isinstance(resolved_product.system_requirements, list) else [],
            "system_requirements": resolved_product.system_requirements if isinstance(resolved_product.system_requirements, list) else [],
            "whatYouGet": resolved_product.what_you_get if isinstance(resolved_product.what_you_get, list) else [],
            "what_you_get": resolved_product.what_you_get if isinstance(resolved_product.what_you_get, list) else [],
            "installationGuide": resolved_product.installation_guide or "",
            "installation_guide": resolved_product.installation_guide or "",
            # -- Metadata --------------------------------------------------------
            "version": resolved_product.version or "v1.0.0",
            "fileSize": resolved_product.file_size or "48 MB",
            "createdAt": resolved_product.created_at.isoformat() + "Z" if resolved_product.created_at else datetime.now(timezone.utc).isoformat() + "Z",
            "updatedAt": (resolved_product.updated_at.isoformat() + "Z" if resolved_product.updated_at else datetime.now(timezone.utc).isoformat() + "Z"),
            "vendor_id": str(resolved_product.vendor_id) if resolved_product.vendor_id else None,
            "subcategory": resolved_product.subcategory or "",
            "discount": float(resolved_product.discount or 0.0),
            # -- Gallery arrays --------------------------------------------------
            "image_urls": image_urls_list,
            "previewImages": image_urls_list if image_urls_list else preview_images_list,
            "preview_images": preview_images_list,
            "previewVideo": resolved_product.preview_video or "",
            # -- SEO -------------------------------------------------------------
            "seoTitle": resolved_product.seo_title or "",
            "seoDescription": resolved_product.seo_description or "",
            "visibility": resolved_product.visibility or "public",
            "license": resolved_product.license or "Personal Use",
            # -- Affiliate -------------------------------------------------------
            "affiliate_enabled": bool(resolved_product.affiliate_enabled),
            "commission_type": resolved_product.commission_type or "percentage",
            "commission_value": float(resolved_product.commission_value or 0.0),
            "pcloud_download_link": None,
            "pcloudDownloadLink": None,
            "file_url": resolved_product.file_url or None,
            "fileUrl": resolved_product.file_url or None,
            # -- Integer primary key ---------------------------------------------
            "product_id": int(resolved_product.id),
        }, merge=True)
        _logger.info("[firestore-sync] Product %s synced to Firestore (status=%s)", resolved_product.id, resolved_product.status)
    except Exception as e:
        _logger.error("[firestore-sync] ERROR syncing product %s to Firestore: %s", product.id, e, exc_info=True)
        # Do NOT re-raise - SQLite is the canonical source of truth.
        # Log the error clearly so operators can detect and investigate failures.

def delete_product_from_firestore(product_id: int) -> dict:
    """
    Delete a product document from Firestore.

    Checks for cross-collection references (orders, reviews, downloads) and
    logs them as warnings, but ALWAYS deletes the product document.  Referential
    integrity in Firestore is informational - SQLite is the canonical source and
    the admin has authority to delete.

    Returns:
        {"deleted": True, "references": [...]}    - deleted, references logged
        {"deleted": False, "reason": "..."}        - Firestore unavailable or exception
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

        # Always delete - admin has authority; references are logged above
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
        # Silently swallow quota/offline errors - platform settings are non-critical.
        # Caller falls back to local state or defaults.
        pass
    return {}

def sync_order_to_firestore(order):
    """
    Sync a SQLite order to the Firestore ``orders`` collection.

    The document shape matches what every admin page (Dashboard, Analytics,
    Orders Management, Payments) expects.  Uses ``set(..., merge=True)`` keyed
    on ``orderId`` so calling this function multiple times with the same order
    is idempotent - subsequent calls update the existing document rather than
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
    Disabled pCloud direct link fetching.
    """
    return False


def restore_sqlite_products_from_firestore(db_session):
    """
    Safety-hardened startup restore: Insert Firestore products that are
    completely absent from PostgreSQL.

    CRITICAL RULE (2026-07):
    ========================
    PostgreSQL is the SINGLE SOURCE OF TRUTH.
    Backblaze B2 is the ONLY supported object storage.

    This function NEVER overwrites existing PostgreSQL product records.
    - storage_path, file_url, thumbnail, preview, image_urls, preview_images,
      price, title, description — ALL are preserved from PostgreSQL.
    - If a product already exists in PostgreSQL with any data at all,
      it is left completely untouched.
    - Only products with no PostgreSQL row at all are inserted (from Firestore),
      and ONLY so that a product that was created before this Render deployment
      doesn't disappear completely.

    Do NOT revert this protection. Reverting it will cause every Render
    restart to overwrite real B2 storage references with stale Firestore data.
    """
    if not firebase_connected or db is None:
        return
    try:
        from app.models.product import Product as ProductModel

        docs = db.collection("products").where("status", "==", "published").stream()
        added = 0

        for doc in docs:
            data = doc.to_dict()
            try:
                prod_id = int(doc.id)
            except ValueError:
                continue

            exists = db_session.query(ProductModel).filter(ProductModel.id == prod_id).first()

            # ── EXISTING PRODUCT ── Never touch it. PostgreSQL owns the data. ──
            if exists:
                # Log at DEBUG level only so the log isn't noisy on every restart.
                _logger.debug(
                    "[firestore-sync] Product %s already in PostgreSQL — skipping Firestore overwrite (PG is source of truth)",
                    prod_id,
                )
                continue

            # ── NEW PRODUCT ── Not in PostgreSQL at all → safe to insert ───────
            thumbnail   = data.get("thumbnail") or data.get("imageUrl", "")
            is_broken_thumb = thumbnail and "localhost" in thumbnail

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
                file_url=data.get("file_url") or data.get("fileUrl"),
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
                image_urls=[] if is_broken_thumb else (data.get("image_urls") or data.get("imageUrls") or []),
            )
            db_session.add(product)
            db_session.flush()
            added += 1
            _logger.info("[firestore-sync] Inserted missing product %s from Firestore into PostgreSQL", prod_id)

        db_session.commit()
        if added:
            _logger.info("[firestore-sync] Inserted %d missing product(s) from Firestore into PostgreSQL.", added)
        else:
            _logger.info("[firestore-sync] PostgreSQL is up to date — no missing products found in Firestore.")

    except Exception as e:
        db_session.rollback()
        _logger.error("[firestore-sync] Error during Firestore restore: %s", e)
        import traceback
        traceback.print_exc()





# -- Team Management Firestore Sync --------------------------------------------
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

        # Also sync role to users/{firebase_uid} collection in Firestore so that
        # Firestore rules (isAdmin()) and AuthContext role check resolve correctly.
        if user.firebase_uid:
            user_doc_ref = db.collection("users").document(user.firebase_uid)
            user_snap = user_doc_ref.get()
            if user_snap.exists:
                user_data = user_snap.to_dict() or {}
                roles = user_data.get("roles", [])
                is_active = role_record.is_active if role_record else True
                
                if is_active:
                    # Activate admin role
                    if "admin" not in roles:
                        roles.append("admin")
                    user_doc_ref.update({
                        "role": "admin",
                        "roles": roles
                    })
                else:
                    # Deactivate admin role: fall back to customer (or another non-admin role if they have one)
                    if "admin" in roles:
                        roles.remove("admin")
                    fallback_role = "customer"
                    for r in roles:
                        if r in ("vendor", "affiliate", "customer"):
                            fallback_role = r
                            break
                    user_doc_ref.update({
                        "role": fallback_role,
                        "roles": roles
                    })
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
    Only super_admins read this collection - no ACL changes needed here.
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
