from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.affiliate import AffiliateProfile, AffiliateCommission, ReferralLink, ReferralAttribution
from app.models.user import User
from app.services.notification_service import NotificationService
from app.services.activity_log_service import ActivityLogService
from admin.firestore.admin_firestore import sync_order_to_firestore

class PurchaseService:
    @staticmethod
    def process_purchase(
        db: Session,
        user_id: int,
        items_payload: List[Dict[str, Any]],
        total_amount: float,
        payment_method: str = "upi",
        promo_code: Optional[str] = None,
        discount_amount: float = 0.0,
        affiliate_code: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Order:
        """
        Create an order and fulfil everything atomically.

        Called by:
            - PaymentService.confirm_payment()  (primary path - payment verified first)
            - POST /api/orders/                 (legacy path - for backward compatibility)

        Does NOT touch Payment records. Payment lifecycle is owned by PaymentService.
        Does NOT verify gateway signatures. That is done before this call.

        The caller is responsible for committing or rolling back the session.
        """
        try:
            # 1. Fetch customer details
            customer = db.query(User).filter(User.id == user_id).first()
            if not customer:
                raise HTTPException(status_code=404, detail="Customer user not found")

            # 2. Create the Order
            order = Order(
                user_id=user_id,
                total_amount=total_amount,
                payment_method=payment_method,
                status="completed",  # Paid and verified - order is complete
                notes=notes,
            )
            db.add(order)
            db.flush()  # Populate order.id

            # Track vendor notifications to process later
            vendors_to_notify = []

            # 5. Create OrderItems & permissions
            for item in items_payload:
                prod_id = item["product_id"]
                price_paid = item["price_paid"]
                
                from app.utils.db_sync import get_product_by_id
                prod = get_product_by_id(db, prod_id)
                if not prod:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Product ID {prod_id} not found."
                    )
                
                # Check soft-deleted status
                if prod.status == "archived":
                    raise HTTPException(
                        status_code=400,
                        detail=f"Product '{prod.title}' is archived and no longer available for purchase."
                    )

                # Set download url to secure proxy endpoint
                # Will generate token dynamically when calling GET /orders/me
                order_item = OrderItem(
                    order_id=order.id,
                    product_id=prod.id,
                    price_paid=price_paid,
                    download_url=f"/api/products/{prod.id}/download"
                )
                db.add(order_item)

                # NOTE: Download count will be incremented when user actually downloads the file
                # via the /download-file endpoint to track real usage, not just purchases

                # Update vendor sales count dynamically
                if prod.vendor_id:
                    from app.models.vendor import Vendor
                    vendor = db.query(Vendor).filter(Vendor.id == prod.vendor_id).first()
                    if vendor:
                        try:
                            current_sales = int(vendor.sales or "0")
                        except ValueError:
                            current_sales = 0
                        vendor.sales = str(current_sales + 1)
                        db.add(vendor)

                # Log notification details for vendor
                if prod.vendor_id:
                    vendors_to_notify.append({
                        "vendor_id": prod.vendor_id,
                        "product_name": prod.title,
                        "amount": price_paid
                    })

                # 6. Generate Affiliate Commissions
                if affiliate_code and getattr(prod, "affiliate_enabled", True) is not False:
                    clean_code = affiliate_code.strip().upper()
                    ref_link_obj = None
                    # 6a. First search default profile code
                    aff = db.query(AffiliateProfile).filter(
                        AffiliateProfile.referral_code == clean_code,
                        AffiliateProfile.is_active == True
                    ).first()

                    # 6b. Fallback: search custom product referral links
                    if not aff:
                        ref_link_obj = db.query(ReferralLink).filter(
                            ReferralLink.referral_code == clean_code,
                            ReferralLink.is_active == True
                        ).first()
                        if ref_link_obj and ref_link_obj.affiliate and ref_link_obj.affiliate.is_active:
                            aff = ref_link_obj.affiliate

                    if aff:
                        ref_link_id = ref_link_obj.id if ref_link_obj else None
                        # Tag Order with referral metadata
                        order.affiliate_id = aff.id
                        order.referral_link_id = ref_link_id
                        order.referral_code_used = clean_code

                        # Verify customer is not the affiliate itself (prevent self-referral)
                        if aff.user_id != user_id:
                            # Calculate commission
                            comm_type = prod.commission_type or "percentage"
                            if comm_type == "fixed":
                                comm_rate = prod.commission_value if prod.commission_value else 0.0
                                commission_amt = min(comm_rate, price_paid)
                            else: # percentage
                                comm_rate = prod.commission_value if prod.commission_value else (aff.commission_rate or 20.0)
                                commission_amt = (price_paid * comm_rate) / 100.0
                            
                            now_time = datetime.utcnow()
                            
                            # 6c. Insert immutable ReferralAttribution record
                            attribution = ReferralAttribution(
                                order_id=order.id,
                                customer_id=user_id,
                                affiliate_id=aff.id,
                                affiliate_code=clean_code,
                                referral_link_id=ref_link_id,
                                product_id=prod.id,
                                status="attributed",
                                created_at=now_time
                            )
                            db.add(attribution)
                            db.flush()

                            # 6d. Insert AffiliateCommission
                            comm = AffiliateCommission(
                                affiliate_id=aff.id,
                                order_id=order.id,
                                product_id=prod.id,
                                product_name=prod.title,
                                sale_amount=price_paid,
                                commission_amt=commission_amt,
                                status="approved",
                                commission_status="approved",
                                commission_type=comm_type,
                                commission_rate=comm_rate,
                                customer_name=customer.name if customer else "Customer",
                                customer_email=customer.email if customer else None,
                                cookie_attr_date=now_time,
                                last_click_at=now_time,
                                approved_at=now_time,
                                referral_attribution_id=attribution.id,
                                referral_link_id=ref_link_id
                            )
                            db.add(comm)
                            
                            # Update affiliate stats
                            aff.total_earnings = (aff.total_earnings or 0.0) + commission_amt
                            aff.pending_earnings = (aff.pending_earnings or 0.0) + commission_amt
                            aff.total_sales = (aff.total_sales or 0) + 1
                            aff.last_active_at = now_time

                            # Send Affiliate Notifications
                            NotificationService.create_notification(
                                db=db,
                                user_id=aff.user_id,
                                title="Commission Earned! 🎉",
                                message=f"You earned a commission of ₹{commission_amt:.2f} (referred purchase of '{prod.title}').",
                                category="commission"
                            )

                            # Log Affiliate Activity
                            ActivityLogService.log_user_activity(
                                db=db,
                                user_id=aff.user_id,
                                activity_type="commission_earned",
                                details=f"Earned ₹{commission_amt:.2f} commission from order ORD-{order.id} for product '{prod.title}'."
                            )

            # 6b. Process Admin Referral Link Conversion (Isolated, Idempotent, Non-Blocking)
            if affiliate_code:
                try:
                    from admin_controls.referral.service import process_admin_referral
                    # Pass 'aff' (if found above) to avoid duplicate SQL query
                    process_admin_referral(
                        db=db,
                        order=order,
                        user_id=user_id,
                        affiliate_code=affiliate_code,
                        affiliate_profile=locals().get('aff')
                    )
                except Exception as _admin_ref_exc:
                    import logging
                    logging.getLogger(__name__).error("[PurchaseService] Non-fatal admin referral error: %s", _admin_ref_exc)

            # 7. Generate User notifications

            # Customer Notification
            NotificationService.create_notification(
                db=db,
                user_id=user_id,
                title="Purchase Confirmed ?",
                message=f"Thank you for your purchase! Order ORD-{order.id} for ?{total_amount:.2f} is now active. Access assets via your vault.",
                category="purchase"
            )

            NotificationService.create_notification(
                db=db,
                user_id=user_id,
                title="Payment Success ?",
                message=f"Payment receipt for order ORD-{order.id} of ?{total_amount:.2f} has been verified successfully.",
                category="payment"
            )

            NotificationService.create_notification(
                db=db,
                user_id=user_id,
                title="Download Ready ?",
                message=f"Your purchase items from order ORD-{order.id} are now ready for download in your vault.",
                category="download"
            )

            # Vendor Notifications
            for v_info in vendors_to_notify:
                NotificationService.create_vendor_sale_notification(
                    db=db,
                    vendor_firebase_uid=v_info["vendor_id"],
                    buyer_name=customer.name,
                    product_name=v_info["product_name"],
                    amount=v_info["amount"],
                    order_id=f"ORD-{order.id}"
                )

            # 8. Create Activity Logs
            ActivityLogService.log_user_activity(
                db=db,
                user_id=user_id,
                activity_type="purchase",
                details=f"Completed purchase for order ORD-{order.id} containing {len(items_payload)} items."
            )

            db.flush() # Ensure all IDs populated

            # 9. Sync to Firestore (Read-Only Mirror)
            sync_order_to_firestore(order)

            return order

        except Exception as e:
            # Explicit rollback on any exception
            db.rollback()
            raise e


def uuid_generator() -> str:
    import uuid
    return uuid.uuid4().hex[:12]
