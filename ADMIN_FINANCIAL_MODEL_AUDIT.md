# ADMIN FINANCIAL MODEL AUDIT
## Lumora Digital Marketplace — Elite Forensic Revenue & Commission Analysis
**Audit Date:** July 31, 2026  
**Auditor Role:** Chief Financial Architect, Principal Backend Engineer, Lead Database Architect, Senior FinTech Engineer, CTO, Production Release Auditor  
**Scope:** Complete forensic analysis of admin financial model — revenue, affiliate commissions, platform fees, treasury, dashboard KPIs, analytics, withdrawals, and reports.

---

## EXECUTIVE SUMMARY

> **⚠️ IMPLEMENTATION RECOMMENDED**
> 
> The platform treasury and admin dashboard core financial logic is **architecturally sound and largely correct**, but **three specific defects** exist that deviate from the intended business model. Two are internal inconsistencies in ancillary systems (legacy vendor payout API, analytics revenue chart `net` field). One is a **structural misalignment** in how the main Dashboard `Revenue` KPI card is sourced vs. what the Treasury system properly computes.
>
> The Treasury system (`treasury_service.py`) is the **correct, authoritative implementation**. The defects exist in legacy/ancillary layers that were never updated to align with it.

---

## PHASE 1 — COMPLETE FINANCIAL FLOW DIAGRAM

```
Customer Purchase
       │
       ▼
  Payment Record (payments table)
  • amount = full customer payment
  • status: PENDING → PROCESSING → SUCCESS
       │
       ▼
  Order Created (orders table)
  • total_amount = full customer payment
  • status = "completed"
       │
       ├──────────────────────────────────┐
       │                                  │
       ▼                                  ▼
  No Affiliate Code               Affiliate Code Present
       │                                  │
       ▼                                  ▼
  100% → Platform Revenue    AffiliateCommission record created
                             • sale_amount  = price_paid (full)
                             • commission_amt = price_paid × rate%
                             • commission_status = "approved"
                                          │
                             AffiliateProfile updated:
                             • total_earnings += commission_amt
                             • pending_earnings += commission_amt
                                          │
                                          ▼
                              Treasury Accounting Engine
                              (treasury_service.py — SOURCE OF TRUTH)
                                          │
         ┌────────────────────────────────┤
         │                                │
         ▼                                ▼
Platform Revenue               Affiliate Liability
= SUM(Order.total_amount)      = SUM(AffiliateCommission.commission_amt)
  WHERE status = completed       WHERE commission_status IN
                                 (approved, ready_for_payout)
         │                                │
         └────────────┬───────────────────┘
                      │
                      ▼
         Available Balance =
           Platform Revenue
         − Affiliate Liability
         − Pending Withdrawals
         − Completed Withdrawals
                      │
                      ▼
         PlatformWithdrawal (platform owner takes earnings)
         PlatformTreasuryLedger (immutable audit trail)
                      │
                      ▼
         Admin Dashboard KPIs:
         • Platform Revenue     (IMMUTABLE — gross orders)
         • Affiliate Liability  (approved commissions owed)
         • Available to Withdraw
         • Net Platform Earnings = Platform Revenue − Affiliate Liability
```


---

## PHASE 2 — REVENUE CALCULATION AUDIT

### 2.1 Core Revenue Formula — `treasury_service.py` (AUTHORITATIVE)

**File:** `backend/app/services/treasury_service.py`

```python
# _calculate_platform_revenue()
SELECT COALESCE(SUM(total_amount), 0.0)
FROM orders
WHERE status IN ('completed', 'paid', 'Completed', 'Paid')
```

**Verdict:** ✅ CORRECT. Platform revenue = sum of all completed order amounts. This is GROSS revenue (the full amount paid by customers). No platform fee is deducted here. No commission is deducted here. This is the correct starting number.

---

### 2.2 Analytics Revenue KPI — `analytics/services.py`

**File:** `backend/app/admin_api/analytics/services.py`

```python
# calculate_kpis()
if pay_status == "Paid" or status == "Completed":
    total_revenue += price
```

**Verdict:** ✅ CORRECT. `totalRevenue` in the Dashboard KPI cards (Revenue card, Orders Today, etc.) is computed as the gross sum of all paid orders. No deduction. Correct.

---

### 2.3 Analytics Revenue Chart `net` Field — `analytics/services.py` ⚠️

