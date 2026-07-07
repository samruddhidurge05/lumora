from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.order import Order, OrderItem
from app.models.payment import Payment
from app.models.product import Product
from app.models.affiliate import AffiliateProfile, AffiliateCommission
from app.models.user import User
from app.services.payment_service import payment_service
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
        payment_id: Optional[str] = None,
        razorpay_order_id: Optional[str] = None,
        razorpay_signature: Optional[str] = None,
        promo_code: Optional[str] = None,
        discount_amount: float = 0.0,
        affiliate_code: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Order:
        # 1. Verify payment if using Razorpay
        if payment_method == "razorpay" or razorpay_order_id:
            if not payment_id or not razorpay_order_id or not razorpay_signature:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Razorpay payments require payment_id, razorpay_order_id, and razorpay_signature."
                )
            verified = payment_service.verify_payment_signature(
                payment_id=payment_id,
                order_id=razorpay_order_id,
                signature=razorpay_signature
            )
            if not verified:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid payment signature verification failed."
                )

        # Start atomic transaction
        # The caller should commit or roll back, but we can manage nested/explicit transactions
        try:
            # 2. Fetch customer details
            customer = db.query(User).filter(User.id == user_id).first()
            if not customer:
                raise HTTPException(status_code=404, detail="Customer user not found")

            # 3. Create the Order
            order = Order(
                user_id=user_id,
                total_amount=total_amount,
                payment_method=payment_method,
                status="completed", # Paid and verified order is complete
                notes=notes
            )
            db.add(order)
            db.flush() # Populate order.id

            # 4. Create Payments log record
            payment_log = Payment(
                order_id=order.id,
                gateway="razorpay" if razorpay_order_id else "mock",
                gateway_ref=payment_id or f"mock_{uuid_generator()}",
                amount=total_amount,
                currency="INR",
                status="success",
                method=payment_method,
                receipt=f"Order checkout receipt for ORD-{order.id}"
            )
            db.add(payment_log)

            # Track vendor notifications to process later
            vendors_to_notify = []

            # 5. Create OrderItems & permissions
            for item in items_payload:
                prod_id = item["product_id"]
                price_paid = item["price_paid"]
                
                prod = db.query(Product).filter(Product.id == prod_id).first()
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

                # Update product downloads count
                prod.downloads = (prod.downloads or 0) + 1

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
                if affiliate_code and prod.affiliate_enabled:
                    aff = db.query(AffiliateProfile).filter(
                        AffiliateProfile.referral_code == affiliate_code,
                        AffiliateProfile.is_active == True
                    ).first()
                    if aff:
                        # Verify customer is not the affiliate itself (prevent self-referral)
                        if aff.user_id != user_id:
                            # Calculate commission
                            if prod.commission_type == "fixed":
                                commission_amt = min(prod.commission_value or 0.0, price_paid)
                            else: # percentage
                                rate = prod.commission_value if prod.commission_value is not None else (aff.commission_rate or 20.0)
                                commission_amt = (price_paid * rate) / 100.0
                            
                            comm = AffiliateCommission(
                                affiliate_id=aff.id,
                                order_id=order.id,
                                product_id=prod.id,
                                product_name=prod.title,
                                sale_amount=price_paid,
                                commission_amt=commission_amt,
                                status="approved"
                            )
                            db.add(comm)
                            
                            # Update affiliate stats
                            aff.total_earnings = (aff.total_earnings or 0.0) + commission_amt
                            aff.total_sales = (aff.total_sales or 0) + 1

                            # Send Affiliate Notifications
                            NotificationService.create_notification(
                                db=db,
                                user_id=aff.user_id,
                                title="Commission Earned! ✦",
                                message=f"You earned a commission of ₹{commission_amt * 80:.2f} (referred purchase of '{prod.title}').",
                                category="commission"
                            )

                            # Log Affiliate Activity
                            ActivityLogService.log_user_activity(
                                db=db,
                                user_id=aff.user_id,
                                activity_type="commission_earned",
                                details=f"Earned ₹{commission_amt * 80:.2f} commission from order ORD-{order.id} for product '{prod.title}'."
                            )

            # 7. Generate User notifications
            # Customer Notification
            NotificationService.create_notification(
                db=db,
                user_id=user_id,
                title="Purchase Confirmed ✦",
                message=f"Thank you for your purchase! Order ORD-{order.id} for ₹{total_amount:.2f} is now active. Access assets via your vault.",
                category="purchase"
            )

            NotificationService.create_notification(
                db=db,
                user_id=user_id,
                title="Payment Success ✦",
                message=f"Payment receipt for order ORD-{order.id} of ₹{total_amount:.2f} has been verified successfully.",
                category="payment"
            )

            NotificationService.create_notification(
                db=db,
                user_id=user_id,
                title="Download Ready ✦",
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
            sync_order_to_firestore(order, db)

            return order

        except Exception as e:
            # Explicit rollback on any exception
            db.rollback()
            raise e


def uuid_generator() -> str:
    import uuid
    return uuid.uuid4().hex[:12]
