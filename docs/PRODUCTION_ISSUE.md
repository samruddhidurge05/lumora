# Production Issue — Data Mismatch Between Firestore and PostgreSQL

## The Real Problem

The affiliate dashboard shows `AFF001` and `₹0` because:

1. **Firestore** has an `affiliates/{uid}` document with `affiliateCode: "AFF001"`
2. **PostgreSQL** has NO `AffiliateProfile` row for that user
3. All affiliate stats (clicks, sales, earnings) are stored in **PostgreSQL only**
4. The dashboard reads the code from Firestore, but stats from PostgreSQL
5. Result: Dashboard shows the code but zero stats (because PostgreSQL profile doesn't exist)

## Why This Happened

The user activated affiliate access via the frontend, which:
1. Created the Firestore `affiliates/{uid}` document ✅
2. **Never called** `POST /api/affiliate/activate` on the backend ❌

OR

The `POST /api/affiliate/activate` was called but failed silently (401, 500, network error).

## How to Verify

SSH into production and run:
```bash
# Check if AffiliateProfile exists in PostgreSQL
psql $DATABASE_URL -c "SELECT id, user_id, referral_code, total_clicks, total_sales, total_earnings, is_active, status FROM affiliate_profiles WHERE referral_code = 'AFF001';"

# Check if user exists
psql $DATABASE_URL -c "SELECT id, email, role, is_active FROM users WHERE email = 'durgemaitri2@gmail.com';"
```

Expected result: **0 rows** for AffiliateProfile (this is the bug).

## The Fix

The user needs to **re-activate affiliate access** via the backend. Two options:

### Option 1: User clicks "Activate Affiliate" again (recommended)
1. Log into the site as `durgemaitri2@gmail.com`
2. Navigate to `/affiliate/activate`
3. Click "Activate Affiliate Access"
4. This will call `POST /api/affiliate/activate` which creates the PostgreSQL row

### Option 2: Manual SQL insert (if Option 1 fails)
```sql
-- Find the user's ID
SELECT id, email FROM users WHERE email = 'durgemaitri2@gmail.com';
-- Let's say user_id = 123

-- Insert AffiliateProfile
INSERT INTO affiliate_profiles (
    user_id, referral_code, commission_rate, 
    total_earnings, total_clicks, total_sales, 
    is_active, status, created_at, updated_at
) VALUES (
    123, 'AFF001', 20.0,
    0.0, 0, 0,
    true, 'active', NOW(), NOW()
);
```

### Option 3: Backend script to sync Firestore → PostgreSQL
```python
# sync_firestore_affiliates.py
from app.db.session import SessionLocal
from app.models.affiliate import AffiliateProfile
from app.models.user import User
from app.shared.firebase.connection import db as fs_db

db = SessionLocal()

# Get all Firestore affiliate docs
aff_docs = fs_db.collection('affiliates').stream()

for doc in aff_docs:
    data = doc.to_dict()
    uid = doc.id
    aff_code = data.get('affiliateCode')
    
    # Find user by firebase_uid
    user = db.query(User).filter(User.firebase_uid == uid).first()
    if not user:
        print(f"User not found for uid={uid}")
        continue
    
    # Check if profile exists
    profile = db.query(AffiliateProfile).filter(
        AffiliateProfile.user_id == user.id
    ).first()
    
    if not profile:
        print(f"Creating profile for user_id={user.id}, code={aff_code}")
        profile = AffiliateProfile(
            user_id=user.id,
            referral_code=aff_code,
            commission_rate=20.0,
            total_earnings=0.0,
            total_clicks=0,
            total_sales=0,
            is_active=True,
            status='active'
        )
        db.add(profile)

db.commit()
db.close()
```

## Why My Code Fixes Are Still Needed

Even after creating the PostgreSQL profile, the affiliate pipeline will still fail because:

1. **Bug #1** (webhook `items_payload=[]`) will create empty orders
2. **Bug #3** (`track-click` not creating `AffiliateReferral`) will lose attribution
3. **Bug #4** (no global `?ref=` capture) will lose the code before checkout

So you need BOTH:
1. Create the PostgreSQL profile (fix data sync)
2. Deploy my code changes (fix pipeline bugs)

## Immediate Action

**Right now, on production, do this:**

1. Open browser console on the affiliate dashboard
2. Run:
```javascript
fetch('https://lumora-backend-8mf6.onrender.com/api/affiliate/activate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('lumora_backend_token')
  }
}).then(r => r.json()).then(console.log).catch(console.error)
```

3. Check response — if it says `"already_active": false` → profile was just created ✅

4. Refresh dashboard — should now show the profile stats (still 0, but now it will track clicks)

## Then Deploy Code Fixes

After the profile exists in PostgreSQL, deploy all 6 code changes + migration so future clicks and purchases work correctly.