**File:** `backend/app/admin_api/analytics/services.py`, lines 622, 627, 632 (SQL branch) and lines 858, 862, 866 (Firestore branch)

```python
# DEFECT — hardcoded 5% phantom deduction
daily_rev[day_key]["net"] += round(price * 0.95, 2)   # ← 5% deducted, no basis
weekly_rev[week_key]["net"] += round(price * 0.95, 2) # ← same
monthly_rev[mon_key]["net"] += round(price * 0.95, 2) # ← same
```

**Verdict:** ❌ DEFECT. The `net` field in the revenue chart data is computed as `gross × 0.95` — implying a 5% platform fee. **No such platform fee exists in Lumora's business model.** This `net` field is computed incorrectly. The actual `net` for Lumora's model is `gross − actual affiliate commissions for that period`, not `gross × 0.95`.

**Impact:** The revenue chart on the Analytics page shows a `net` line that is artificially reduced by 5% on every order. This is **cosmetically incorrect** (the chart shows a phantom fee deduction), but it does NOT affect the Treasury balance, withdrawable amounts, or any real financial calculation. It is a display/chart defect only.

---

### 2.4 Vendor Payout Commission — `admin_api/payments/services.py` ⚠️

**File:** `backend/app/admin_api/payments/services.py`, line 145–147

```python
# get_vendor_payouts() — Legacy admin payments telemetry endpoint
"commission":  round(total_sales * 0.05, 2),   # ← hardcoded 5% "commission"
"paidPayout":  round(total_sales * 0.95, 2),   # ← 95% "paid" to vendor
```

**Verdict:** ❌ DEFECT (Legacy). This is the **old vendor-centric payments overview**, served from `/admin/payments/overview`. It treats all vendors as if they get a 95% payout and Lumora takes a 5% fee. **Lumora does not have vendors in the final business model** — Lumora owns all products. This endpoint is a leftover from a marketplace phase. The 5% "commission" here represents a phantom cut that does not match the actual business model. This endpoint is not used by the Treasury system.

**Impact:** Only affects the `/admin/payments/overview` → vendor payout table display. Does NOT affect the Treasury balance, Platform Revenue KPI, or any withdrawal calculations.

---

### 2.5 Revenue Field in Commission Ledger — `admin/routes/affiliates.py`

**File:** `backend/admin/routes/affiliates.py`, line in `get_commissions_ledger()`

```python
"platform_revenue": round(comm.sale_amount - comm.commission_amt, 2),
```

**Verdict:** ✅ CORRECT. The per-row "platform revenue" in the commission ledger is correctly computed as `sale_amount − commission_amt`. This is the correct per-transaction net platform revenue for affiliated orders. This field is for display/reporting only and is not used in Treasury calculations.


---

## PHASE 3 — DASHBOARD KPI AUDIT

### 3.1 Platform Treasury Cards (`PlatformTreasuryCards.jsx` + `treasury_service.py`)

| KPI Card | Formula | Source Table | Backend Endpoint | Gross or Net? | Correct? |
|---|---|---|---|---|---|
| **Platform Revenue** | `SUM(Order.total_amount) WHERE status=completed` | `orders` | `GET /admin/treasury/summary` → `platform_revenue` | **GROSS** (full customer payments) | ✅ Yes |
| **Available to Withdraw** | `platform_revenue − affiliate_liability − pending_wd − completed_wd` | `orders`, `affiliate_commissions`, `platform_withdrawals` | Same endpoint → `available_balance` | Net (after liabilities) | ✅ Yes |
| **Minimum Reserve** | Constant = ₹5,000 | Hardcoded `MINIMUM_RESERVE = 5_000.0` | Same endpoint → `minimum_reserve` | N/A | ✅ Yes |
| **Affiliate Liability** | `SUM(commission_amt) WHERE commission_status IN (approved, ready_for_payout)` | `affiliate_commissions` | Same endpoint → `affiliate_liability` | Exact amount owed | ✅ Yes |
| **Pending Withdrawals** | `SUM(amount) WHERE status IN (pending, approved, processing)` | `platform_withdrawals` | Same endpoint → `pending_withdrawals` | In-flight deductions | ✅ Yes |
| **Completed Withdrawals** | `SUM(amount) WHERE status = completed` | `platform_withdrawals` | Same endpoint → `completed_withdrawals` | Already paid out | ✅ Yes |
| **Net Platform Earnings** | `platform_revenue − affiliate_liability` | `orders`, `affiliate_commissions` | Same endpoint → `net_platform_earnings` | **NET after affiliate** | ✅ Yes |
| **Today's Revenue** | `SUM(Order.total_amount) WHERE created_at >= today AND status=completed` | `orders` | Same endpoint → `today_revenue` | Gross daily | ✅ Yes |
| **Net Withdrawable** | `max(available_balance − MINIMUM_RESERVE, 0)` | Derived | Same endpoint → `net_withdrawable` | Net after reserve | ✅ Yes |

