# ⚡ Fix Your Affiliate Dashboard Right Now

Your dashboard shows `₹0` because the **PostgreSQL profile doesn't exist** (only Firestore has it).

## Do This RIGHT NOW (Takes 2 Minutes)

### 1. Open Your Dashboard
Go to: https://lumora-lemon-seven.vercel.app/affiliate/dashboard

### 2. Open Browser Console
- Press `F12` or right-click → Inspect
- Go to "Console" tab

### 3. Paste This Code & Press Enter
```javascript
fetch('https://lumora-backend-8mf6.onrender.com/api/affiliate/activate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('lumora_backend_token')
  }
}).then(r => r.json()).then(d => {
  console.log('✅ Result:', d);
  if (d.referral_code) {
    alert('✅ Profile created! Code: ' + d.referral_code + '\n\nRefresh the page now.');
  } else {
    alert('⚠️ Check console for details');
  }
}).catch(e => {
  console.error('❌ Error:', e);
  alert('❌ Error - check console');
})
```

### 4. Refresh the Page
Press `Ctrl+R` or `F5`

### 5. Check Dashboard
Should now show:
- ✅ Your referral code (AFF001 or similar)
- ✅ "Total Clicks: 0" (but now it will actually count clicks)
- ✅ "Total Earnings: ₹0" (but future purchases will show)

---

## Test It Works

After the refresh:

1. Copy your referral link from dashboard
2. Open in **incognito window** (Ctrl+Shift+N)
3. Log in as a **DIFFERENT customer** (NOT your own email)
4. Buy something
5. Go back to dashboard → Should show +1 click and +₹X earnings

---

## Why This Works

The one-liner calls the `/activate` endpoint which:
- Creates your `AffiliateProfile` in PostgreSQL ✅
- Syncs the code from Firestore (keeps `AFF001` intact) ✅
- Makes click tracking actually work ✅

---

## If It Still Shows 0 After Testing

The old test purchases have `affiliate_code=NULL` and can't be fixed retroactively. You need **fresh purchases** after running the fix above.

---

**All backend code fixes are already deployed. Just run the console command above to create your profile.**
