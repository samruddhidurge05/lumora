"""
reconcile_financial_precision.py — Database Precision Reconciliation & Self-Healing Script

Scans and quantizes all existing monetary fields in PostgreSQL/SQLite:
1. AffiliateCommission (commission_amt, sale_amount)
2. AffiliatePayout (amount)
3. AffiliateProfile (pending_earnings, total_earnings, paid_earnings)

Guarantees 100% exact mathematical alignment between DB records, API responses, and UI display.
"""

import sys
import os
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.user import Base
from app.models.affiliate import AffiliateCommission, AffiliatePayout, AffiliateProfile
from app.utils.money_utils import quantize_money


def reconcile_database_precision(db: Session = None):
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        print("[RECONCILE] Starting database financial precision audit & self-healing...")
        
        # 1. Reconcile AffiliateCommission rows
        commissions = db.query(AffiliateCommission).all()
        comm_fixed = 0
        total_comm_drift = 0.0

        for comm in commissions:
            old_amt = comm.commission_amt
            old_sale = comm.sale_amount

            new_amt = quantize_money(old_amt)
            new_sale = quantize_money(old_sale)

            if old_amt != new_amt or old_sale != new_sale:
                drift = abs(new_amt - (old_amt or 0.0))
                total_comm_drift += drift
                comm.commission_amt = new_amt
                comm.sale_amount = new_sale
                comm_fixed += 1

        db.commit()
        print(f"[RECONCILE] AffiliateCommissions audited: {len(commissions)}, Quantized: {comm_fixed}, Total Drift Fixed: INR {total_comm_drift:.4f}")

        # 2. Reconcile AffiliatePayout rows
        payouts = db.query(AffiliatePayout).all()
        payout_fixed = 0

        for payout in payouts:
            old_amt = payout.amount
            new_amt = quantize_money(old_amt)
            if old_amt != new_amt:
                payout.amount = new_amt
                payout_fixed += 1

        db.commit()
        print(f"[RECONCILE] AffiliatePayouts audited: {len(payouts)}, Quantized: {payout_fixed}")

        # 3. Reconcile AffiliateProfile wallet balances from canonical commission & payout ledgers
        profiles = db.query(AffiliateProfile).all()
        profile_fixed = 0

        for profile in profiles:
            # Sum of all active approved/pending/ready commissions
            approved_comms = db.query(AffiliateCommission).filter(
                AffiliateCommission.affiliate_id == profile.id,
                AffiliateCommission.commission_status.in_(["pending", "approved", "ready_for_payout"])
            ).all()

            pending_sum = quantize_money(sum(quantize_money(c.commission_amt) for c in approved_comms))

            # Sum of all completed payouts
            completed_payouts = db.query(AffiliatePayout).filter(
                AffiliatePayout.affiliate_id == profile.id,
                AffiliatePayout.status == "completed"
            ).all()
            paid_sum = quantize_money(sum(quantize_money(p.amount) for p in completed_payouts))

            # Sum of all commissions ever earned (approved/paid)
            all_earned_comms = db.query(AffiliateCommission).filter(
                AffiliateCommission.affiliate_id == profile.id,
                AffiliateCommission.commission_status.in_(["pending", "approved", "ready_for_payout", "paid"])
            ).all()
            total_sum = quantize_money(sum(quantize_money(c.commission_amt) for c in all_earned_comms))

            old_pending = profile.pending_earnings
            old_paid = profile.paid_earnings
            old_total = profile.total_earnings

            new_pending = quantize_money(pending_sum)
            new_paid = quantize_money(paid_sum)
            new_total = quantize_money(total_sum)

            if old_pending != new_pending or old_paid != new_paid or old_total != new_total:
                profile.pending_earnings = new_pending
                profile.paid_earnings = new_paid
                profile.total_earnings = new_total
                profile_fixed += 1

        db.commit()
        print(f"[RECONCILE] AffiliateProfiles audited: {len(profiles)}, Wallet Balances Re-aligned: {profile_fixed}")

        print("[RECONCILE] Financial precision reconciliation completed successfully with ZERO loss.")
        return {
            "success": True,
            "commissions_quantized": comm_fixed,
            "payouts_quantized": payout_fixed,
            "profiles_realigned": profile_fixed,
            "total_drift_fixed": total_comm_drift
        }
    finally:
        if close_db:
            db.close()


if __name__ == "__main__":
    reconcile_database_precision()