**Overall Treasury Dashboard Verdict:** ✅ ALL CORRECT. The Treasury system is the most accurate and correctly-designed part of the financial architecture.

---

### 3.2 Main Dashboard `Revenue` KPI Card (`Dashboard.jsx`)

**File:** `admin-app/src/pages/admin/Dashboard.jsx`

```jsx
// Sourced from getDashboardData() → /admin/analytics/dashboard-full
// → get_full_dashboard_data() in analytics/services.py
value: `${currencySymbol}${formatValue(metrics.totalRevenue)}`
// metrics.totalRevenue = data.kpis.totalRevenue
// = SUM(total_amount) WHERE paymentStatus==Paid OR status==Completed
```

**Verdict:** ✅ CORRECT as a gross revenue metric. However, this `Revenue` KPI card is **separate** from the Treasury's `Platform Revenue` card (which is also shown in the `PlatformTreasuryCards` section right below it). The main 6-KPI grid at top shows gross revenue from the analytics service. The Treasury cards show the same value (Platform Revenue). Both are consistent and both show gross revenue. No double-counting. No fee deduction. Correct.

---

### 3.3 PlatformFinance.jsx Treasury KPI Cards

Same as 3.1 — sourced from the same `/admin/treasury/summary` endpoint. ✅ CORRECT.

---

### 3.4 Analytics Page Revenue Cards

**File:** `admin-app/src/pages/admin/Analytics.jsx`  
**Source:** `/admin/analytics/dashboard` → `get_analytics_dashboard_data()`

The KPI summary values (totalRevenue, AOV, refundRate) are gross and correct.

The revenue **chart** contains a `net` series computed as `price × 0.95`. This is the defect identified in Phase 2.3 — the chart `net` line is wrong but does not affect any financial balance or withdrawal calculation.


---

## PHASE 4 — AFFILIATE COMMISSION AUDIT

### 4.1 Commission Calculation

**File:** `backend/app/services/purchase_service.py`

```python
# Commission type: percentage
comm_rate  = prod.commission_value OR aff.commission_rate (default 20%)
commission_amt = quantize_money((price_paid * comm_rate) / 100.0)

# Commission type: fixed
comm_rate  = prod.commission_value
commission_amt = quantize_money(min(comm_rate, price_paid))
```

**Verdict:** ✅ CORRECT. Commission is calculated per-product, per-order-item. Rate is sourced from the product's `commission_value` field first (product-specific rate), falling back to the affiliate profile's `commission_rate` (default 20%). Fixed amounts are capped at the sale price to prevent impossible payouts.

**Idempotency Guard:** ✅ Present. `existing_comm` check prevents duplicate commissions if payment is retried.

**Self-Referral Guard:** ✅ Present. `aff.user_id != user_id` check blocks self-referral commission.

---

### 4.2 Commission Storage

**Table:** `affiliate_commissions`

| Field | Value | Correct? |
|---|---|---|
| `sale_amount` | Full product price paid | ✅ Yes |
| `commission_amt` | Calculated commission | ✅ Yes |
| `commission_status` | `"approved"` (set at creation) | ✅ Yes (auto-approved on purchase) |
| `commission_rate` | Rate used (percentage or INR) | ✅ Yes |
| `commission_type` | `"percentage"` or `"fixed"` | ✅ Yes |

**AffiliateProfile counters also updated:**
- `total_earnings += commission_amt` ✅
- `pending_earnings += commission_amt` ✅
- `total_sales += 1` ✅

---

### 4.3 Commission Deduction from Revenue

**File:** `backend/app/services/treasury_service.py`

```python
def _calculate_affiliate_liability(db: Session) -> float:
    result = db.query(func.coalesce(func.sum(AffiliateCommission.commission_amt), 0.0))
              .filter(AffiliateCommission.commission_status.in_(["approved", "ready_for_payout"]))
              .scalar()
    return round(float(result or 0.0), 2)
```

