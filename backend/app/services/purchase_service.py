from typing import List, Dict, Any, Optional, cast
from datetime import datetime, timezone
import logging
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.affiliate import AffiliateProfile, AffiliateCommission, ReferralLink, ReferralAttribution, AffiliateReferral
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
        request: Optional[Any] = None,
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

            # Extract client metadata
            from app.utils.ip_utils import get_client_ip, parse_user_agent
            req_ip = get_client_ip(request) if request else "Not Available"
            ua_header = request.headers.get("user-agent") if (request and hasattr(request, "headers")) else None
            dev_type, browser_name = parse_user_agent(ua_header)

            # 2. Create the Order
            order = Order(
                user_id=user_id,
                total_amount=total_amount,
                payment_method=payment_method,
                status="completed",  # Paid and verified - order is complete
                notes=notes,
                ip_address=req_ip,
                device_type=dev_type,
                browser=browser_name,
            )
            db.add(order)
            db.flush()  # Populate order.id

            logger.info("[REFERRAL] Order created: order_id=%s, customer_id=%s, total_amount=%s", order.id, user_id, total_amount)

            # Track vendor notifications to process later
            vendors_to_notify = []
            commission_assigned_for_order = False
            
            platform_fee_total = 0.0

            # 5. Create OrderItems & permissions
            for item in items_payload:
                from app.utils.money_utils import quantize_money
                prod_id = item["product_id"]
                price_paid = quantize_money(item["price_paid"])
                
                from app.utils.db_sync import get_product_by_id
                prod = get_product_by_id(db, prod_id)
                if not prod:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Product ID {prod_id} not found."
                    )
                
                # Check soft-deleted status
                if cast(str, prod.status) == "archived":
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
                if cast(Any, prod.vendor_id):
                    from app.models.vendor import Vendor
                    vendor = db.query(Vendor).filter(Vendor.id == prod.vendor_id).first()
                    if vendor:
                        try:
                            current_sales = int(cast(str, vendor.sales) or "0")
                        except ValueError:
                            current_sales = 0
                        vendor.sales = cast(Any, str(current_sales + 1))
                        db.add(vendor)
                        
                # Calculate platform fee
                if getattr(prod, 'owner_type', 'VENDOR') == 'PLATFORM':
                    platform_fee_total += price_paid
                else:
                    platform_fee_total += price_paid * 0.15

                # Log notification details for vendor
                if cast(Any, prod.vendor_id):
                    vendors_to_notify.append({
                        "vendor_id": prod.vendor_id,
                        "product_name": prod.title,
                        "amount": price_paid
                    })

                # 6. Generate Affiliate Commissions
                if not commission_assigned_for_order and getattr(prod, "affiliate_enabled", True) is not False:
                    target_aff_code = None
                    attr_source = "referral_link"
                    coupon_code_used = None
                    pending_ref = None

                    # Tier 1: Explicit Coupon Code overrides Referral Link Attribution
                    if promo_code:
                        clean_promo = promo_code.strip().upper()
                        aff_by_coupon = db.query(AffiliateProfile).filter(
                            AffiliateProfile.referral_code == clean_promo,
                            AffiliateProfile.is_active == True
                        ).first()
                        if not aff_by_coupon:
                            ref_link_coupon = db.query(ReferralLink).filter(
                                ReferralLink.referral_code == clean_promo,
                                ReferralLink.is_active == True
                            ).first()
                            if ref_link_coupon and ref_link_coupon.affiliate and ref_link_coupon.affiliate.is_active:
                                aff_by_coupon = ref_link_coupon.affiliate
                        
                        if aff_by_coupon:
                            target_aff_code = clean_promo
                            attr_source = "coupon_code"
                            coupon_code_used = clean_promo

                    # Tier 2: Check PostgreSQL AffiliateReferral by (customer_id, product_id)
                    if not target_aff_code:
                        pending_ref = db.query(AffiliateReferral).filter(
                            AffiliateReferral.customer_id == user_id,
                            AffiliateReferral.product_id == prod.id,
                            AffiliateReferral.status.in_(["CLICKED", "AUTHENTICATED", "PRODUCT_VIEWED", "ADDED_TO_CART"])
                        ).order_by(AffiliateReferral.updated_at.desc()).first()

                        if pending_ref:
                            target_aff_code = cast(str, pending_ref.referral_code)
                            attr_source = "referral_link"

                    # Tier 3: Check PostgreSQL AffiliateReferral by (customer_id) — any recent referral for this buyer
                    if not target_aff_code:
                        pending_ref = db.query(AffiliateReferral).filter(
                            AffiliateReferral.customer_id == user_id,
                            AffiliateReferral.status.in_(["CLICKED", "AUTHENTICATED", "PRODUCT_VIEWED", "ADDED_TO_CART"])
                        ).order_by(AffiliateReferral.updated_at.desc()).first()

                        if pending_ref:
                            target_aff_code = cast(str, pending_ref.referral_code)
                            attr_source = "referral_link"

                    # Tier 4: Fallback to affiliate_code passed from checkout/payment payload
                    if not target_aff_code and affiliate_code:
                        clean_passed = affiliate_code.strip().upper()
                        # Verify passed code matches an active affiliate profile or referral link
                        check_aff = db.query(AffiliateProfile).filter(
                            AffiliateProfile.referral_code == clean_passed,
                            (AffiliateProfile.is_active == True) | (AffiliateProfile.status.in_(["active", "approved"]))
                        ).first()
                        if not check_aff:
                            check_link = db.query(ReferralLink).filter(
                                ReferralLink.referral_code == clean_passed,
                                ReferralLink.is_active == True
                            ).first()
                            if check_link and check_link.affiliate:
                                check_aff = check_link.affiliate

                        if check_aff:
                            target_aff_code = clean_passed
                            attr_source = "referral_link"

                    if target_aff_code:
                        clean_code = target_aff_code
                        ref_link_obj = None
                        # 6a. First search default profile code
                        aff = db.query(AffiliateProfile).filter(
                            AffiliateProfile.referral_code == clean_code,
                            (AffiliateProfile.is_active == True) | (AffiliateProfile.status.in_(["active", "approved"]))
                        ).first()

                        # 6b. Fallback: search custom product referral links
                        if not aff:
                            ref_link_obj = db.query(ReferralLink).filter(
                                ReferralLink.referral_code == clean_code,
                                ReferralLink.is_active == True
                            ).first()
                            if ref_link_obj and ref_link_obj.affiliate:
                                aff = ref_link_obj.affiliate

                        if aff:
                            ref_link_id = ref_link_obj.id if ref_link_obj else None
                            # Tag Order with referral metadata
                            order.affiliate_id = cast(Any, aff.id)
                            order.referral_link_id = cast(Any, ref_link_id)
                            order.referral_code_used = cast(Any, clean_code)
                            order.attribution_source = cast(Any, attr_source)
                            order.coupon_code_used = cast(Any, coupon_code_used)

                            # Verify customer is not the affiliate itself (prevent self-referral)
                            if cast(int, aff.user_id) != user_id:
                                # Idempotency Guard: prevent duplicate commission if payment verification is retried
                                existing_comm = db.query(AffiliateCommission).filter(
                                    AffiliateCommission.order_id == order.id,
                                    AffiliateCommission.product_id == prod.id
                                ).first()

                                if not existing_comm:
                                    # Calculate commission with 2-decimal money quantization
                                    comm_type = cast(str, prod.commission_type) or "percentage"
                                    if comm_type == "fixed":
                                        comm_rate = cast(float, prod.commission_value) if (cast(float, prod.commission_value) and cast(float, prod.commission_value) > 0) else 0.0
                                        commission_amt = quantize_money(min(comm_rate, price_paid))
                                    else: # percentage
                                        comm_rate = cast(float, prod.commission_value) if (cast(float, prod.commission_value) and cast(float, prod.commission_value) > 0) else (cast(float, aff.commission_rate) or 20.0)
                                        commission_amt = quantize_money((price_paid * comm_rate) / 100.0)
                                    
                                    now_time = datetime.now(timezone.utc)
                                    
                                    # 6c. Insert immutable ReferralAttribution record
                                    attribution = ReferralAttribution(
                                        order_id=order.id,
                                        customer_id=user_id,
                                        affiliate_id=aff.id,
                                        affiliate_code=clean_code,
                                        referral_link_id=ref_link_id,
                                        product_id=prod.id,
                                        status="attributed",
                                        attribution_source=attr_source,
                                        coupon_code=coupon_code_used,
                                        device_type=dev_type,
                                        browser=browser_name,
                                        ip_address=req_ip,
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
                                        device_type=dev_type,
                                        browser=browser_name,
                                        ip_address=req_ip,
                                        referral_attribution_id=attribution.id,
                                        referral_link_id=ref_link_id,
                                        attribution_source=attr_source,
                                        coupon_code=coupon_code_used,
                                        referral_code_used=clean_code,
                                        created_at=now_time
                                    )
                                    db.add(comm)
                                    db.flush()

                                    attribution.commission_id = comm.id
                                    commission_assigned_for_order = True

                                    logger.info(
                                        "[REFERRAL] Commission created: commission_id=%s, affiliate_id=%s, order_id=%s, product_id=%s, customer_id=%s, commission_amt=%s",
                                        comm.id, aff.id, order.id, prod.id, user_id, commission_amt
                                    )

                                    # 6e. Sync with AffiliateReferral ledger
                                    r_rows = db.query(AffiliateReferral).filter(
                                        AffiliateReferral.affiliate_id == aff.id,
                                        AffiliateReferral.product_id == prod.id,
                                        AffiliateReferral.customer_id == user_id
                                    ).all()
                                    r_rows_null = db.query(AffiliateReferral).filter(
                                        AffiliateReferral.affiliate_id == aff.id,
                                        AffiliateReferral.product_id.is_(None),
                                        AffiliateReferral.customer_id == user_id
                                    ).all()
                                    r_rows_unauth = db.query(AffiliateReferral).filter(
                                        AffiliateReferral.affiliate_id == aff.id,
                                        AffiliateReferral.referral_code == clean_code,
                                        AffiliateReferral.customer_id.is_(None)
                                    ).order_by(AffiliateReferral.clicked_at.desc()).all()

                                    matching_set = set(r_rows + r_rows_null + r_rows_unauth)
                                    if pending_ref:
                                        matching_set.add(pending_ref)

                                    if matching_set:
                                        for r_row in matching_set:
                                            r_row.status = cast(Any, "PURCHASED")
                                            r_row.order_id = cast(Any, order.id)
                                            r_row.converted_at = cast(Any, now_time)
                                            r_row.customer_id = cast(Any, user_id)
                                            r_row.attribution_source = cast(Any, attr_source)
                                            if coupon_code_used:
                                                r_row.coupon_code = cast(Any, coupon_code_used)
                                    else:
                                        # Create persistent AffiliateReferral row so conversion ledger is complete
                                        new_ref = AffiliateReferral(
                                            affiliate_id=aff.id,
                                            referral_code=clean_code,
                                            product_id=prod.id,
                                            customer_id=user_id,
                                            order_id=order.id,
                                            session_id=f"REF_CONV_{uuid.uuid4().hex[:12]}",
                                            status="PURCHASED",
                                            clicked_at=now_time,
                                            authenticated_at=now_time,
                                            converted_at=now_time,
                                            attribution_source=attr_source,
                                            coupon_code=coupon_code_used
                                        )
                                        db.add(new_ref)

                                    # Update affiliate stats with quantized money accumulation
                                    aff.total_earnings = cast(Any, quantize_money((cast(float, aff.total_earnings) or 0.0) + commission_amt))
                                    aff.pending_earnings = cast(Any, quantize_money((cast(float, aff.pending_earnings) or 0.0) + commission_amt))
                                    aff.total_sales = cast(Any, (cast(int, aff.total_sales) or 0) + 1)
                                    aff.last_active_at = cast(Any, now_time)

                                    # Send Affiliate Notifications
                                    NotificationService.create_notification(
                                        db=db,
                                        user_id=cast(int, aff.user_id),
                                        title="Commission Earned! 🎉",
                                        message=f"You earned a commission of ₹{commission_amt:.2f} (referred purchase of '{prod.title}').",
                                        category="commission"
                                    )

                                    # Log Affiliate Activity
                                    ActivityLogService.log_user_activity(
                                        db=db,
                                        user_id=cast(int, aff.user_id),
                                        activity_type="commission_earned",
                                        details=f"Earned ₹{commission_amt:.2f} commission from order ORD-{order.id} for product '{prod.title}'."
                                    )

                            else:
                                logger.warning(
                                    "[REFERRAL] Self-referral blocked: affiliate_id=%s (user_id=%s) tried to earn commission "
                                    "from their own purchase (buyer user_id=%s). Order ORD-%s. "
                                    "Use a DIFFERENT customer account to test affiliate commissions.",
                                    aff.id, aff.user_id, user_id, order.id
                                )

                        # 6b. Process Admin Referral Link Conversion for this item (Isolated, Idempotent, Non-Blocking)
                        if target_aff_code:
                            try:
                                from admin_controls.referral.service import process_admin_referral
                                process_admin_referral(
                                    db=db,
                                    order=order,
                                    user_id=user_id,
                                    affiliate_code=target_aff_code,
                                    affiliate_profile=aff if 'aff' in locals() else None
                                )
                            except Exception as _admin_ref_exc:
                                import logging
                                logging.getLogger(__name__).error("[PurchaseService] Non-fatal admin referral error: %s", _admin_ref_exc)

            # 7. Generate User notifications
            
            # 7.5 Record Platform Revenue in Ledger
            if platform_fee_total > 0:
                try:
                    from app.services.treasury_service import write_ledger_entry
                    write_ledger_entry(
                        db,
                        ledger_type="revenue_earned",
                        amount=platform_fee_total,
                        reference_type="order",
                        reference_id=str(order.id),
                        description=f"Platform fee for order ORD-{order.id}"
                    )
                except Exception as _ledger_exc:
                    import logging
                    logging.getLogger(__name__).error("[PurchaseService] Failed to record ledger entry: %s", _ledger_exc)

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

            # Vendor Notifications (Best-Effort)
            for v_info in vendors_to_notify:
                try:
                    NotificationService.create_vendor_sale_notification(
                        db=db,
                        vendor_firebase_uid=v_info["vendor_id"],
                        buyer_name=customer.name if customer and customer.name else (customer.email if customer and customer.email else "Customer"),
                        product_name=v_info["product_name"],
                        amount=v_info["amount"],
                        order_id=f"ORD-{order.id}"
                    )
                except Exception as _v_notif_exc:
                    import logging
                    logging.getLogger(__name__).warning("[PurchaseService] Non-fatal vendor notification error: %s", _v_notif_exc)

            # 8. Create Activity Logs
            try:
                ActivityLogService.log_user_activity(
                    db=db,
                    user_id=user_id,
                    activity_type="purchase",
                    details=f"Completed purchase for order ORD-{order.id} containing {len(items_payload)} items."
                )
            except Exception as _act_exc:
                pass

            db.flush() # Ensure all IDs populated

            # 9. Sync to Firestore (Read-Only Mirror - Best Effort)
            try:
                sync_order_to_firestore(order)
            except Exception as _fs_exc:
                import logging
                logging.getLogger(__name__).warning("[PurchaseService] Non-fatal Firestore order sync error: %s", _fs_exc)

            return order

        except Exception as e:
            # Explicit rollback on any exception
            db.rollback()
            raise e


def uuid_generator() -> str:
    import uuid
    return uuid.uuid4().hex[:12]
