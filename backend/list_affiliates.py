"""List all affiliate profiles and recent orders/payments to find what code to test with."""
from app.db.session import SessionLocal
from app.models.affiliate import AffiliateProfile, AffiliateCommission, ReferralClick, AffiliateReferral
from app.models.order import Order
from app.models.payment import Payment
from app.models.user import User

db = SessionLocal()

print("\n=== AFFILIATE PROFILES ===")
profiles = db.query(AffiliateProfile).all()
if not profiles:
    print("No affiliate profiles found in DB.")
else:
    for p in profiles:
        user = db.query(User).filter(User.id == p.user_id).first()
        print(f"  ID={p.id}  code={p.referral_code}  user_id={p.user_id}  "
              f"email={user.email if user else 'N/A'}  "
              f"clicks={p.total_clicks}  sales={p.total_sales}  "
              f"earnings={p.total_earnings}  active={p.is_active}  status={p.status}")

print("\n=== RECENT PAYMENTS (last 10) ===")
payments = db.query(Payment).order_by(Payment.id.desc()).limit(10).all()
if not payments:
    print("No payments found.")
else:
    for pmt in payments:
        print(f"  ref={pmt.payment_ref}  status={pmt.status}  amount={pmt.amount}  "
              f"affiliate_code={pmt.affiliate_code}  order_id={pmt.order_id}  "
              f"has_items_json={'YES' if pmt.items_json else 'NO'}")

print("\n=== AFFILIATE REFERRAL ROWS (last 10) ===")
refs = db.query(AffiliateReferral).order_by(AffiliateReferral.id.desc()).limit(10).all()
if not refs:
    print("No AffiliateReferral rows found.")
else:
    for r in refs:
        print(f"  id={r.id}  code={r.referral_code}  product_id={r.product_id}  "
              f"customer_id={r.customer_id}  status={r.status}  order_id={r.order_id}")

print("\n=== AFFILIATE COMMISSIONS (all) ===")
comms = db.query(AffiliateCommission).order_by(AffiliateCommission.id.desc()).limit(10).all()
if not comms:
    print("No commissions found.")
else:
    for c in comms:
        print(f"  id={c.id}  affiliate_id={c.affiliate_id}  order_id={c.order_id}  "
              f"product={c.product_name}  amt={c.commission_amt}  status={c.status}")

print("\n=== REFERRAL CLICKS (last 10) ===")
clicks = db.query(ReferralClick).order_by(ReferralClick.id.desc()).limit(10).all()
if not clicks:
    print("No ReferralClick rows found.")
else:
    for cl in clicks:
        print(f"  id={cl.id}  affiliate_id={cl.affiliate_id}  ip={cl.ip_address}  "
              f"clicked_at={cl.clicked_at}")

db.close()