**Verdict:** ✅ CORRECT. Affiliate commissions are **deducted exactly once** from Available Balance, through the `affiliate_liability` term in the treasury formula. They are NOT deducted from `platform_revenue` (which stays gross), but they ARE subtracted from what's withdrawable.

---

### 4.4 Is Commission Deducted Twice? 

**Answer: NO.** The commission:
1. Is calculated once at purchase time in `purchase_service.py`
2. Is stored once in `affiliate_commissions` table
3. Is counted once as `affiliate_liability` in `treasury_service._calculate_affiliate_liability()`
4. When paid out: status moves to `paid` → no longer included in `affiliate_liability` → the payout itself is tracked via `AffiliatePayout` records (separate from treasury withdrawals)

**Single deduction confirmed** — no double-counting found.

---

### 4.5 Effect of Pending vs Paid Commissions on Treasury

| Status | Included in `affiliate_liability`? | Effect on `available_balance` |
|---|---|---|
| `pending` | ✅ YES (included via OR clause in `get_commissions_ledger`; but NOT in treasury `_calculate_affiliate_liability` which uses `approved, ready_for_payout` only) | See note below |
| `approved` | ✅ YES | Reduces `available_balance` |
| `ready_for_payout` | ✅ YES | Reduces `available_balance` |
| `paid` | ❌ NO | Already settled — removed from liability |
| `reversed` / `rejected` | ❌ NO | Clawed back — not a liability |

**⚠️ NOTE — Minor gap:** Commissions with `commission_status = "pending"` (not yet reviewed/approved by admin) are **NOT included in `affiliate_liability`**. This means if large amounts of commissions are in pending status, the available balance calculation overstates what is truly "free" to withdraw. However, this is a **conservative display choice** — it means the platform owner sees a higher available balance until admin formally approves commissions. The business risk is low (commissions can be rejected), so this is acceptable behavior. It should be documented.


---

## PHASE 5 — PLATFORM FEE AUDIT

### 5.1 Does Lumora Charge Itself a Platform Fee?

**Short answer: NO — not in the authoritative financial system.**

A complete search of `platform_fee`, `seller_amount`, `admin_amount`, `marketplace_fee`, `vendor_split` across all backend Python files revealed zero instances in the core financial path.

However, three **orphaned / legacy / cosmetic** instances of fee-like logic were found:

---

### 5.2 Instance 1 — Analytics Revenue Chart `net` (5% phantom deduction)

**File:** `backend/app/admin_api/analytics/services.py`  
**Code:** `net = round(price * 0.95, 2)` — applied in revenue chart data builder

- **Where:** Only in the chart data returned by `/admin/analytics/dashboard` and `/admin/analytics/dashboard-full` in the `revenueChart.daily/weekly/monthly` arrays' `net` field
- **Why:** Appears to be a legacy holdover from a time when a 5% platform fee was considered or the system was designed for a marketplace model
- **Does it affect Treasury/Balance/Withdrawals?** ❌ NO. This field is purely cosmetic chart data. The Treasury system does not use it.
- **Should it exist?** ❌ NO. There is no 5% platform fee in Lumora's model. The `net` field should equal `gross − actual_affiliate_commissions_for_period`, or simply be removed from the chart payload.

---

### 5.3 Instance 2 — Vendor Payout Table (5% commission / 95% payout)

**File:** `backend/app/admin_api/payments/services.py`  
**Code:** `"commission": round(total_sales * 0.05, 2)`, `"paidPayout": round(total_sales * 0.95, 2)`

- **Where:** `get_vendor_payouts()` function, served via `GET /admin/payments/overview`
- **Why:** Legacy code from a marketplace phase where Lumora had external vendors who received 95% of their sales. Lumora took 5%.
- **Does it affect Treasury/Balance/Withdrawals?** ❌ NO. This is telemetry/display data for the admin payments tab vendor table. Not connected to the Treasury engine.
- **Should it exist?** Only if Lumora still has external vendors. If Lumora is a first-party product seller only (intended model), this entire `get_vendor_payouts()` function is irrelevant and should be deprecated.

---

### 5.4 Instance 3 — Vendor Frontend Earnings Page (15% platform fee)

**File:** `frontend/src/pages/vendor/Earnings.jsx`  
**Code:** `const FEE_PCT = 0.15; const totalFees = Math.round(totalGross * FEE_PCT);`

