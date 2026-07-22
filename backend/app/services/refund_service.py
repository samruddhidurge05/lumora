from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import datetime
from typing import List, Optional

from app.models.refund_request import RefundRequest
from app.models.order import Order
from app.models.user import User
from app.models.payment import Payment
from app.core.config import settings
from app.services.payment_service import payment_service
from app.utils.db_sync import get_product_by_id
from app.services.activity_log_service import ActivityLogService
from app.shared.firebase.connection import db as fs_db, firebase_connected

class RefundService:
    def submit_request(
        self,
        db: Session,
        user_id: int,
        order_id: int,
        reason_category: str,
        details: Optional[str] = None
    ) -> RefundRequest:
        # 1. Fetch the order under write lock to serialize concurrent submissions
        order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order ORD-{order_id} not found."
            )

        # 2. Check ownership
        if order.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to request a refund for this order."
            )

        # 3. Check order status (must be completed or paid)
        status_lower = (order.status or "").lower()
        if status_lower not in ("completed", "paid"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Refunds can only be requested for completed or paid orders. Current status: {order.status}."
            )

        # 4. Check refund window
        purchase_age = datetime.utcnow() - order.created_at
        max_age_days = getattr(settings, "REFUND_WINDOW_DAYS", 14)
        if purchase_age.days >= max_age_days:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Refund request period has expired. Refunds are only eligible within {max_age_days} days of purchase."
            )

        # 5. Check for duplicate pending/approved request (including REFUNDED)
        existing_request = db.query(RefundRequest).filter(
            RefundRequest.order_id == order_id,
            RefundRequest.status.in_(["PENDING", "UNDER_REVIEW", "APPROVED", "PROCESSING", "REFUNDED"])
        ).first()
        if existing_request:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A refund request is already active, approved, or processed for this order."
            )


        # 6. Fetch items & snapshot info
        items = order.items
        if not items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This order contains no items."
            )

        # Build concatenated product name for snapshot
        first_item = items[0]
        prod = get_product_by_id(db, first_item.product_id)
        product_name = prod.title if prod else f"Product #{first_item.product_id}"
        if len(items) > 1:
            product_name = f"{product_name} (+{len(items)-1} other item{'s' if len(items) > 2 else ''})"

        payment_id = order.payment_id or f"PAY-ORD-{order.id}"

        # 7. Create RefundRequest
        req = RefundRequest(
            order_id=order.id,
            user_id=user_id,
            reason_category=reason_category,
            details=details,
            status="PENDING",
            requested_amount=order.total_amount,
            currency=order.currency or "INR",
            payment_id=payment_id,
            
            # Snapshots
            product_name=product_name,
            order_total=order.total_amount,
            payment_method=order.payment_method or "UPI / Card",
            purchase_date=order.created_at,
            
            last_updated_by=user_id
        )

        db.add(req)
        db.commit()
        db.refresh(req)

        # Log User Activity
        ActivityLogService.log_user_activity(
            db=db,
            user_id=user_id,
            activity_type="refund_requested",
            details=f"Submitted a refund request for order ORD-{order.id} (Category: {reason_category})."
        )
        db.commit()

        # Best-effort sync to Firestore refunds queue
        if firebase_connected and fs_db is not None:
            try:
                fs_db.collection("refund_requests").document(str(req.id)).set({
                    "id": req.id,
                    "orderId": f"ORD-{order.id}",
                    "customerId": str(user_id),
                    "productName": product_name,
                    "amount": float(req.requested_amount),
                    "status": "PENDING",
                    "reasonCategory": reason_category,
                    "createdAt": req.created_at.isoformat() + "Z",
                    "updatedAt": req.updated_at.isoformat() + "Z"
                }, merge=True)
            except Exception as fs_err:
                print(f"[refund-service] Firestore sync warning: {fs_err}")

        return self._enrich_request(db, req)

    def get_user_requests(self, db: Session, user_id: int) -> List[RefundRequest]:
        requests = db.query(RefundRequest).filter(RefundRequest.user_id == user_id).order_by(RefundRequest.created_at.desc()).all()
        enriched = []
        for r in requests:
            if r.status == "PROCESSING":
                try:
                    r = self.sync_stuck_refund(db, r.id)
                except Exception as sync_err:
                    print(f"[refund-service] Automatic recovery failed for user TKT-{r.id}: {sync_err}")
            enriched.append(self._enrich_request(db, r))
        return enriched

    def get_all_requests(self, db: Session, status: Optional[str] = None, page: int = 1, page_size: int = 50) -> List[RefundRequest]:
        q = db.query(RefundRequest)
        if status:
            q = q.filter(RefundRequest.status == status.upper())
        requests = q.order_by(RefundRequest.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
        
        enriched = []
        for r in requests:
            if r.status == "PROCESSING":
                try:
                    r = self.sync_stuck_refund(db, r.id)
                except Exception as sync_err:
                    print(f"[refund-service] Automatic recovery failed for TKT-{r.id}: {sync_err}")
            enriched.append(self._enrich_request(db, r))
        return enriched

    def update_request_status(self, db: Session, request_id: int, new_status: str, admin_id: int) -> RefundRequest:
        req = db.query(RefundRequest).filter(RefundRequest.id == request_id).with_for_update().first()
        if not req:
            raise HTTPException(status_code=404, detail="Refund request not found.")

        valid_statuses = ["PENDING", "UNDER_REVIEW", "APPROVED", "PROCESSING", "REFUNDED", "FAILED", "REJECTED", "CANCELLED"]
        new_status_upper = new_status.upper()
        if new_status_upper not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status: {new_status}.")

        req.status = new_status_upper
        req.last_updated_by = admin_id
        req.last_updated_at = datetime.utcnow()

        db.commit()
        db.refresh(req)

        # Sync update to Firestore
        if firebase_connected and fs_db is not None:
            try:
                fs_db.collection("refund_requests").document(str(req.id)).update({
                    "status": new_status_upper,
                    "updatedAt": req.last_updated_at.isoformat() + "Z"
                })
            except Exception as fs_err:
                print(f"[refund-service] Firestore sync warning: {fs_err}")

        return self._enrich_request(db, req)

    def approve_refund(self, db: Session, request_id: int, admin_id: int, notes: Optional[str] = None) -> RefundRequest:
        # Use SELECT FOR UPDATE to lock the row and serialize admins
        req = db.query(RefundRequest).filter(RefundRequest.id == request_id).with_for_update().first()
        if not req:
            raise HTTPException(status_code=404, detail="Refund request not found.")

        # Guard status (must not be approved or refunded already)
        if req.status in ("APPROVED", "REFUNDED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Refund request is already in status {req.status}."
            )

        req.status = "APPROVED"
        req.admin_notes = notes
        req.reviewed_by = admin_id
        req.admin_decision_at = datetime.utcnow()
        req.last_updated_by = admin_id
        req.last_updated_at = datetime.utcnow()

        # Attempt payment gateway refund if a valid payment reference exists
        order = db.query(Order).filter(Order.id == req.order_id).first()
        payment_ref = (order.payment_id if order and order.payment_id else req.payment_id)

        if payment_ref and str(payment_ref).strip().lower() not in ("none", "", "null", "undefined"):
            try:
                payment = payment_service.initiate_refund(
                    db=db,
                    payment_ref=payment_ref,
                    admin_user_id=admin_id,
                    amount=req.requested_amount,
                    reason=f"Approved refund for ORD-{req.order_id}"
                )
                if payment and getattr(payment, "gateway_payment_id", None):
                    req.gateway_refund_id = payment.gateway_payment_id
            except Exception as e:
                print(f"[refund-service] Gateway refund warning for TKT-{req.id}: {e}")

        db.commit()
        db.refresh(req)

        # Sync successful status to Firestore
        if firebase_connected and fs_db is not None:
            try:
                fs_db.collection("refund_requests").document(str(req.id)).update({
                    "status": "APPROVED",
                    "adminNotes": req.admin_notes or "",
                    "updatedAt": req.last_updated_at.isoformat() + "Z"
                })
            except Exception as fs_err:
                print(f"[refund-service] Firestore sync warning: {fs_err}")

        return self._enrich_request(db, req)

    def reject_refund(self, db: Session, request_id: int, admin_id: int, notes: Optional[str] = None) -> RefundRequest:
        req = db.query(RefundRequest).filter(RefundRequest.id == request_id).with_for_update().first()
        if not req:
            raise HTTPException(status_code=404, detail="Refund request not found.")

        if req.status in ("APPROVED", "PROCESSING", "REFUNDED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reject a request that is already approved or processed."
            )

        req.status = "REJECTED"
        req.admin_notes = notes
        req.reviewed_by = admin_id
        req.admin_decision_at = datetime.utcnow()
        req.last_updated_by = admin_id
        req.last_updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(req)

        # Sync update to Firestore
        if firebase_connected and fs_db is not None:
            try:
                fs_db.collection("refund_requests").document(str(req.id)).update({
                    "status": "REJECTED",
                    "updatedAt": req.last_updated_at.isoformat() + "Z"
                })
            except Exception as fs_err:
                print(f"[refund-service] Firestore sync warning: {fs_err}")

        return self._enrich_request(db, req)

    def cancel_request(self, db: Session, request_id: int, user_id: int) -> RefundRequest:
        req = db.query(RefundRequest).filter(
            RefundRequest.id == request_id,
            RefundRequest.user_id == user_id
        ).with_for_update().first()
        
        if not req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Refund request not found."
            )
            
        if req.status not in ("PENDING", "UNDER_REVIEW"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel a refund request that is in {req.status} status."
            )
            
        req.status = "CANCELLED"
        req.last_updated_by = user_id
        req.last_updated_at = datetime.utcnow()
        
        ActivityLogService.log_user_activity(
            db=db,
            user_id=user_id,
            activity_type="refund_cancelled",
            details=f"Cancelled refund request TKT-{request_id} for order ORD-{req.order_id}."
        )
        
        db.commit()
        db.refresh(req)
        
        # Sync update to Firestore
        if firebase_connected and fs_db is not None:
            try:
                fs_db.collection("refund_requests").document(str(req.id)).update({
                    "status": "CANCELLED",
                    "updatedAt": req.last_updated_at.isoformat() + "Z"
                })
            except Exception as fs_err:
                print(f"[refund-service] Firestore sync warning during cancellation: {fs_err}")
                
        return self._enrich_request(db, req)

    def sync_stuck_refund(self, db: Session, request_id: int) -> RefundRequest:
        req = db.query(RefundRequest).filter(RefundRequest.id == request_id).with_for_update().first()
        if not req:
            raise HTTPException(status_code=404, detail="Refund request not found.")

        if req.status != "PROCESSING":
            return req

        # Query gateway
        from app.payments.gateway.factory import get_gateway
        gateway = get_gateway()
        from app.payments.gateway.razorpay_gateway import RazorpayGateway
        
        refunded = False
        gateway_refund_id = None
        
        if isinstance(gateway, RazorpayGateway):
            try:
                payment_info = gateway._client.payment.fetch(req.payment_id)
                amount_refunded = payment_info.get("amount_refunded", 0)
                if amount_refunded > 0:
                    refunded = True
                    try:
                        refunds_res = gateway._client.payment.refunds(req.payment_id)
                        items = refunds_res.get("items", [])
                        if items:
                            gateway_refund_id = items[0]["id"]
                    except Exception:
                        pass
            except Exception as e:
                print(f"[refund-service] Failed to query Razorpay payment {req.payment_id} for recovery: {e}")
        else:
            if "mock" in (req.payment_id or "").lower():
                refunded = True
                gateway_refund_id = f"mock_refund_recovered_{req.id}"

        if refunded:
            return self.confirm_refund_success(db, req.id, gateway_refund_id=gateway_refund_id)
        else:
            req.status = "FAILED"
            req.decision_reason = "Recovered from stuck PROCESSING state: gateway refund was not found."
            req.last_updated_at = datetime.utcnow()
            db.commit()
            db.refresh(req)
            
            if firebase_connected and fs_db is not None:
                try:
                    fs_db.collection("refund_requests").document(str(req.id)).update({
                        "status": "FAILED",
                        "updatedAt": req.last_updated_at.isoformat() + "Z"
                    })
                except Exception as fs_err:
                    print(f"[refund-service] Firestore sync warning during recovery: {fs_err}")
            
            return req

    def confirm_refund_success(self, db: Session, request_id: int, gateway_refund_id: Optional[str] = None) -> RefundRequest:

        req = db.query(RefundRequest).filter(RefundRequest.id == request_id).first()
        if not req:
            return None

        req.status = "REFUNDED"
        if gateway_refund_id:
            req.gateway_refund_id = gateway_refund_id
        req.last_updated_at = datetime.utcnow()
        
        # Modify associated Order status
        order = db.query(Order).filter(Order.id == req.order_id).first()
        if order:
            from app.admin_api.orders.services import modify_order_status
            try:
                modify_order_status(f"ORD-{order.id}", "Refunded")
            except Exception as err:
                print(f"[refund-service] Order status update failed: {err}")
        
        db.commit()
        db.refresh(req)

        # Sync update to Firestore
        if firebase_connected and fs_db is not None:
            try:
                fs_db.collection("refund_requests").document(str(req.id)).update({
                    "status": "REFUNDED",
                    "gatewayRefundId": gateway_refund_id,
                    "updatedAt": req.last_updated_at.isoformat() + "Z"
                })
            except Exception as fs_err:
                print(f"[refund-service] Firestore sync warning: {fs_err}")

        return self._enrich_request(db, req)

    def _enrich_request(self, db: Session, req: RefundRequest) -> RefundRequest:
        if not req:
            return req
        
        order = db.query(Order).filter(Order.id == req.order_id).first()
        is_downloaded = False
        download_count = 0
        first_download_at = None
        last_download_at = None
        
        if order:
            # Primary: ProductDownloadEvent records
            try:
                from app.models.product_download_event import ProductDownloadEvent
                prod_ids = [item.product_id for item in order.items]
                dl_events = db.query(ProductDownloadEvent).filter(
                    ProductDownloadEvent.user_id == req.user_id,
                    ProductDownloadEvent.product_id.in_(prod_ids)
                ).order_by(ProductDownloadEvent.downloaded_at.asc()).all()

                if dl_events:
                    download_count = len(dl_events)
                    first_download_at = dl_events[0].downloaded_at
                    last_download_at = dl_events[-1].downloaded_at
                    is_downloaded = True
            except Exception as dl_err:
                print(f"[refund-service] ProductDownloadEvent query warning: {dl_err}")

            # Secondary fallback: OrderItem.downloaded & UserActivity
            if not is_downloaded:
                is_downloaded = any(item.downloaded for item in order.items)
                
                from app.models.user_activity import UserActivity
                download_logs = db.query(UserActivity).filter(
                    UserActivity.user_id == req.user_id,
                    UserActivity.activity_type == "download"
                ).all()
                
                for item in order.items:
                    matching_logs = [
                        log for log in download_logs 
                        if f"(ID {item.product_id})" in (log.details or "") 
                        or f"ID {item.product_id}" in (log.details or "")
                    ]
                    if matching_logs:
                        download_count += len(matching_logs)
                        sorted_logs = sorted(matching_logs, key=lambda x: x.created_at or datetime.min)
                        if not first_download_at or sorted_logs[0].created_at < first_download_at:
                            first_download_at = sorted_logs[0].created_at
                        if not last_download_at or sorted_logs[-1].created_at > last_download_at:
                            last_download_at = sorted_logs[-1].created_at
        
        if is_downloaded and not first_download_at and order:
            first_download_at = order.created_at
            last_download_at = order.created_at
            download_count = max(1, download_count)
            
        req.is_downloaded = is_downloaded
        req.download_count = download_count
        req.first_download_at = first_download_at
        req.last_download_at = last_download_at

        # Attempt to pull IP / device from the most recent checkout activity
        ip_address = None
        device_details = None
        try:
            from app.models.user_activity import UserActivity
            session_log = (
                db.query(UserActivity)
                .filter(
                    UserActivity.user_id == req.user_id,
                    UserActivity.activity_type.in_(["checkout", "purchase", "payment"])
                )
                .order_by(UserActivity.created_at.desc())
                .first()
            )
            if session_log:
                ip_address = getattr(session_log, "ip_address", None)
                device_details = getattr(session_log, "user_agent", None)
        except Exception:
            pass

        req.ip_address = ip_address
        req.device_details = device_details
        
        req.previous_refund_count = db.query(RefundRequest).filter(
            RefundRequest.user_id == req.user_id,
            RefundRequest.status == "REFUNDED"
        ).count()
        
        return req

refund_service = RefundService()
