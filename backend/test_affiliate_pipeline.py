"""
test_affiliate_pipeline.py
===========================
End-to-end simulation of the complete affiliate pipeline on the LOCAL database:
  1. Affiliate (user_id=5, code=AFF0005) exists
  2. A DIFFERENT customer (user_id=21 or 22) clicks the referral link → AffiliateReferral row created
  3. Customer authenticates → AffiliateReferral.customer_id set
  4. Customer purchases → AffiliateCommission created, profile stats updated

Run with:
    python test_affiliate_pipeline.py

Reads/writes the LOCAL SQLite DB. Safe to run — it creates real DB rows but
rolls back at the end so the DB is left clean.
"""
import sys
import logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s %(name)s: %(message)s')

from app.db.session import SessionLocal
from app.models.affiliate import AffiliateProfile, AffiliateCommission, AffiliateReferral, ReferralClick
from app.models.user import User
from app.models.product import Product
from app.models.payment import Payment
from app.services.purchase_service import PurchaseService
import uuid
from datetime import datetime

db = SessionLocal()

print("\n" + "="*70)
print("AFFILIATE PIPELINE END-TO-END TEST")
print("="*70)

# ── 1. Find affiliate ──────────────────────────────────────────────────────
aff_profile = db.query(AffiliateProfile).filter(AffiliateProfile.referral_code == "AFF0005").first()
if not aff_profile:
    print("❌ AFF0005 profile not found. Run the app and activate an affiliate first.")
    sys.exit(1)

print(f"\n✓ Affiliate: user_id={aff_profile.user_id}, code={aff_profile.referral_code}")
print(f"  Before: clicks={aff_profile.total_clicks}, sales={aff_profile.total_sales}, earnings={aff_profile.total_earnings}")

# ── 2. Find a DIFFERENT customer (not the affiliate user) ──────────────────
# Use the first customer whose id != aff_profile.user_id
buyer = db.query(User).filter(
    User.role == "customer",
    User.id != aff_profile.user_id,
    User.is_active == True
).first()
if not buyer:
    print("❌ No customer user found (different from affiliate). Cannot test self-referral guard.")
    sys.exit(1)

print(f"\n✓ Buyer: user_id={buyer.id}, email={buyer.email}")
assert buyer.id != aff_profile.user_id, "BLOCKER: Buyer is same as affiliate — self-referral guard will fire!"

# ── 3. Find an active product ──────────────────────────────────────────────
product = db.query(Product).filter(Product.status != "archived").first()
if not product:
    print("❌ No products found.")
    sys.exit(1)
print(f"\n✓ Product: id={product.id}, title={product.title}, price={product.price}")

# ── 4. Simulate /referrals/click → creates AffiliateReferral row ──────────
print("\n── Step 4: Simulate /referrals/click ──────────────────────────────────")
session_id = f"REF_SESS_{uuid.uuid4().hex}"
referral = AffiliateReferral(
    affiliate_id=aff_profile.id,
    referral_code="AFF0005",
    product_id=product.id,
    session_id=session_id,
    status="CLICKED",
    ip_address="1.2.3.4",
    user_agent="TestBrowser/1.0",
    clicked_at=datetime.utcnow(),
)
db.add(referral)

# Also increment total_clicks
aff_profile.total_clicks = (aff_profile.total_clicks or 0) + 1
db.flush()
print(f"  ✓ AffiliateReferral created: id={referral.id}, session_id={session_id[:30]}...")
print(f"  ✓ total_clicks incremented to {aff_profile.total_clicks}")

# ── 5. Simulate /referrals/authenticate ───────────────────────────────────
print("\n── Step 5: Simulate /referrals/authenticate ───────────────────────────")
referral.customer_id = buyer.id
referral.status = "AUTHENTICATED"
referral.authenticated_at = datetime.utcnow()
db.flush()
print(f"  ✓ Referral authenticated: customer_id={referral.customer_id}, status={referral.status}")

# ── 6. Simulate purchase via PurchaseService.process_purchase ─────────────
print("\n── Step 6: Simulate process_purchase ─────────────────────────────────")
items_payload = [{"product_id": product.id, "price_paid": float(product.price)}]

try:
    order = PurchaseService.process_purchase(
        db=db,
        user_id=buyer.id,
        items_payload=items_payload,
        total_amount=float(product.price),
        payment_method="razorpay",
        affiliate_code="AFF0005",  # Tier 4 fallback — should already be found by Tier 2/3
    )
    db.flush()  # don't commit yet — check then rollback

    print(f"  ✓ Order created: order_id={order.id}, user_id={order.user_id}")
    print(f"  ✓ Order affiliate_id={order.affiliate_id}, referral_code_used={order.referral_code_used}")

    # Check commission was created
    comm = db.query(AffiliateCommission).filter(AffiliateCommission.order_id == order.id).first()
    if comm:
        print(f"\n  ✅ COMMISSION CREATED:")
        print(f"     commission_id={comm.id}")
        print(f"     affiliate_id={comm.affiliate_id}")
        print(f"     product={comm.product_name}")
        print(f"     sale_amount=₹{comm.sale_amount}")
        print(f"     commission_amt=₹{comm.commission_amt}")
        print(f"     status={comm.status}")
    else:
        print("\n  ❌ NO COMMISSION CREATED — check backend logs above for reason")

    # Reload profile stats
    db.refresh(aff_profile)
    print(f"\n  Affiliate profile after purchase:")
    print(f"    total_clicks={aff_profile.total_clicks}")
    print(f"    total_sales={aff_profile.total_sales}")
    print(f"    total_earnings=₹{aff_profile.total_earnings}")

    # Check AffiliateReferral updated to PURCHASED
    db.refresh(referral)
    print(f"\n  AffiliateReferral status after purchase: {referral.status}")

except Exception as e:
    print(f"\n  ❌ process_purchase FAILED: {type(e).__name__}: {e}")
    import traceback; traceback.print_exc()
finally:
    # ALWAYS rollback — this is a test, we don't want to pollute the DB
    db.rollback()
    print(f"\n  ↩ Database rolled back — no permanent changes made")

db.close()
print("\n" + "="*70)
print("TEST COMPLETE")
print("="*70)
print("\nIf you see ✅ COMMISSION CREATED above, the pipeline is working correctly.")
print("If you see ❌ NO COMMISSION CREATED, check the log lines above it for which")
print("Tier (2/3/4) was matched and what went wrong.\n")