Also in `Dashboard.jsx`: `totalRevenue * 0.85` shown as "Net Earnings" for vendor dashboard.

- **Where:** Vendor-facing Earnings and Dashboard pages
- **Why:** Lumora charges vendors a 15% platform fee (or charged, historically). Vendors see 85% of their gross revenue.
- **Does it affect Admin Platform Revenue?** ❌ NO. This is calculated purely on the vendor-facing frontend for their display. Admin Treasury never uses this 15%.
- **Is this consistent with the business model?** This depends on whether Lumora still has external vendors. If Lumora sells only its own products, there are no vendors and this page is irrelevant to admin finance.

---

### 5.5 Platform Fee Summary

| Location | Fee | Scope | Affects Treasury? |
|---|---|---|---|
| `analytics/services.py` — revenue chart `net` | 5% | Chart cosmetic only | ❌ NO |
| `admin_api/payments/services.py` — vendor payouts | 5% | Vendor payout telemetry display | ❌ NO |
| `vendor/Earnings.jsx` — vendor dashboard | 15% | Vendor-facing display | ❌ NO |
| **Treasury / Purchase / Payment Service** | **0%** | **Actual balance calculations** | **N/A — no fee here** |

**Conclusion:** There is **NO platform fee that reduces admin revenue** in the authoritative financial system (Treasury service, Purchase service, Payment service). The platform keeps 100% of order revenue, from which only affiliate commissions are later deducted via the liability mechanism.


---

## PHASE 6 — DATABASE AUDIT

### 6.1 Orders Table (`orders`)

| Field | Contains | Gross or Net? | Correct? |
|---|---|---|---|
| `total_amount` | Full customer payment | **GROSS** | ✅ Yes |
| `status` | `completed / paid / cancelled / refunded` | N/A | ✅ Yes |
| `affiliate_id` | Linked affiliate profile ID | N/A | ✅ Yes |
| `referral_code_used` | Attribution code | N/A | ✅ Yes |
| `discount_amount` | Any discount applied at checkout | Deduction | ✅ Yes |

**Revenue is stored GROSS.** The `total_amount` is the final price paid by the customer. There is no field reducing it by a platform fee or commission at storage time. ✅ Correct.

---

### 6.2 Payments Table (`payments`)

| Field | Contains | Correct? |
|---|---|---|
| `amount` | Full payment amount charged to customer | ✅ Yes |
| `discount_amount` | Discount applied | ✅ Yes |
| `tax_amount` | Tax applied | ✅ Yes |
| `status` | PENDING → PROCESSING → SUCCESS | ✅ Yes |

Payment stores gross amounts. No commission or fee deduction. ✅ Correct.

---

### 6.3 Affiliate Commissions Table (`affiliate_commissions`)

| Field | Contains | Correct? |
|---|---|---|
| `sale_amount` | Full product price (gross) | ✅ Yes |
| `commission_amt` | Calculated commission (subset of sale_amount) | ✅ Yes |
| `commission_status` | `pending / approved / ready_for_payout / paid / reversed / rejected` | ✅ Yes |
| `commission_rate` | Rate used at time of calculation | ✅ Yes |

Commission stored separately from order. Not deducted from `orders.total_amount`. ✅ Correct.

---

### 6.4 Platform Treasury Ledger (`platform_treasury_ledgers`)

| Ledger Type | Amount Sign | Meaning | Used in Balance? |
|---|---|---|---|
| `revenue_earned` | Positive | Revenue credited | Via `_calculate_platform_revenue()` on orders table (NOT this ledger) |
| `commission_expense` | N/A (informational) | Commission recognized | Separate liability calc |
| `platform_withdrawal` | Negative | Debit against balance | Via `_calculate_pending_withdrawals()` |
| `manual_adjustment` | Positive or Negative | Corrections | Via `write_ledger_entry()` |
| `refund` | Negative | Order refunded | N/A (subtracted from order totals) |

**IMPORTANT NOTE:** The `PlatformTreasuryLedger` is an **audit/event ledger** used for the Timeline view. The Treasury Summary **does NOT read `available_balance` from the ledger** — it recomputes it fresh from the source tables (`orders`, `affiliate_commissions`, `platform_withdrawals`) every request. This means the `running_balance` field in the ledger is a denormalized snapshot for display only, and the real balance is always freshly computed. ✅ This is correct architecture.

---

### 6.5 Platform Withdrawals Table (`platform_withdrawals`)

