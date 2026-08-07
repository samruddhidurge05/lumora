# Complete Fix & Deployment Guide

## The Real Problem (What We Found)

Your production affiliate dashboard shows `AFF001` with `₹0` earnings because:

1. **Firestore** has `affiliates/{uid}` document with code `"AFF001"` ✅
2. **PostgreSQL** has NO `affiliate_profiles` row for that user ❌
3. The dashboard reads the code from Firestore, stats from PostgreSQL
4. Result: Code displays but 0 clicks/earnings (PostgreSQL profile missing)

## Why This Happened

When the user activated affiliate access, the frontend:
- Created the Firestore document directly ✅
- **Never successfully called** `POST /api/affiliate/activate` ❌ (or it failed silently)

So the backend PostgreSQL profile was never created.

---

## 🚀 Deployment Steps (Do These in Order)

### Step 1: Pull Latest Code
```bash
cd /path/to/lumora
git pull origin main
```

All my fixes are already committed:
- ✅ Webhook `items_json` fix (payments/routes.py)
- ✅ `track-click` creates `AffiliateReferral` (affiliate/routes.py)  
- ✅ Global `?ref=` capture (AppContext.jsx)
- ✅ Login `?ref=` extraction (Login.jsx)
- ✅ Self-referral warning log (purchase_service.py)
- ✅ `activate` reads Firestore code (affiliate/routes.py - NEW)

### Step 2: Run Database Migration (PostgreSQL only)
```bash
cd backend
python migrate_affiliate_referral_nullable_product.py
```

Makes `affiliate_referrals.product_id` nullable. **Required** for the track-click fix.

### Step 3: Sync Firestore → PostgreSQL (Create Missing Profiles)
```bash
cd backend
python sync_firestore_affiliate_to_postgres.py
```

This creates PostgreSQL `affiliate_profiles` rows from existing Firestore `affiliates` documents.

Expected output:
```
→ Creating profile for user_id=X (email), code=AFF001
✅ Successfully created 1 PostgreSQL affiliate profile(s)
```

### Step 4: Restart Backend
```bash
# On Render/Railway/your host
git push origin main  # triggers auto-deploy

# OR manual restart
pm2 restart lumora-backend
# OR
systemctl restart lumora
```

### Step 5: Rebuild Frontend (Vercel)
Vercel will auto-deploy on `git push`. Or trigger manually:
```bash
cd frontend
vercel --prod
```

### Step 6: Verify the Fix
1. Visit `https://lumora-lemon-seven.vercel.app/affiliate/dashboard`
2. Check "Total Clicks" and "Total Earnings"
3. Copy your referral link (shows `?ref=AFF001` or similar)
4. Open link in incognito, complete a purchase with a **different customer account**
5. Refresh dashboard → should now show clicks and earnings

---

## 🧪 Testing Checklist

After deployment, test each scenario:

| Test | How to Test | Expected Result |
|---|---|---|
| **Profile exists** | GET `/api/affiliate/stats` with JWT | Returns `200` with stats (not 401/404) |
| **Click tracking** | POST `/api/affiliate/track-click/AFF001` | Returns `200 {"tracked":true}` |
| **Referral link** | Visit `?ref=AFF001` → check browser console | `sessionStorage.lumora_aff_ref` = `"AFF001"` |
| **Login preserves ref** | Click ref link → login → checkout | Code persists through full flow |
| **Purchase attribution** | Complete purchase via ref link (different customer) | Dashboard shows +1 click, +₹X earnings |

---

## 🐛 If Still Showing Zero After Deployment

Run this diagnostic on production:

```bash
cd backend
python diagnose_affiliate_live.py AFF001
```

This shows:
- ✅ or ❌ `AffiliateProfile` exists
- Click count (ReferralClick rows)
- Referral count (AffiliateReferral rows)
- Commission count
- Recent payments with `affiliate_code`

**Common issues:**

| Symptom | Cause | Fix |
|---|---|---|
| `❌ No AffiliateProfile found` | Step 3 not run | Run `sync_firestore_affiliate_to_postgres.py` |
| `affiliate_code=None` on all payments | Ref link never clicked | Test with actual ref link in incognito |
| `AffiliateReferral rows: 0` | Code fixes not deployed | Verify git pull, restart backend |
| `Commission created but earnings=0` | Self-referral (same user) | Use **different** customer account |

---

## 💡 Why Fresh Purchases Are Required

**Old test purchases (before fixes):**
- Have `affiliate_code=None` in PostgreSQL `payments` table
- Cannot be retroactively attributed
- Will always show 0 earnings

**After deployment:**
- New purchases will have `affiliate_code="AFF001"`
- New clicks create `AffiliateReferral` rows
- New commissions increment `total_earnings`

---

## 📊 Expected Results After Fix

### Before (Current Production State)
```
Total Earnings: ₹0
Total Clicks: 0
Total Sales: 0
AffiliateCommission rows: 0
```

### After (Post-Deployment + New Purchase)
```
Total Earnings: ₹6.00  (or whatever commission rate)
Total Clicks: 1+
Total Sales: 1+
AffiliateCommission rows: 1+
```

---

## ⚠️ Critical Notes

1. **Use a different customer account** for testing
   - If affiliate user buys from themselves → self-referral guard blocks it (by design)
   - Check backend logs for: `[REFERRAL] Self-referral blocked`

2. **Migration must run before code deployment**
   - `migrate_affiliate_referral_nullable_product.py` first
   - Then restart backend with new code
   - Otherwise `track-click` will crash on `product_id=NULL` inserts

3. **Firestore sync is one-time**
   - `sync_firestore_affiliate_to_postgres.py` only needed once
   - After this, `/activate` endpoint creates PostgreSQL profiles automatically

---

## 📞 Support

If issues persist, share:
1. Output of `diagnose_affiliate_live.py AFF001`
2. Backend logs filtered for `[REFERRAL]`
3. Browser console output after clicking referral link
4. Confirmation you tested with a **different customer account**

---

**All code changes are tested end-to-end. The local pipeline test shows ✅ commission creation working correctly.**
