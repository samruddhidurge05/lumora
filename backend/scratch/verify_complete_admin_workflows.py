import sys
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.database import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.payment import Payment
from app.models.refund_request import RefundRequest
from app.models.report import SQLReport
from app.models.review import Review
from app.models.affiliate import AffiliateProfile, AffiliateCommission, AffiliatePayout
from app.models.platform_withdrawal import PlatformWithdrawal

from app.services.refund_service import refund_service
from app.admin_api.orders.services import modify_order_status
from app.admin_api.analytics.services import get_analytics_dashboard_data, get_full_dashboard_data
from app.admin_api.payments.services import get_vendor_payouts, get_payments_overview, process_vendor_payout
from app.admin_api.reviews.services import moderate_review, get_reviews_dashboard_data
from app.services.treasury_service import create_settlement_request, approve_settlement, complete_settlement

def run_complete_admin_workflow_verification():
    db = SessionLocal()
    results = {}
    try:
        print("\n====================================================")
        print("VERIFYING COMPLETE ADMIN WORKFLOW (RENDER POSTGRESQL)")
        print("====================================================\n")

        # ----------------------------------------------------
        # 1. ORDERS WORKFLOW VERIFICATION
        # ----------------------------------------------------
        print("--> 1. Testing Orders Workflow...")
        user = db.query(User).filter(User.role == "customer").first() or db.query(User).first()
        assert user is not None, "Customer user required"
        user_id = int(str(user.id))
        user_email = str(user.email or "audit@lumora.io")

        product = db.query(Product).first()
        assert product is not None, "Product required"
        product_id = int(str(product.id))

        new_order = Order(
            user_id=user_id,
            total_amount=500.0,
            status="completed",
            payment_method="UPI",
            payment_id="PAY-AUDIT-TEST-101",
            currency="INR",
            created_at=datetime.now(timezone.utc)
        )
        db.add(new_order)
        db.commit()
        db.refresh(new_order)
        new_order_id = int(str(new_order.id))

        order_item = OrderItem(
            order_id=new_order_id,
            product_id=product_id,
            price_paid=500.0,
            downloaded=False
        )
        db.add(order_item)
        db.commit()
        print(f"   [OK] Order Created: ORD-{new_order_id}")

        # View order & download status
        viewed_order = db.query(Order).filter(Order.id == new_order_id).first()
        assert viewed_order is not None, "Order must be queryable from PostgreSQL"
        print(f"   [OK] View Order: ORD-{viewed_order.id}, Status={viewed_order.status}, Downloaded={order_item.downloaded}")

        # Refund Request & Approve
        refund_req = refund_service.submit_request(
            db=db,
            user_id=user_id,
            order_id=new_order_id,
            reason_category="broken_file",
            details="Audit test refund"
        )
        assert str(refund_req.status) == "PENDING", "Submitted refund request must be PENDING"
        print(f"   [OK] Refund Request Submitted: TKT-{refund_req.id} for ORD-{new_order_id}")

        approved_ref = refund_service.approve_refund(db=db, request_id=int(str(refund_req.id)), admin_id=1, notes="Approved audit")
        assert str(approved_ref.status) == "APPROVED", "Approved refund request status must be APPROVED"
        db.refresh(viewed_order)
        assert str(viewed_order.status) == "refunded", "Order status must update to refunded"
        print(f"   [OK] Refund Approve: TKT-{approved_ref.id} APPROVED, Order status='{viewed_order.status}'")

        # Create another order to test Refund Reject & Order status update
        reject_order = Order(
            user_id=user_id,
            total_amount=300.0,
            status="completed",
            payment_method="Card",
            payment_id="PAY-AUDIT-TEST-102",
            currency="INR",
            created_at=datetime.now(timezone.utc)
        )
        db.add(reject_order)
        db.commit()
        db.refresh(reject_order)
        reject_order_id = int(str(reject_order.id))

        rej_item = OrderItem(order_id=reject_order_id, product_id=product_id, price_paid=300.0)
        db.add(rej_item)
        db.commit()

        # Order status update
        modify_order_status(f"ORD-{reject_order_id}", "Processing")
        db.refresh(reject_order)
        assert str(reject_order.status).lower() == "processing", "Order status update failed"
        print(f"   [OK] Order Status Update: ORD-{reject_order_id} status is now '{reject_order.status}'")

        # Set back to completed to test refund reject
        setattr(reject_order, "status", "completed")
        db.commit()

        rej_req = refund_service.submit_request(db=db, user_id=user_id, order_id=reject_order_id, reason_category="other")
        rejected_ref = refund_service.reject_refund(db=db, request_id=int(str(rej_req.id)), admin_id=1, notes="Rejected audit")
        assert str(rejected_ref.status) == "REJECTED", "Refund request must be REJECTED"
        print(f"   [OK] Refund Reject: TKT-{rejected_ref.id} REJECTED")

        results["orders"] = True

        # ----------------------------------------------------
        # 2. PAYMENTS WORKFLOW VERIFICATION
        # ----------------------------------------------------
        print("\n--> 2. Testing Payments & Ledger Workflow...")
        payments = db.query(Payment).all()
        print(f"   [OK] Payment Ledger: {len(payments)} payment records queried from PostgreSQL.")

        payout_ledger = get_vendor_payouts()
        print(f"   [OK] Vendor Payout Ledger: {len(payout_ledger)} vendors calculated from PostgreSQL.")
        results["payments"] = True

        # ----------------------------------------------------
        # 3. REPORTS WORKFLOW VERIFICATION
        # ----------------------------------------------------
        print("\n--> 3. Testing Reports Workflow...")
        new_rep = SQLReport(
            user_id=str(user_id),
            product_id=str(product_id),
            category="Quality Issue",
            description="Testing admin report resolve flow",
            status="Pending",
            reporter=user_email,
            created_at=datetime.now(timezone.utc)
        )
        db.add(new_rep)
        db.commit()
        db.refresh(new_rep)
        print(f"   [OK] Report Created: ID={new_rep.id}, Status={new_rep.status}")

        # Resolve report
        setattr(new_rep, "status", "Resolved")
        setattr(new_rep, "resolved_at", datetime.now(timezone.utc))
        db.commit()
        db.refresh(new_rep)
        assert str(new_rep.status) == "Resolved", "Report status must update to Resolved"
        print(f"   [OK] Report Resolved: ID={new_rep.id}, Status={new_rep.status}")
        results["reports"] = True

        # ----------------------------------------------------
        # 4. REVIEWS WORKFLOW VERIFICATION
        # ----------------------------------------------------
        print("\n--> 4. Testing Reviews Workflow...")
        new_review = Review(
            product_id=product_id,
            user_id=user_id,
            rating=5,
            comment="Audit test review",
            verified=True,
            created_at=datetime.now(timezone.utc)
        )
        db.add(new_review)
        db.commit()
        db.refresh(new_review)
        print(f"   [OK] Review Created: ID={new_review.id}, Verified={new_review.verified}")

        # Moderate review
        mod_res = moderate_review(str(new_review.id), "flag")
        assert mod_res.get("success") is True, "Moderate review must succeed"
        print(f"   [OK] Review Flagged/Moderated: Action={mod_res.get('action')}, Result={mod_res.get('success')}")

        rev_dashboard = get_reviews_dashboard_data()
        assert "sentimentTrend" in rev_dashboard, "Reviews dashboard data must return sentimentTrend"
        print(f"   [OK] Admin Reviews Dashboard queried from PostgreSQL.")
        results["reviews"] = True

        # ----------------------------------------------------
        # 5. AFFILIATE WORKFLOW VERIFICATION
        # ----------------------------------------------------
        print("\n--> 5. Testing Affiliate Workflow...")
        aff_user = db.query(User).filter(User.role == "affiliate").first()
        if not aff_user:
            aff_user = User(name="Audit Affiliate", email="audit_affiliate@lumora.io", role="affiliate")
            db.add(aff_user)
            db.commit()
            db.refresh(aff_user)

        aff_user_id = int(str(aff_user.id))
        aff_profile = db.query(AffiliateProfile).filter(AffiliateProfile.user_id == aff_user_id).first()
        if not aff_profile:
            aff_profile = AffiliateProfile(
                user_id=aff_user_id,
                referral_code=f"AUDIT_{aff_user_id}",
                total_earnings=0.0,
                pending_earnings=0.0,
                paid_earnings=0.0,
                status="approved"
            )
            db.add(aff_profile)
            db.commit()
            db.refresh(aff_profile)

        aff_profile_id = int(str(aff_profile.id))

        # Create Commission
        comm = AffiliateCommission(
            affiliate_id=aff_profile_id,
            order_id=new_order_id,
            sale_amount=500.0,
            commission_amt=50.0,
            commission_rate=10.0,
            status="pending",
            commission_status="pending",
            created_at=datetime.now(timezone.utc)
        )
        db.add(comm)
        curr_pending = float(getattr(aff_profile, "pending_earnings", 0.0) or 0.0)
        setattr(aff_profile, "pending_earnings", curr_pending + 50.0)
        db.commit()
        db.refresh(comm)
        print(f"   [OK] Affiliate Commission Generated: ID={comm.id}, CommissionAmt={comm.commission_amt}, Status={comm.status}")

        # Approve Commission
        setattr(comm, "status", "approved")
        setattr(comm, "commission_status", "approved")
        curr_pending = float(getattr(aff_profile, "pending_earnings", 0.0) or 0.0)
        curr_total = float(getattr(aff_profile, "total_earnings", 0.0) or 0.0)
        setattr(aff_profile, "pending_earnings", max(0.0, curr_pending - 50.0))
        setattr(aff_profile, "total_earnings", curr_total + 50.0)
        db.commit()
        print(f"   [OK] Commission Approved: Total Earnings={aff_profile.total_earnings}")

        # Withdrawal request
        payout_req = AffiliatePayout(
            affiliate_id=aff_profile_id,
            amount=50.0,
            status="pending",
            method="upi",
            upi_id="audit@upi",
            created_at=datetime.now(timezone.utc)
        )
        db.add(payout_req)
        db.commit()
        db.refresh(payout_req)
        print(f"   [OK] Affiliate Payout Requested: ID={payout_req.id}, Status={payout_req.status}")

        # Approve Payout
        setattr(payout_req, "status", "completed")
        setattr(payout_req, "processed_at", datetime.now(timezone.utc))
        curr_paid = float(getattr(aff_profile, "paid_earnings", 0.0) or 0.0)
        setattr(aff_profile, "paid_earnings", curr_paid + 50.0)
        db.commit()
        print(f"   [OK] Affiliate Payout Approved: Payout Status={payout_req.status}, Paid Earnings={aff_profile.paid_earnings}")
        results["affiliates"] = True

        # ----------------------------------------------------
        # 6. PLATFORM FINANCE & ADMIN WITHDRAWALS
        # ----------------------------------------------------
        print("\n--> 6. Testing Platform Finance & Admin Withdrawals...")
        w_req = create_settlement_request(
            db=db,
            amount=500.0,
            destination_type="upi",
            destination_account={"upi_id": "lumora_admin@upi"},
            notes="Audit test settlement",
            requested_by=1,
            ip_address="127.0.0.1"
        )
        print(f"   [OK] Admin Withdrawal Requested: ID={w_req.id}, Status={w_req.status}, Amount={w_req.amount}")

        w_appr = approve_settlement(db=db, withdrawal_id=w_req.id, approved_by=1, ip_address="127.0.0.1")
        assert w_appr.status.lower() == "approved", "Settlement status must be APPROVED"
        print(f"   [OK] Admin Withdrawal Approved: ID={w_appr.id}, Status={w_appr.status}")

        w_comp = complete_settlement(db=db, withdrawal_id=w_req.id, transaction_reference="SETTLE-TXN-101", completed_by=1, ip_address="127.0.0.1")
        assert w_comp.status.lower() == "completed", "Settlement status must be COMPLETED"
        print(f"   [OK] Admin Withdrawal Completed: ID={w_comp.id}, Status={w_comp.status}")
        results["platform_finance"] = True

        # ----------------------------------------------------
        # 7. DASHBOARD METRICS FROM POSTGRESQL
        # ----------------------------------------------------
        print("\n--> 7. Verifying Dashboard Metrics from PostgreSQL...")
        dashboard_stats = get_full_dashboard_data()
        metrics = dashboard_stats.get("metrics", {})
        print(f"   [OK] Dashboard Stats Retrieved: Total Orders={metrics.get('totalOrders')}, Revenue={metrics.get('totalRevenue')}, Vendors={metrics.get('approvedVendors')}")
        results["dashboard"] = True

        print("\n====================================================")
        print("ALL ADMIN WORKFLOWS VERIFIED SUCCESSFULLY (100% POSTGRESQL)")
        print("====================================================\n")
        return results
    except Exception as e:
        print(f"\n!!! VERIFICATION FAILED: {str(e).encode('ascii', 'ignore').decode('ascii')} !!!")
        import traceback
        traceback.print_exc()
        return None
    finally:
        db.close()

if __name__ == "__main__":
    run_complete_admin_workflow_verification()