Revenue is never stored here. Only withdrawal records (amount, status, destination). ✅ Correct — withdrawals are tracked separately from revenue.

---

### 6.6 Summary: Is Revenue Stored Gross or Net?

**Revenue is stored GROSS in the database.** Commissions are stored separately. The Treasury service computes net positions dynamically at query time by subtracting liabilities. This is the correct double-entry-style approach.


---

## PHASE 7 — IS THE CURRENT SYSTEM CORRECT?

### Overall Verdict by System Layer

| System Layer | Status | Notes |
|---|---|---|
| **Treasury Service** (`treasury_service.py`) | ✅ CORRECT | Authoritative. Revenue is gross, commission is liability, available = gross − liability − withdrawals |
| **Purchase Service** (`purchase_service.py`) | ✅ CORRECT | Commission calculated correctly, stored once, no double-booking |
| **Payment Service** (`payment_service.py`) | ✅ CORRECT | SAVEPOINT safety, idempotency guards, refund reversal of commissions |
| **Treasury API** (`treasury/routes.py`) | ✅ CORRECT | RBAC, immutable ledger, proper settlement workflow |
| **Treasury KPI Cards** (`PlatformTreasuryCards.jsx`) | ✅ CORRECT | All 7 KPIs sourced from Treasury service, correct formulas displayed |
| **Platform Finance Page** (`PlatformFinance.jsx`) | ✅ CORRECT | Balance formula shown correctly in UI |
| **Main Dashboard Revenue KPI** | ✅ CORRECT | Gross revenue from analytics service, consistent with Treasury |
| **Analytics Revenue KPI** | ✅ CORRECT | `totalRevenue` is gross |
| **Analytics Revenue Chart `net` field** | ❌ DEFECT | Hardcoded `× 0.95` phantom 5% fee — no basis in business model |
| **Affiliate Commission Ledger** (`affiliates.py`) | ✅ CORRECT | `platform_revenue = sale_amount − commission_amt` per row |
| **Affiliate KPIs** (`/affiliates/kpis`) | ✅ CORRECT | commission_pending/paid accurately tracked |
| **Vendor Payout Table** (`payments/services.py`) | ❌ LEGACY DEFECT | Hardcoded 5%/95% split — does not reflect Lumora's actual model |
| **Vendor Earnings Page** (`vendor/Earnings.jsx`) | ⚠️ VENDOR-SPECIFIC | 15% fee applies only to vendor-facing display, not admin finance |
| **Refund Commission Reversal** (`payment_service.py`) | ✅ CORRECT | Commissions properly reversed on refund |
| **Commission lifecycle transitions** | ✅ CORRECT | Status machine properly tracks pending→approved→paid |

### Scenario Classification

This is closest to **Scenario B + Scenario C combined** — but localized to non-authoritative ancillary systems:

- The **Treasury / core financial system is correct** (Scenario A for that layer)
- The **analytics chart `net` field** shows an artificial deduction that shouldn't exist (Scenario C — revenue incorrectly reduced by phantom fee)
- The **vendor payout display** shows a 5%/95% split that is legacy/incorrect for the current model (Scenario C)


---

## PHASE 8 — IMPLEMENTATION PLAN (DEFECTS ONLY)

> ⚠️ **DO NOT IMPLEMENT.** This is an analysis-only document. The following is a proposed implementation plan for approval only. No code changes have been made.

---

### FIX 1 — Analytics Revenue Chart `net` Field (Priority: MEDIUM)

**Problem:** `net = price × 0.95` is a phantom 5% deduction with no basis in business model.

**Correct formula:** For Lumora's model, `net` revenue for a given period should be:
```
net_revenue_in_period = gross_revenue_in_period − affiliate_commissions_earned_in_period
```

**Files Affected:**
- `backend/app/admin_api/analytics/services.py`

**Proposed Change:**

Option A — **Remove the `net` field entirely** from the chart payload (simplest; safe)
```python
# Before:
daily_rev[day_key]["net"] += round(price * 0.95, 2)

# After: Remove this line entirely from all three chart builders (daily, weekly, monthly)
# in both SQL and Firestore branches (~6 lines total)
```

Option B — **Compute `net` correctly** by joining affiliate commissions per date period (more accurate, requires additional query)

Option A is recommended — the chart still shows `gross` which is the correct primary metric. The `net` line was misleading.

