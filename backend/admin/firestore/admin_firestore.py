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

def sync_order_to_firestore(order, db_session):
    if not firebase_connected or db is None:
        return
    try:
        from app.models.user import User as UserModel
        from app.models.product import Product as ProductModel
        from app.models.affiliate import AffiliateCommission as AffiliateCommissionModel, AffiliateProfile
        
        # 1. Fetch customer info
        customer = db_session.query(UserModel).filter(UserModel.id == order.user_id).first()
        customer_name = customer.name if customer else "Customer"
        customer_email = customer.email if customer else ""
        
        # 2. Map items
        firestore_items = []
        vendor_ids = []
        created_at_str = order.created_at.isoformat() + "Z" if order.created_at else datetime.now(timezone.utc).isoformat() + "Z"
        
        for item in order.items:
            prod = db_session.query(ProductModel).filter(ProductModel.id == item.product_id).first()
            if prod:
                p_name = prod.title
                p_preview = prod.preview or prod.thumbnail or ""
                v_id = str(prod.vendor_id) if prod.vendor_id else ""
                file_url = prod.file_url or ""
            else:
                p_name = "Product"
                p_preview = ""
                v_id = ""
                file_url = ""
                
            if v_id and v_id not in vendor_ids:
                vendor_ids.append(v_id)
                
            firestore_items.append({
                "productId": str(item.product_id),
                "productName": p_name,
                "preview": p_preview,
                "vendorId": v_id,
                "price": float(item.price_paid or 0.0),
                "snapshot": {"title": p_name, "price": float(item.price_paid or 0.0), "preview": p_preview}
            })
            
            # --- Write to purchases collection ---
            purchase_ref = db.collection("purchases").document()
            purchase_ref.set({
                "userId": str(order.user_id),
                "productId": str(item.product_id),
                "productName": p_name,
                "preview": p_preview,
                "price": float(item.price_paid or 0.0),
                "purchaseDate": created_at_str,
                "createdAt": created_at_str,
                "accessStatus": "active"
            })
            
            # --- Write to downloads collection ---
            download_id = f"{order.user_id}_{item.product_id}"
            db.collection("downloads").document(download_id).set({
                "userId": str(order.user_id),
                "productId": str(item.product_id),
                "productName": p_name,
                "downloadCount": 0,
                "file_url": file_url,
                "downloadedAt": ""
            })
            
            # --- Write to vendorNotifications ---
            if v_id:
                notif_ref = db.collection("vendorNotifications").document()
                notif_ref.set({
                    "vendorId": v_id,
                    "orderId": f"ORD-{order.id}",
                    "buyerId": str(order.user_id),
                    "buyerName": customer_name,
                    "productId": str(item.product_id),
                    "productName": p_name,
                    "amount": float(item.price_paid or 0.0),
                    "type": "sale",
                    "read": False,
                    "createdAt": created_at_str
                })
                
                # --- Update vendorStats ---
                stats_ref = db.collection("vendorStats").document(v_id)
                stats_doc = stats_ref.get()
                if stats_doc.exists:
                    stats_ref.update({
                        "totalSales": firestore.Increment(1),
                        "totalRevenue": firestore.Increment(float(item.price_paid or 0.0)),
                        "lastUpdated": created_at_str
                    })
                else:
                    stats_ref.set({
                        "totalSales": 1,
                        "totalRevenue": float(item.price_paid or 0.0),
                        "lastUpdated": created_at_str
                    })
            
        first_vendor_id = vendor_ids[0] if vendor_ids else ""
        
        # 3. Write document to Firestore orders
        doc_ref = db.collection("orders").document(str(order.id))
        doc_ref.set({
            "orderId": f"ORD-{order.id}",
            "customerId": str(order.user_id),
            "customerName": customer_name,
            "customerEmail": customer_email,
            "items": firestore_items,
            "totalUSD": float(order.total_amount or 0.0),
            "totalINR": float(order.total_amount or 0.0) * 83.0,
            "price": float(order.total_amount or 0.0),
            "status": order.status or "completed",
            "paymentStatus": "Paid" if (order.status or "").lower() == "completed" else "Pending",
            "paymentMethod": order.payment_method or "upi",
            "vendorId": first_vendor_id,
            "region": getattr(order, 'billing_region', None) or "India",
            "created_at": created_at_str,
            "createdAt": created_at_str
        }, merge=True)
        
        # 4. Sync affiliate conversions from SQLite AffiliateCommissions
        commissions = db_session.query(AffiliateCommissionModel).filter(
            AffiliateCommissionModel.order_id == order.id
        ).all()
        
        for comm in commissions:
            aff_profile = db_session.query(AffiliateProfile).filter(
                AffiliateProfile.id == comm.affiliate_id
            ).first()
            if aff_profile:
                conv_id = f"COMM-{comm.id}"
                db.collection("affiliateConversions").document(conv_id).set({
                    "affiliateId": str(aff_profile.user_id),
                    "affiliateCode": aff_profile.referral_code,
                    "orderId": f"ORD-{order.id}",
                    "productId": str(comm.product_id),
                    "productName": comm.product_name,
                    "saleAmount": float(comm.sale_amount),
                    "commissionAmount": float(comm.commission_amt),
                    "status": comm.status or "pending",
                    "createdAt": created_at_str,
                    "buyerName": customer_name
                })
                
    except Exception as e:
        print(f"[firestore-sync] Error syncing order {order.id} to Firestore: {e}")
