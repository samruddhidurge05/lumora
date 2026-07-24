"""
sync_firestore_affiliate_to_postgres.py
========================================
Creates missing AffiliateProfile rows in PostgreSQL by syncing from Firestore.

Fixes the production issue where:
- Firestore has affiliates/{uid} documents
- PostgreSQL has NO matching affiliate_profiles rows
- Result: Dashboard shows code but 0 stats (clicks, sales, earnings)

Run on production:
    python sync_firestore_affiliate_to_postgres.py

Safe to run multiple times (idempotent).
"""
import logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

from app.db.session import SessionLocal
from app.models.affiliate import AffiliateProfile
from app.models.user import User

try:
    from app.shared.firebase.connection import db as fs_db, firebase_connected
except:
    fs_db = None
    firebase_connected = False

if not firebase_connected or not fs_db:
    print("❌ Firebase not connected. Cannot sync from Firestore.")
    print("   Check serviceAccountKey.json and FIREBASE_PROJECT_ID in .env")
    exit(1)

db = SessionLocal()

print("\n" + "="*80)
print("FIRESTORE → POSTGRESQL AFFILIATE SYNC")
print("="*80 + "\n")

# Get all Firestore affiliate docs
aff_docs = fs_db.collection('affiliates').stream()
synced = 0
skipped = 0
created = 0

for doc in aff_docs:
    data = doc.to_dict()
    uid = doc.id
    aff_code = data.get('affiliateCode') or data.get('affiliate_code') or data.get('referralCode')
    
    if not aff_code:
        print(f"⚠ Skipping uid={uid}: No affiliate code in Firestore doc")
        skipped += 1
        continue
    
    # Find user by firebase_uid
    user = db.query(User).filter(User.firebase_uid == uid).first()
    if not user:
        print(f"⚠ Skipping uid={uid}, code={aff_code}: User not found in PostgreSQL")
        skipped += 1
        continue
    
    # Check if profile exists
    profile = db.query(AffiliateProfile).filter(
        AffiliateProfile.user_id == user.id
    ).first()
    
    if profile:
        # Verify code matches
        if profile.referral_code != aff_code:
            print(f"⚠ user_id={user.id}: PostgreSQL has code='{profile.referral_code}' but Firestore has '{aff_code}'")
        else:
            print(f"✓ user_id={user.id} ({user.email}): Profile already exists with code={aff_code}")
        synced += 1
    else:
        # Create profile
        print(f"→ Creating profile for user_id={user.id} ({user.email}), code={aff_code}")
        profile = AffiliateProfile(
            user_id=user.id,
            referral_code=aff_code,  # Use Firestore code exactly
            commission_rate=data.get('commissionRate', 20.0),
            total_earnings=0.0,
            total_clicks=data.get('totalClicks', 0),
            total_sales=data.get('totalConversions', 0),
            is_active=data.get('status') == 'active',
            status=data.get('status', 'active')
        )
        db.add(profile)
        created += 1

if created > 0:
    try:
        db.commit()
        print(f"\n✅ Successfully created {created} PostgreSQL affiliate profile(s)")
    except Exception as e:
        db.rollback()
        print(f"\n❌ Failed to commit: {e}")
        exit(1)
else:
    print(f"\n✓ No new profiles needed")

print(f"\nSummary: {created} created, {synced} already synced, {skipped} skipped")
print("="*80 + "\n")

# Verify the sync
print("Verifying...")
for doc in fs_db.collection('affiliates').limit(5).stream():
    data = doc.to_dict()
    uid = doc.id
    code = data.get('affiliateCode')
    user = db.query(User).filter(User.firebase_uid == uid).first()
    if user:
        profile = db.query(AffiliateProfile).filter(AffiliateProfile.user_id == user.id).first()
        status = "✅" if profile else "❌"
        print(f"  {status} uid={uid[:8]}... code={code} → PostgreSQL profile={'EXISTS' if profile else 'MISSING'}")

db.close()
print("\nDone. Re-run diagnose_affiliate_live.py to verify the fix.\n")