**Frontend impact:** Check `Analytics.jsx` to confirm it uses `revenueChart.daily[].net` in a chart series. If so, either remove the net series from the chart config, or update it to handle missing `net` field gracefully.

**Risk:** Low. No financial balances are affected. Only chart cosmetics change.

**Regression:** Zero financial regression. Only visual chart change.

---

### FIX 2 — Vendor Payout Table Hardcoded 5%/95% (Priority: LOW — Legacy)

**Problem:** `get_vendor_payouts()` in `admin_api/payments/services.py` assumes 5% platform commission on all vendor sales. This is legacy marketplace logic.

**Files Affected:**
- `backend/app/admin_api/payments/services.py` — `get_vendor_payouts()` function

**Proposed Change:**

Option A — **Deprecate the endpoint** if Lumora no longer has external vendors. Remove the commission/paidPayout fields from the response or return empty.

Option B — **Clarify the comment** that this is a legacy vendor commission rate and not the platform-wide financial model.

Option C — **Remove the 5% calculation** and replace with a note that vendor payouts are managed via the affiliate payout system.

**Risk:** Low. This endpoint serves only the `GET /admin/payments/overview` vendor payout table — a legacy admin UI view.

---

### FIX 3 — Treasury Commission Liability: Include `pending` Commissions (Priority: LOW)

**Problem:** `_calculate_affiliate_liability()` only includes commissions with `commission_status IN (approved, ready_for_payout)`. Commissions in `pending` status are excluded, so the available balance overstates what is truly unencumbered.

**File:** `backend/app/services/treasury_service.py`

**Proposed Change:**
```python
# Before:
.filter(AffiliateCommission.commission_status.in_(["approved", "ready_for_payout"]))

# After (conservative approach — include pending too):
.filter(AffiliateCommission.commission_status.in_(["pending", "approved", "ready_for_payout"]))
```

**Risk:** MEDIUM. This would reduce the displayed `available_balance` and `affiliate_liability` will increase. Platform owner sees a lower withdrawable amount until commissions are reviewed. This is the more financially conservative and correct view. Confirm with business whether auto-approval or manual approval is the intended flow.

**If commissions are always auto-approved at purchase** (they are — `commission_status = "approved"` is set at creation in `purchase_service.py`), then this fix is actually **NOT needed** — pending status would never exist for new commissions unless admin manually sets them back. This is a non-issue in the current implementation.

---

### Summary Table

| Fix | File | Lines | Priority | Financial Impact | Safe to Deploy? |
|---|---|---|---|---|---|
| Remove `net × 0.95` from chart data | `analytics/services.py` | ~6 lines in 2 branches | MEDIUM | Zero — cosmetic only | ✅ Yes, with frontend chart update |
| Deprecate vendor 5% payout display | `admin_api/payments/services.py` | ~5 lines | LOW | Zero — display only | ✅ Yes |
| Consider including `pending` in liability | `treasury_service.py` | 1 line | LOW | Reduces displayed available balance | ⚠️ Confirm with business first |


---

## FINAL REPORT

### Current Financial Architecture

Lumora uses a **two-layer financial model**:

1. **Revenue Layer:** All completed order `total_amount` values are the gross platform revenue. No fee or commission is deducted at the point of revenue recognition. Revenue is append-only and immutable.

2. **Liability Layer:** Affiliate commissions are tracked as separate liabilities. Only when admin approves a commission does it become "owed". Approved commissions reduce the *withdrawable* balance but never reduce the *platform revenue* figure.

The architecture follows a correct double-entry style:
- `Platform Revenue` = permanent, immutable gross
- `Affiliate Liability` = what is owed to affiliates (a current liability)
- `Available Balance` = Revenue − Liability − Withdrawals already made

---

### Actual Revenue Formula (Treasury — Authoritative)

```
Platform Revenue    = SUM(orders.total_amount) WHERE status = completed

Affiliate Liability = SUM(affiliate_commissions.commission_amt)
                      WHERE commission_status IN (approved, ready_for_payout)

Available Balance   = Platform Revenue
                    − Affiliate Liability
                    − Pending Withdrawals
                    − Completed Withdrawals

Net Platform Earnings = Platform Revenue − Affiliate Liability

Net Withdrawable    = max(Available Balance − ₹5,000 reserve, 0)
```

---

### Affiliate Commission Formula

