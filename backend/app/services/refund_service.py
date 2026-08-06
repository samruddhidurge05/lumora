from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import datetime, timezone
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
        now_utc = datetime.now(timezone.utc)
        order_created = order.created_at.replace(tzinfo=timezone.utc) if (order.created_at and order.created_at.tzinfo is None) else order.created_at
        purchase_age = now_utc - order_created
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

        # 5.5. Check digital asset download evidence (Digital License Access Guard)
        from app.models.product_download_event import ProductDownloadEvent
        has_download_event = db.query(ProductDownloadEvent).filter(
            ProductDownloadEvent.order_id == order_id
        ).first() is not None

        item_downloaded = any(getattr(item, "downloaded", False) for item in order.items)
        order_download_count = (getattr(order, "download_count", 0) or 0) > 0

        if has_download_event or item_downloaded or order_download_count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This digital license has already been downloaded to your device. Refund requests are not permitted once digital assets have been accessed."
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
                    "amount": float(getattr(req, "requested_amount", 0.0)),
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

        # If explicit RefundRequest table rows exist, return enriched rows
        if len(requests) > 0:
            enriched = []
            for r in requests:
                if r.status == "PROCESSING":
                    try:
                        r = self.sync_stuck_refund(db, r.id)
                    except Exception as sync_err:
                        print(f"[refund-service] Automatic recovery failed for TKT-{r.id}: {sync_err}")
                enriched.append(self._enrich_request(db, r))
            return enriched

        # Fallback: Synthesize refund request objects from historical refunded or disputed Order records
        synthesized = []
        try:
            refunded_orders = db.query(Order).filter(Order.status.ilike("%refund%")).all()
            disputed_orders = db.query(Order).filter(Order.status.ilike("%disput%")).all()
            all_target_orders = list({o.id: o for o in (refunded_orders + disputed_orders)}.values())

            for ord_obj in all_target_orders:
                cust = db.query(User).filter(User.id == ord_obj.user_id).first() if ord_obj.user_id else None
                prod_title = "Digital Asset"
                if ord_obj.items:
                    p = get_product_by_id(db, ord_obj.items[0].product_id)
                    if p and getattr(p, "title", None):
                        prod_title = p.title

                st_upper = "REFUNDED" if "refund" in (ord_obj.status or "").lower() else "UNDER_REVIEW"
                if status and st_upper != status.upper():
                    continue

                synth_req = RefundRequest(
                    id=ord_obj.id,
                    order_id=ord_obj.id,
                    user_id=ord_obj.user_id or 1,
                    reason_category="customer_request",
                    details="Historical refund transaction",
                    status=st_upper,
                    requested_amount=float(getattr(ord_obj, "total_amount", 0.0) or 0.0),
                    currency=ord_obj.currency or "INR",
                    payment_id=ord_obj.payment_id or f"PAY-ORD-{ord_obj.id}",
                    product_name=prod_title,
                    order_total=float(getattr(ord_obj, "total_amount", 0.0) or 0.0),
                    payment_method=ord_obj.payment_method or "upi",
                    purchase_date=ord_obj.created_at,
                    created_at=ord_obj.created_at or datetime.now(timezone.utc),
                    updated_at=ord_obj.updated_at or datetime.now(timezone.utc)
                )
                synthesized.append(self._enrich_request(db, synth_req))
        except Exception as synth_err:
            print(f"[refund-service] Historical order refund synthesis warning: {synth_err}")

        # Firestore mirror lookup
        if len(synthesized) == 0 and firebase_connected and fs_db is not None:
            try:
                fs_docs = list(fs_db.collection("refund_requests").stream())
                for doc in fs_docs:
                    d = doc.to_dict() or {}
                    st = d.get("status", "PENDING").upper()
                    if status and st != status.upper():
                        continue
                    clean_ord_id = int(str(d.get("orderId", doc.id)).replace("ORD-", "")) if str(d.get("orderId", doc.id)).replace("ORD-", "").isdigit() else 1
                    c_id = int(d.get("customerId", 1)) if str(d.get("customerId", 1)).isdigit() else 1
                    synth_req = RefundRequest(
                        id=int(doc.id) if doc.id.isdigit() else clean_ord_id,
                        order_id=clean_ord_id,
                        user_id=c_id,
                        reason_category=d.get("reasonCategory", "customer_request"),
                        details=d.get("details", "Customer refund request"),
                        status=st,
                        requested_amount=float(d.get("amount", 0.0)),
                        currency=d.get("currency", "INR"),
                        payment_id=d.get("paymentId"),
                        product_name=d.get("productName", "Digital Product"),
                        order_total=float(d.get("amount", 0.0)),
                        payment_method="upi",
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc)
                    )
                    synthesized.append(self._enrich_request(db, synth_req))
            except Exception as fs_err:
                print(f"[refund-service] Firestore refund queue stream warning: {fs_err}")

        start_idx = (page - 1) * page_size
        return synthesized[start_idx : start_idx + page_size]

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
        req.last_updated_at = datetime.now(timezone.utc)

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
        req.admin_decision_at = datetime.now(timezone.utc)
        req.last_updated_by = admin_id
        req.last_updated_at = datetime.now(timezone.utc)

        # Attempt payment gateway refund if a valid payment reference exists
        order = db.query(Order).filter(Order.id == req.order_id).first()
        payment_ref = (order.payment_id if order and getattr(order, "payment_id", None) else req.payment_id)

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

        # Transition Order status to "refunded" to revoke digital download license while preserving historical audit logs
        if order:
            setattr(order, "status", "refunded")
            db.add(order)

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
        req.admin_decision_at = datetime.now(timezone.utc)
        req.last_updated_by = admin_id
        req.last_updated_at = datetime.now(timezone.utc)
        
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
        req.last_updated_at = datetime.now(timezone.utc)
        
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
            req.last_updated_at = datetime.now(timezone.utc)
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
        req.last_updated_at = datetime.now(timezone.utc)
        
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
        dl_events = []
        
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
            first_download_at = getattr(order, "first_downloaded_at", None) or order.created_at
            last_download_at = getattr(order, "last_downloaded_at", None) or order.created_at
            download_count = max(1, download_count)
            
        req.is_downloaded = is_downloaded
        req.download_count = download_count
        req.first_download_at = first_download_at
        req.last_download_at = last_download_at

        # Attempt to pull IP / device from ProductDownloadEvent or Order metadata
        ip_address = getattr(order, "download_ip", None) if order else None
        device_details = f"{getattr(order, 'download_device', '')} ({getattr(order, 'download_browser', '')})".strip() if order and getattr(order, 'download_device', None) else None
        
        if dl_events:
            last_event = dl_events[-1]
            if getattr(last_event, "ip_address", None):
                ip_address = last_event.ip_address
            dev_str = f"{getattr(last_event, 'device_type', '')} ({getattr(last_event, 'browser', '')})".strip()
            if dev_str and dev_str != "()":
                device_details = dev_str

        if not ip_address or not device_details:
            try:
                from app.models.user_activity import UserActivity
                session_log = (
                    db.query(UserActivity)
                    .filter(
                        UserActivity.user_id == req.user_id,
                        UserActivity.activity_type.in_(["download", "checkout", "purchase", "payment"])
                    )
                    .order_by(UserActivity.created_at.desc())
                    .first()
                )
                if session_log:
                    if not ip_address:
                        ip_address = getattr(session_log, "ip_address", None)
                    if not device_details:
                        device_details = getattr(session_log, "user_agent", None)
            except Exception:
                pass

        req.ip_address = ip_address
        req.device_details = device_details
        
        req.previous_refund_count = db.query(RefundRequest).filter(
            RefundRequest.user_id == req.user_id,
            RefundRequest.status == "REFUNDED"
        ).count()

        from app.services.customer_identity_service import resolve_customer_identity
        c_name, c_email = resolve_customer_identity(db, user_id=req.user_id, order_id=req.order_id)
        req.customer_name = c_name
        req.customer_email = c_email
        
        return req

refund_service = RefundService()
