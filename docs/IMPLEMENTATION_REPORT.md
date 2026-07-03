# Lumora — Implementation Report
> Blueprint for implementing the missing integration layer.
> Specifies exactly which files to add, which files to modify, and what each change does.
> Vendor, Affiliate, and Customer code must NOT be touched.
> Date: July 2, 2026

---

## Table of Contents

1. [Implementation Philosophy](#1-implementation-philosophy)
2. [Priority 1 — Critical Fixes (Admin is broken without these)](#2-priority-1--critical-fixes)
3. [Priority 2 — Security Fixes](#3-priority-2--security-fixes)
4. [Priority 3 — Data Consistency](#4-priority-3--data-consistency)
5. [Priority 4 — Quality & Cleanup](#5-priority-4--quality--cleanup)
6. [Files to Add](#6-files-to-add)
7. [Files to Modify](#7-files-to-modify)
8. [Files to NOT Touch](#8-files-to-not-touch)
9. [New Backend Layer: admin_controls/](#9-new-backend-layer-admin_controls)
10. [Validation Checklist](#10-validation-checklist)

---

## 1. Implementation Philosophy

> Add the missing connection. Do not rewrite what works.

Every fix in this plan adds something that is missing. Nothing removes or rewrites existing working code. The vendor system is complete. The affiliate system is complete. The customer system is complete. Only the admin integration layer has gaps.

**Rule:** If a file is not listed in Section 7 (Files to Modify), it must not be changed.

---

## 2. Priority 1 — Critical Fixes

These three fixes unblock the entire Admin portal. Without them, all admin data pages show empty or return 401.

---

### P1-A — Fix Admin Authentication

**Problem:** Admin login at `admin@lumora.co` sets a localStorage mock with no Firebase auth and no backend JWT. Every `require_admin_role()` FastAPI call returns 401.

**What to change:** `frontend/src/context/AuthContext.jsx` — admin login block

**What to add:** After setting the mock user, call `POST /api/auth/firebase-sync` OR `POST /api/auth/login` with hardcoded admin credentials to get a real JWT.

**OR (preferred):** Create a real admin user in SQLite via a backend seed script, then use `POST /api/auth/login` in the admin mock block.

**File to add:** `backend/scripts/seed_admin.py`
```
Creates a user with email=admin@lumora.co, role=admin in SQLite
Run once: python seed_admin.py
```

**File to modify:** `frontend/src/context/AuthContext.jsx`
```
In the admin mock login block, after setting mock user, call:
  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@lumora.co', password: ADMIN_PASSWORD })
  })
  const data = await res.json()
  localStorage.setItem('lumora_backend_token', data.access_token)
  localStorage.setItem('lumora_backend_uid', String(data.user.id))
```

**Impact:** All admin FastAPI calls that require `require_admin_role()` will work.

---

### P1-B — Sync Orders to Firestore

**Problem:** `POST /api/orders/` writes to SQLite only. Admin Orders, Admin Analytics, Admin Dashboard, and Admin Payments all read from Firestore `orders`. The collection is empty.

**What to add:** `backend/admin/firestore/admin_firestore.py` — new function `sync_order_to_firestore`

```python
def sync_order_to_firestore(order, items):
    """Sync a SQLite order record to Firestore so admin can read it."""
    if not firebase_connected or db is None:
        return
    try:
        doc_ref = db.collection("orders").document(str(order.id))
        doc_ref.set({
            "orderId": f"ORD-{order.id}",
            "customerId": str(order.user_id),
            "customerEmail": "",         # enriched below if user passed
            "customerName": "Customer",
            "items": [
                {
                    "productId": str(item.product_id),
                    "price": float(item.price_paid),
                }
                for item in items
            ],
            "totalINR": float(order.total_amount),
            "price": float(order.total_amount),
            "status": order.status or "completed",
            "paymentMethod": order.payment_method or "upi",
            "paymentStatus": "Paid",
            "createdAt": order.created_at.isoformat() + "Z" if order.created_at else "",
            "ref": order.promo_code or "",
        }, merge=True)
    except Exception as e:
        print(f"[firestore-sync] Error syncing order {order.id}: {e}")
```

**File to modify:** `backend/app/api/orders/routes.py` — `create_new_order` endpoint

```python
# After db.commit() and db.refresh(order):
from admin.firestore.admin_firestore import sync_order_to_firestore
sync_order_to_firestore(order, order.items)
```

**Impact:** Every customer checkout now creates a Firestore `orders` document. Admin Orders, Analytics, Dashboard, and Payments all populate with real data.

---

### P1-C — Update SQLite When Admin Changes Order Status

**Problem:** `admin_api/orders/services.py` `modify_order_status()` updates Firestore only. SQLite orders are never updated by admin actions. Download access checks read SQLite — a "Completed" order in Firestore but "pending" in SQLite breaks download entitlement.

**File to modify:** `backend/app/admin_api/orders/services.py` — `modify_order_status` function

```python
def modify_order_status(order_id: str, status: str):
    _require_db()
    # 1. Update Firestore (existing)
    ref = db.collection("orders").document(order_id)
    ref.update({"status": status, "updatedAt": datetime.utcnow().isoformat() + "Z"})
    
    # 2. Update SQLite (add this block)
    from app.db.session import SessionLocal
    from app.models.order import Order as OrderModel
    db_s = SessionLocal()
    try:
        order = db_s.query(OrderModel).filter(OrderModel.id == int(order_id)).first()
        if order:
            order.status = status.lower()
            db_s.commit()
    except Exception as e:
        print(f"[order-sync] Could not update SQLite order {order_id}: {e}")
    finally:
        db_s.close()
    
    # 3. Affiliate conversion (existing)
    snap = ref.get()
    if status.lower() == "completed":
        try:
            check_and_create_affiliate_conversion(order_id, snap.to_dict())
        except Exception as err:
            print(f"[Affiliate] Error creating conversion: {err}")
    
    return {"success": True, "id": order_id, "status": status}
```

**Impact:** SQLite and Firestore stay synchronized. Download authorization, vendor order list, and customer order history all reflect the correct status.

---

## 3. Priority 2 — Security Fixes

These fixes close financial and authorization vulnerabilities.

---

### P2-A — Move Commission Creation to FastAPI

**Problem:** `ecosystemService.js` calculates and writes affiliate commissions directly to Firestore from the browser. Commission amounts are set by client-side code.

**What to change:** `frontend/src/services/ecosystemService.js`

Remove the affiliate conversion call from `onPurchaseComplete`. Instead, include the referral code in the order payload sent to FastAPI.

**File to modify:** `frontend/src/context/AppContext.jsx` — `completePurchase` function

```javascript
// Add affCode to the order payload:
const orderPayload = {
  items: [...],
  total_amount: totalINR,
  payment_method: paymentMethod,
  promo_code: promoCode || null,
  ref_code: affCode || null,   // ← add this field
};
createOrderApi(orderPayload)
```

**File to modify:** `backend/app/api/orders/routes.py` — `create_new_order`

```python
# After order creation, if ref_code provided:
if order_in.ref_code:
    from app.admin_api.orders.services import check_and_create_affiliate_conversion
    order_data = {
        "ref": order_in.ref_code,
        "status": "completed",
        "amount": order_in.total_amount,
        # ... other fields
    }
    check_and_create_affiliate_conversion(str(order.id), order_data)
```

**File to modify:** `backend/app/api/orders/schemas.py` — add `ref_code` field to `OrderCreate`

**Impact:** Commission amounts are calculated server-side. The `check_and_create_affiliate_conversion` function in `admin_api/orders/services.py` already has the correct category-based commission rate logic and uses server-side calculation.

---

### P2-B — Route Affiliate Payouts Through FastAPI

**Problem:** `affiliateService.js` writes payout requests directly to Firestore `affiliatePayoutRequests`, bypassing the validated `POST /api/affiliate/payouts` endpoint.

**What to change:** Identify where `affiliateService.requestPayout()` is called in the affiliate Earnings page and replace with `backendFetch('/affiliate/payouts', {method:'POST', body: JSON.stringify({amount, method})})`

**File to modify:** `frontend/src/pages/affiliate/Earnings.jsx`

Replace any direct payout write with:
```javascript
await backendFetch('/affiliate/payouts', {
  method: 'POST',
  body: JSON.stringify({ amount: payoutAmount, method: payoutMethod })
})
```

The FastAPI endpoint already exists at `POST /api/affiliate/payouts` and validates:
- Amount ≥ ₹500
- No duplicate pending payout
- Amount ≤ available approved balance

**Impact:** Payout requests are server-validated. Inflated payout amounts blocked. Duplicate requests prevented.

---

### P2-C — Fix Settings Bypass

**Problem:** `settingsService.js` writes feature flags directly to Firestore `platformSettings/global` without going through FastAPI. The `PUT /api/admin/settings/` endpoint (which has `require_admin_role()`) exists but is not used for these writes.

**File to modify:** `frontend/src/services/settingsService.js`

Replace all `setDoc`/`updateDoc` on `platformSettings/global` with:
```javascript
import { backendFetch } from '../utils/api';

export const updatePlatformSettings = async (settingsData) => {
  return await backendFetch('/admin/settings/', {
    method: 'PUT',
    body: JSON.stringify(settingsData)
  });
};
```

**Impact:** All settings changes require a valid admin JWT. Unauthorized settings changes blocked.

---

### P2-D — Add Authentication to Admin Payments Endpoints

**Problem:** All `/api/admin/payments/*` endpoints have no auth check. Any request can read financial data and trigger vendor payouts.

**File to modify:** `backend/app/admin_api/payments/routes.py`

Add `require_admin_role` dependency to every endpoint:
```python
from admin.validators.admin_auth import require_admin_role

@router.get("/telemetry")
def get_telemetry(admin_user = Depends(require_admin_role)):
    return get_payments_telemetry()

@router.post("/payout")
def post_payout(
    vendor_id: str = Body(..., embed=True),
    amount: float = Body(..., embed=True),
    admin_user = Depends(require_admin_role)   # ← add
):
    ...
```

**Impact:** Financial data and payout triggers require admin authentication.

---

## 4. Priority 3 — Data Consistency

---

### P3-A — Remove Duplicate Purchase Records

**Problem:** `purchaseService.js` writes to Firestore `purchases` on checkout. `createOrderApi()` writes to SQLite `orders`. Same event creates two records in different stores.

**File to modify:** `frontend/src/services/ecosystemService.js`

Remove or comment out the `recordPurchase()` call. The SQLite order record is the canonical ownership record. The `GET /api/products/{id}/download` endpoint already checks SQLite for ownership.

```javascript
// Remove this:
await safeRun(`recordPurchase(${item.id})`, () =>
  recordPurchase(uid, String(item.id))
);
```

**Impact:** One order record per purchase. Ownership checks always use SQLite (via FastAPI download endpoint).

---

### P3-B — Wire Vendor Notifications

**Problem:** `ecosystemService.js` writes to `vendorNotifications` Firestore collection on every purchase. No vendor page reads this collection, so vendors never see order alerts.

**File to add:** Listener in `frontend/src/pages/vendor/VendorLayout.jsx`

Add a Firestore onSnapshot for `vendorNotifications` where `vendorId == currentVendorId`. Display a notification badge or toast when new documents arrive.

```javascript
const vendorId = localStorage.getItem('lumora_backend_uid');
if (vendorId) {
  const q = query(collection(db, 'vendorNotifications'), 
    where('vendorId', '==', vendorId),
    where('read', '==', false)
  );
  const unsub = onSnapshot(q, (snap) => {
    setUnreadNotifications(snap.size);
  });
  return () => unsub();
}
```

**Impact:** Vendors see real-time new order notifications without polling.

---

## 5. Priority 4 — Quality & Cleanup

---

### P4-A — Remove Hardcoded Analytics Multipliers

**File to modify:** `frontend/src/pages/vendor/Analytics.jsx`

Remove these fabricated calculations:
```javascript
// Remove:
const views = totalSales * 32.5;
const impressions = totalSales * 28.5;
```

Replace with either `null` displayed as "N/A" or remove the views metric from the UI until real tracking exists.

---

### P4-B — Delete Dead Route Files

**Files to delete:**
- `backend/admin_controls_vendor/routes.py` — defines endpoints never mounted
- `backend/admin_controls_affiliate/routes.py` — same

The services layer (`services.py`, `firestore.py`, `validators.py`) must be kept — they are used by the working admin routes. Only the unused `routes.py` files should be deleted.

---

### P4-C — Remove AffiliateTransactions stub from nav

**File to modify:** Admin sidebar navigation

Remove the `AffiliateTransactions` nav item since the page was deleted and returns `null`.

---

## 6. Files to Add

| File | Purpose | Priority |
|---|---|---|
| `backend/scripts/seed_admin.py` | Create admin user in SQLite for real JWT auth | P1-A |
| `backend/app/api/orders/schemas.py` update | Add `ref_code: Optional[str]` to OrderCreate | P2-A |

---

## 7. Files to Modify

| File | Change | Priority | Vendor/Affiliate Affected? |
|---|---|---|---|
| `backend/admin/firestore/admin_firestore.py` | Add `sync_order_to_firestore()` function | P1-B | No |
| `backend/app/api/orders/routes.py` | Call `sync_order_to_firestore` after INSERT + call affiliate conversion on ref_code | P1-B + P2-A | No |
| `backend/app/admin_api/orders/services.py` | Add SQLite UPDATE in `modify_order_status()` | P1-C | No |
| `backend/app/admin_api/payments/routes.py` | Add `require_admin_role` to all endpoints | P2-D | No |
| `frontend/src/context/AuthContext.jsx` | Admin mock login: add real JWT fetch after mock | P1-A | No |
| `frontend/src/context/AppContext.jsx` | Add `ref_code` to order payload | P2-A | No |
| `frontend/src/services/settingsService.js` | Replace direct Firestore writes with `PUT /admin/settings/` | P2-C | No |
| `frontend/src/pages/affiliate/Earnings.jsx` | Replace payout Firestore write with `POST /api/affiliate/payouts` | P2-B | Affiliate — payout write path only |
| `frontend/src/services/ecosystemService.js` | Remove `recordPurchase()` call | P3-A | No — removes duplication |
| `frontend/src/pages/vendor/VendorLayout.jsx` | Add vendorNotifications onSnapshot listener | P3-B | Vendor — adds feature |
| `frontend/src/pages/vendor/Analytics.jsx` | Remove hardcoded view multipliers | P4-A | Vendor — UI cleanup |

---

## 8. Files to NOT Touch

These files are working correctly and must not be modified.

**Backend — Do Not Touch:**
- `backend/app/api/vendors/routes.py` and all vendor API files
- `backend/app/api/affiliate/routes.py` and all affiliate API files
- `backend/app/api/auth_router.py`
- `backend/app/api/products_router.py`
- `backend/admin/routes/vendors.py`
- `backend/admin/routes/affiliates.py`
- `backend/admin/routes/settings.py`
- `backend/admin/routes/products.py`
- `backend/admin/validators/admin_auth.py`
- `backend/admin/validators/status_checks.py`
- `backend/admin_controls_vendor/services.py`
- `backend/admin_controls_vendor/firestore.py`
- `backend/admin_controls_affiliate/services.py`
- `backend/admin_controls_affiliate/firestore.py`
- `backend/app/admin_api/reports/` (working correctly)
- `backend/app/admin_api/reviews/` (working correctly)
- `backend/app/core/firebase.py`
- `backend/app/core/security.py`
- `backend/app/shared/firebase/connection.py`

**Frontend — Do Not Touch:**
- All `frontend/src/pages/vendor/` files (except Analytics.jsx for multiplier cleanup)
- All `frontend/src/pages/customer/` files (except Purchases.jsx for duplicate removal)
- `frontend/src/context/AffiliateContext.jsx`
- `frontend/src/hooks/useVendorData.js`
- `frontend/src/api/vendorApi.js`
- `frontend/src/utils/api.js`
- `frontend/src/services/authService.js`
- `frontend/src/services/reportsService.js` (working correctly)
- `frontend/src/services/reviewAnalyticsService.js`
- `frontend/src/hooks/usePlatformSettings.js`
- All customer pages
- All auth pages and routes

---

## 9. New Backend Layer: admin_controls/

The spec requests a dedicated `admin_controls/` folder as a clean organizational layer. This maps to the existing code structure.

**Proposed structure** (no new logic — reorganization only):

```
backend/admin_controls/
├── __init__.py
├── vendor/
│   ├── __init__.py
│   ├── services.py     ← move from admin_controls_vendor/services.py
│   └── firestore.py    ← move from admin_controls_vendor/firestore.py
├── affiliate/
│   ├── __init__.py
│   ├── services.py     ← move from admin_controls_affiliate/services.py
│   └── firestore.py    ← move from admin_controls_affiliate/firestore.py
├── platform/
│   ├── __init__.py
│   └── settings.py     ← extract from admin/routes/settings.py
├── orders/
│   ├── __init__.py
│   └── sync.py         ← new sync_order_to_firestore function
├── analytics/
│   ├── __init__.py
│   └── aggregator.py   ← move from app/admin_api/analytics/services.py
└── permissions/
    ├── __init__.py
    └── guards.py        ← move admin_auth.py and status_checks.py here
```

**Implementation note:** This reorganization is optional and cosmetic. The functional fixes (P1/P2/P3) are more important and can be done before any reorganization. The reorganization should happen after the functional fixes are verified to work.

---

## 10. Validation Checklist

After implementing Priority 1 fixes, validate:

```
□ Admin can log in and receive a backend JWT
□ Admin Dashboard shows real revenue numbers (not zero)
□ Admin Products list shows products from Firestore
□ Admin Vendors list shows vendor users
□ Admin can enable/disable a vendor
  → Vendor's next API call returns 403
□ Admin can enable/disable an affiliate
  → Affiliate UI disables promo buttons in real-time (no refresh)
□ Customer completes a purchase
  → Admin Orders shows the new order
  → Admin Analytics revenue increases
  → Admin Dashboard live feed shows the order
□ Admin updates order status to Completed
  → SQLite orders.status updates
  → Customer download access works
□ Platform Pause applied
  → All vendor API calls return 403
  → All affiliate API calls return 403
  → Customer checkout still works (not blocked)
□ Platform Resume applied
  → Vendor and affiliate API calls work again
□ Admin settings toggle
  → Goes through FastAPI (not direct Firestore)
  → Requires valid admin JWT

After implementing Priority 2 fixes:
□ Commission amounts match server calculation
□ Affiliate payout request validated against approved balance
□ Settings writes require admin JWT
□ Admin payments endpoints require admin JWT

After implementing Priority 3 fixes:
□ One order record per purchase (not two)
□ Vendor sees new order notification in real-time

Build verification:
□ Backend starts without errors: uvicorn app.main:app
□ All existing vendor API tests pass
□ All existing affiliate API tests pass
□ No new 500 errors in admin endpoints
```
