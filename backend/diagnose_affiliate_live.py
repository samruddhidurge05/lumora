"""
diagnose_affiliate_live.py
===========================
Debug script to check what affiliate data exists in the database
and why the dashboard shows 0.

Usage:
    python diagnose_affiliate_live.py <affiliate_code>

Example:
    python diagnose_affiliate_live.py AFF0001
"""
import sys
from app.db.session import SessionLocal
from app.models.affiliate import AffiliateProfile, AffiliateCommission, ReferralClick, AffiliateReferral
from app.models.order import Order
from app.models.payment import Payment
from app.models.user import User

if len(sys.argv) < 2:
    print("Usage: python diagnose_affiliate_live.py <affiliate_code>")
    sys.exit(1)

code = sys.argv[1].strip().upper()

db = SessionLocal()
print(f"\n{'='*80}")
print(f"AFFILIATE DIAGNOSTIC REPORT — Code: {code}")
print(f"{'='*80}\n")

# 1. Find the AffiliateProfile
profile = db.query(AffiliateProfile).filter(AffiliateProfile.referral_code == code).first()
if not profile:
    print(f"❌ No AffiliateProfile found for code '{code}'")
    sys.exit(1)

print(f"✓ AffiliateProfile found:")
print(f"  • ID: {profile.id}")
print(f"  • User ID: {profile.user_id}")
print(f"  • Referral Code: {profile.referral_code}")
print(f"  • Total Clicks: {profile.total_clicks}")
print(f"  • Total Sales: {profile.total_sales}")
print(f"  • Total Earnings: ₹{profile.total_earnings or 0:.2f}")
print(f"  • Status: {profile.status}")
print(f"  • Is Active: {profile.is_active}")
print()

# 2. Check ReferralClick table
clicks = db.query(ReferralClick).filter(ReferralClick.affiliate_id == profile.id).all()
print(f"ReferralClick rows: {len(clicks)}")
for i, click in enumerate(clicks[:5], 1):
    print(f"  {i}. IP: {click.ip_address}, Clicked: {click.clicked_at}")
if len(clicks) > 5:
    print(f"  ... and {len(clicks) - 5} more")
print()

# 3. Check AffiliateReferral table (the one purchase_service queries)
referrals = db.query(AffiliateReferral).filter(AffiliateReferral.referral_code == code).all()
print(f"AffiliateReferral rows: {len(referrals)}")
for i, ref in enumerate(referrals[:5], 1):
    print(f"  {i}. Product ID: {ref.product_id}, Customer ID: {ref.customer_id}, Status: {ref.status}, Order ID: {ref.order_id}")
if len(referrals) > 5:
    print(f"  ... and {len(referrals) - 5} more")
print()

# 4. Check AffiliateCommission table (should have rows if purchases completed)
commissions = db.query(AffiliateCommission).filter(AffiliateCommission.affiliate_id == profile.id).all()
print(f"AffiliateCommission rows: {len(commissions)}")
if commissions:
    for i, comm in enumerate(commissions[:5], 1):
        print(f"  {i}. Order ID: {comm.order_id}, Product: {comm.product_name}, Amount: ₹{comm.commission_amt:.2f}, Status: {comm.status}")
else:
    print("  ❌ NO COMMISSIONS FOUND — This is why earnings are 0")
print()

# 5. Check recent Orders that might be linked
user = db.query(User).filter(User.id == profile.user_id).first()
if user:
    print(f"Affiliate User: {user.name} ({user.email})")
    
    # Check if there are any orders with affiliate_id set
    aff_orders = db.query(Order).filter(Order.affiliate_id == profile.id).all()
    print(f"Orders with affiliate_id={profile.id}: {len(aff_orders)}")
    for ord in aff_orders[:3]:
        print(f"  • Order #{ord.id}: ₹{ord.total_amount}, Status: {ord.status}, User ID: {ord.user_id}")
print()

# 6. Check recent Payments (to see if affiliate_code was stored)
recent_payments = (
    db.query(Payment)
    .filter(Payment.affiliate_code == code)
    .order_by(Payment.created_at.desc())
    .limit(5)
    .all()
)
print(f"Payments with affiliate_code='{code}': {len(recent_payments)}")
for pmt in recent_payments:
    print(f"  • Ref: {pmt.payment_ref}, Status: {pmt.status}, Amount: ₹{pmt.amount}, Order ID: {pmt.order_id}")
    if pmt.items_json:
        print(f"    → items_json: {pmt.items_json[:100]}...")
    else:
        print(f"    ⚠️  NO items_json — Bug #1 would fire here!")
print()

print(f"{'='*80}")
print("DIAGNOSIS COMPLETE")
print(f"{'='*80}\n")

print("Next steps:")
print("1. If AffiliateCommission is empty → The purchase flow never created a commission")
print("2. If ReferralClick exists but AffiliateReferral is empty → Bug #3 was active")
print("3. If Payment has no items_json → Bug #1 was active (webhook path)")
print("4. If AffiliateReferral exists but customer_id is NULL → /authenticate was never called")
print()

db.close()