```
# Percentage type (default):
commission_amt = price_paid × (commission_rate / 100)
              = price_paid × (product.commission_value OR affiliate.commission_rate(20%)) / 100

# Fixed type:
commission_amt = min(product.commission_value, price_paid)

# Quantization: ROUND_HALF_UP to 2 decimal places (money_utils.py)
```

---

### Platform Fee Analysis

| Fee Type | Exists in Business Model? | Exists in Code? | Location | Affects Admin Finance? |
|---|---|---|---|---|
| Platform fee on orders | ❌ NO | ❌ NO | N/A | N/A |
| Phantom 5% in chart `net` | ❌ NO | ⚠️ YES (defect) | `analytics/services.py` | ❌ NO (cosmetic only) |
| Legacy 5% vendor commission | ❌ NOT intended | ⚠️ YES (legacy) | `admin_api/payments/services.py` | ❌ NO (display only) |
| 15% vendor platform fee | Vendor-specific only | YES | `vendor/Earnings.jsx` | ❌ NO (vendor-facing display) |

---

### Dashboard Accuracy

| Dashboard Section | Accuracy |
|---|---|
| Platform Treasury Cards (7 KPIs) | ✅ 100% Accurate |
| Platform Finance Page (all 4 tabs) | ✅ 100% Accurate |
| Main Dashboard `Revenue` KPI | ✅ Accurate (gross) |
| Affiliate Commission Ledger | ✅ Accurate |
| Analytics KPI Cards | ✅ Accurate |
| Analytics Revenue Chart `net` series | ❌ Inaccurate — phantom 5% deduction |
| Admin Payments Vendor Payout Table | ❌ Legacy — hardcoded 5%/95% split |

---

### Treasury Accuracy

The Treasury system is **100% accurate and correctly implemented**:
- Revenue is gross and immutable ✅
- Affiliate commissions are properly tracked as liabilities ✅  
- Withdrawals are tracked and deducted from available balance ✅
- Minimum reserve of ₹5,000 is enforced ✅
- Ledger is immutable append-only ✅
- RBAC (super_admin/finance/analyst roles) is enforced ✅
- Settlement workflow (pending → approved → completed) is correct ✅
- Refund commission reversals work correctly ✅

---

### Does Revenue Already Exclude Affiliate Commissions?

**No — and that is CORRECT.**

`Platform Revenue` intentionally shows **GROSS** (total customer payments). Affiliate commissions are displayed separately as `Affiliate Liability`. The dashboard shows both:
- `Platform Revenue` = gross (what customers paid)
- `Affiliate Liability` = what is owed to affiliates
- `Net Platform Earnings` = Platform Revenue − Affiliate Liability (what Lumora keeps)

This is the correct accounting treatment. Showing gross and liability separately gives better visibility than hiding the commission inside a net figure.

---

### Does Any Platform Fee Exist?

In the **authoritative financial system (Treasury, Purchase, Payment services): NO.**

In **legacy/ancillary code:** Three locations contain fee-like calculations (5%, 5%, 15%) that are cosmetic/display-only and do not affect any balance, withdrawal, or KPI in the admin treasury or dashboard revenue cards.

---

## FINAL DECISION

> **⚠️ IMPLEMENTATION RECOMMENDED**
>
> The **core financial architecture is correct** and matches Lumora's intended business model. The Treasury system, Purchase service, Payment service, all commission calculations, and all Treasury Dashboard KPIs are working exactly as intended.
>
> However, **three localized defects** exist in non-authoritative layers that should be corrected to eliminate confusion and ensure consistency:
>
> 1. **[MEDIUM]** `analytics/services.py` — Remove/correct the `net = price × 0.95` phantom fee in the revenue chart data builder. This is the only defect that could confuse an admin reading the revenue chart, as it shows an artificial "net" line 5% below the gross line with no explanation.
>
> 2. **[LOW]** `admin_api/payments/services.py` — Deprecate or correctly label the vendor payout 5%/95% split in the legacy payments telemetry endpoint.
>
> 3. **[LOW — OPTIONAL]** `treasury_service.py` — Evaluate whether `pending` commissions should be included in `affiliate_liability`. Currently auto-approved commissions go directly to `approved` status, so this is likely not an active issue.
>
> **Await explicit approval before implementing any changes.**

---

*Audit completed: July 31, 2026*  
*Files examined: 25+ source files across backend services, models, admin API routes, admin frontend pages, and frontend pages*  
*No code was modified during this audit.*
