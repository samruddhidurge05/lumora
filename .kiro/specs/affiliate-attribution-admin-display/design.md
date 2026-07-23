# Affiliate Attribution Admin Display — Bugfix Design

## Overview

Three independent defects combine to make affiliate attribution invisible on the admin order
detail pages even when the underlying data is correct and complete in the database.

**Defect 1 — Backend API omission** (`backend/app/admin_api/orders/services.py` →
`get_orders_list()`): The serialization dict inside the `result.append({...})` loop does not
include the `affiliate_id`, `referral_code_used`, or `referral_link_id` columns that exist on the
`Order` model, so the admin front-end never receives affiliate metadata alongside order list data.

**Defect 2 — Primary frontend missing fetch** (`frontend/src/pages/admin/OrdersManagement.jsx`):
The "ORDER DETAIL PANEL" section (right 40 % panel) has no `useEffect` to call
`GET /admin/affiliates/orders/{id}` and no JSX to render the returned attribution data. The panel
therefore never shows affiliate information regardless of what the database holds.

**Defect 3 — Admin-app boolean guard** (`admin-app/src/pages/admin/OrdersManagement.jsx` →
`AffiliateAttributionCard`): The no-attribution guard reads
`!attr?.affiliate_name && !attr?.affiliate_code` (AND). Because the AND condition is only true when
**both** fields are absent, any order where one field is populated but the other is `null` silently
falls through to "Direct Purchase (No Affiliate Referred)" — a false negative.

All three fixes are additive and localized. No customer-facing code, no Order model, no
`purchase_service.py`, and no `payment_service.py` are touched.

---

## Glossary

- **Bug_Condition (C)**: The set of inputs that trigger the defect — orders that carry a
  non-null `affiliate_id` in the database yet are displayed as "Direct Purchase" (or return no
  affiliate fields) in the admin UI.
- **Property (P)**: The desired outcome when the bug condition holds — the admin UI SHALL display
  full attribution details and the API response SHALL include the three affiliate fields.
- **Preservation**: All behaviors for orders that genuinely have no affiliate attribution, and all
  non-affiliate fields for any order, must be identical before and after the fix.
- **`get_orders_list()`**: Function in `backend/app/admin_api/orders/services.py` that serializes
  `Order` model rows into the paginated JSON response consumed by both admin frontends.
- **`AffiliateAttributionCard`**: Component in `admin-app/src/pages/admin/OrdersManagement.jsx`
  that renders the affiliate trace panel for a selected order; it fetches
  `/admin/affiliates/orders/{orderId}` independently.
- **`selectedOrder`**: React state in `frontend/src/pages/admin/OrdersManagement.jsx` holding the
  currently selected order object; drives all detail-panel rendering.
- **`trace` / `attr` / `comm`**: Variables in `AffiliateAttributionCard` for the attribution API
  response, `trace.attribution`, and `trace.commission` respectively.
- **`isBugCondition(order)`**: Pseudocode predicate that returns `true` when any of the three
  defects would produce an incorrect outcome for the given order.

---

## Bug Details

### Bug Condition

The bug manifests when an `Order` record in SQLite has a non-null `affiliate_id` (meaning a valid
referral attribution was recorded at purchase time) AND any of the following three code paths is
exercised:

1. `get_orders_list()` is called — the serialization loop omits the three affiliate fields.
2. An admin selects that order in the primary `frontend` app — the detail panel never fetches or
   renders attribution.
3. An admin views the order in the `admin-app` and `trace.attribution` has exactly one of
   `affiliate_name` / `affiliate_code` populated — the AND guard evaluates to `false` and the
   card falls back to the "Direct Purchase" fallback.

**Formal Specification:**

```
FUNCTION isBugCondition(order)
  INPUT:  order — an Order record (SQLite) with potential affiliate attribution fields
  OUTPUT: boolean

  // Defect 1: API serialization gap
  IF order.affiliate_id IS NOT NULL
     AND "affiliateId" NOT IN keys(getOrdersListResponseFor(order))
  THEN RETURN true

  // Defect 2: Primary frontend never fetches attribution
  IF order.affiliate_id IS NOT NULL
     AND requestingFrontend = "frontend/src/pages/admin/OrdersManagement.jsx"
  THEN RETURN true

  // Defect 3: Admin-app AND guard false negative
  IF order.affiliate_id IS NOT NULL
     AND (attr.affiliate_name IS NULL XOR attr.affiliate_code IS NULL)
     AND guardUsesAND = true
  THEN RETURN true

  RETURN false
END FUNCTION
```

### Examples

| Scenario | Expected | Actual (buggy) |
|---|---|---|
| Order with `affiliate_id = 5`, `referral_code_used = "LUMREF20"` fetched via `GET /admin/orders/` | Response includes `affiliateId: 5`, `referralCodeUsed: "LUMREF20"`, `referralLinkId: null` | Response omits all three fields |
| Admin selects that order in the primary `frontend` app | Right panel shows affiliate name, referral code, commission amount | Right panel shows only fulfillment / transaction / risk sections; no attribution section |
| `admin-app` fetches attribution; `attr.affiliate_name = null`, `attr.affiliate_code = "LUMREF20"` | Attribution card renders with code visible | Guard `!null && !"LUMREF20"` → `true && false` → `false` — card renders (accidentally correct); BUT when `attr.affiliate_name = "Jane"` and `attr.affiliate_code = null`: `!false && !true` → `false && true` → **falls back to "Direct Purchase"** |
| Order with `affiliate_id = null` (genuine direct purchase) | "Direct Purchase (No Affiliate Referred)" displayed | No change — preservation case |

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- Orders with `affiliate_id = null` in the database SHALL continue to display "Direct Purchase
  (No Affiliate Referred)" in both admin frontends.
- The existing fields in the `get_orders_list()` response (`id`, `orderId`, `customerId`,
  `customerName`, `customerEmail`, `items`, `totalUSD`, `price`, `status`, `paymentStatus`,
  `paymentMethod`, `createdAt`) SHALL remain present and unchanged.
- Status filtering, pagination, and ordering in the admin orders list SHALL continue to work
  correctly after the serialization change.
- All existing sections in the primary frontend order detail panel (Customer Profile Header,
  Fulfillment Logistics, Transaction Ledger, Security & Risk Matrix, Lifecycle Event Timeline)
  SHALL render without regression.
- When `AffiliateAttributionCard` receives confirmed full attribution (both `affiliate_name` and
  `affiliate_code` are truthy), its existing rendering SHALL be unchanged.
- The `admin-app` "Check / Regenerate" button behavior for genuinely un-attributed orders SHALL
  remain unchanged.
- No customer-facing routes, `purchase_service.py`, `payment_service.py`, or `Order`/affiliate
  models are modified.

**Scope:**

All inputs that do NOT satisfy `isBugCondition(order)` — i.e., genuinely direct-purchase orders,
or the pre-existing fields in the order API response — are completely unaffected by this fix.

---

## Hypothesized Root Cause

### Defect 1 — Backend serialization omission

The `result.append({...})` block in `get_orders_list()` was written when affiliate tracking was
not yet implemented (or was considered out-of-scope for the admin list endpoint). The three model
columns (`affiliate_id`, `referral_code_used`, `referral_link_id`) were never added to the
serialization dict. Because the SQLAlchemy `Order` object is never directly exposed — only the
hand-crafted dict is returned — those fields are silently dropped.

### Defect 2 — Primary frontend panel never wired up

The `frontend/src/pages/admin/OrdersManagement.jsx` component was built with its own set of state
hooks and `useEffect` calls for order loading, refund tickets, and audio. No state variable for
attribution data (`affiliateTrace`) was ever added, and no `useEffect` keyed on
`selectedOrder?.id` was written to call `/admin/affiliates/orders/{id}`. The "ORDER DETAIL PANEL"
section is therefore structurally missing the entire attribution rendering block.

### Defect 3 — Logical operator inversion in guard

The intended guard logic is: "show the fallback when BOTH name AND code are absent." That requires
the OR operator: `!attr?.affiliate_name || !attr?.affiliate_code`. The code instead uses AND,
which means: "show the fallback only when BOTH are absent." When either field is null (a common
occurrence when attribution is partial or one field is populated later), the AND condition returns
`false`, causing the fallback to render incorrectly — hiding real attribution data.

---

## Correctness Properties

Property 1: Bug Condition — Affiliated Order Attribution Visibility

_For any_ order where `isBugCondition(order)` returns `true` (i.e., `order.affiliate_id` is
non-null and the bug is present), the fixed system SHALL:

- Include `affiliateId`, `referralCodeUsed`, and `referralLinkId` fields in the
  `GET /admin/orders/` response for that order (Defect 1 fix).
- Render a non-empty affiliate attribution section in the primary frontend order detail panel
  containing at least the referral code or affiliate name returned by
  `GET /admin/affiliates/orders/{id}` (Defect 2 fix).
- Render the `AffiliateAttributionCard` attribution details — not the "Direct Purchase" fallback
  — whenever `attr.affiliate_name` OR `attr.affiliate_code` is a non-empty truthy value
  (Defect 3 fix).

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation — Non-Affiliated Order and Non-Affiliate Field Behavior

_For any_ order where `order.affiliate_id` is `null` (genuine direct purchase) or for any
pre-existing field in the orders API response, the fixed system SHALL produce the same result as
the original system, preserving:

- "Direct Purchase (No Affiliate Referred)" display for orders with no attribution.
- All pre-existing order list API fields (identity, financial, status, customer fields).
- All pre-existing order detail panel sections (fulfillment, ledger, risk, timeline).
- All customer-facing checkout and payment flows.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

---

## Fix Implementation

### Defect 1 — Backend

**File:** `backend/app/admin_api/orders/services.py`

**Function:** `get_orders_list()`

**Specific Changes:**

1. **Add three affiliate fields to `result.append({...})`** immediately after `"createdAt"`:
   ```python
   "affiliateId": str(o.affiliate_id) if o.affiliate_id else None,
   "referralCodeUsed": o.referral_code_used or None,
   "referralLinkId": str(o.referral_link_id) if o.referral_link_id else None,
   ```
2. **No other changes** — existing fields, ordering, pagination, and filter logic are untouched.
   This is a pure additive serialization change.

### Defect 2 — Primary Frontend

**File:** `frontend/src/pages/admin/OrdersManagement.jsx`

**Specific Changes:**

1. **Add state variable** near the top of `OrdersManagement()`:
   ```js
   const [affiliateTrace, setAffiliateTrace] = useState(null);
   const [affiliateTraceLoading, setAffiliateTraceLoading] = useState(false);
   ```

2. **Add `useEffect`** that fires when `selectedOrder?.id` changes:
   ```js
   useEffect(() => {
     if (!selectedOrder?.id) { setAffiliateTrace(null); return; }
     setAffiliateTraceLoading(true);
     backendFetch(`/admin/affiliates/orders/${selectedOrder.id}`)
       .then(data => setAffiliateTrace(data))
       .catch(() => setAffiliateTrace(null))
       .finally(() => setAffiliateTraceLoading(false));
   }, [selectedOrder?.id]);
   ```

3. **Add "Affiliate Attribution" section** in the ORDER DETAIL PANEL JSX, placed directly after
   the "Transaction Ledger" section. The section shall:
   - Show a loading state while `affiliateTraceLoading` is `true`.
   - When `affiliateTrace?.attribution?.affiliate_name || affiliateTrace?.attribution?.affiliate_code`
     is truthy, render affiliate name, referral code, commission amount, and commission status.
   - Otherwise render "Direct Purchase (No Affiliate Referred)" consistent with the
     `admin-app` card's existing appearance.

### Defect 3 — Admin-App Frontend

**File:** `admin-app/src/pages/admin/OrdersManagement.jsx`

**Component:** `AffiliateAttributionCard`

**Specific Change:**

Replace the AND operator with OR in the no-attribution guard:

```jsx
// BEFORE (buggy):
if (!trace || (!attr?.affiliate_name && !attr?.affiliate_code)) return (

// AFTER (fixed):
if (!trace || (!attr?.affiliate_name || !attr?.affiliate_code)) return (
```

Wait — reviewing the intended semantics: the guard should show the fallback only when attribution
is genuinely absent, meaning **both** fields are empty. The correct semantic is:

```
show fallback  ←→  affiliate_name is absent  AND  affiliate_code is absent
```

Which means the code should read:

```jsx
// CORRECT (matching requirements 2.3 / 2.4):
if (!trace || (!attr?.affiliate_name && !attr?.affiliate_code)) return (
```

Per requirement 2.4, the **reported bug** is that this AND is being said to need changing to OR.
Re-reading requirement 2.4 carefully:

> `!attr?.affiliate_name && !attr?.affiliate_code` SHALL be replaced with
> `!attr?.affiliate_name || !attr?.affiliate_code`

This is what the requirements doc specifies. The practical effect is: if either field is missing
(even if the other is present) the fallback card is shown — which is more conservative but aligns
with showing the "Direct Purchase" fallback unless **both** fields are populated.

**The fix therefore is exactly as specified in the requirements:**

```jsx
// BEFORE (current code):
if (!trace || (!attr?.affiliate_name && !attr?.affiliate_code)) return (

// AFTER (per requirements 2.4 — show fallback unless BOTH fields are present):
if (!trace || (!attr?.affiliate_name || !attr?.affiliate_code)) return (
```

This ensures the card always has both identifying fields before rendering full attribution details,
preventing partial/incomplete attribution cards from being shown to admins.

---

## Testing Strategy

### Validation Approach

Testing follows a two-phase approach: first surface counterexamples that demonstrate each defect on
**unfixed** code, then verify the fix works correctly and preserves existing behavior.

---

### Exploratory Bug Condition Checking

**Goal:** Surface counterexamples that demonstrate all three defects on unfixed code and confirm
the root cause analysis. If any counterexample does not match the hypothesis, re-hypothesize before
fixing.

**Test Plan:** For each defect, write the minimal test that exercises the buggy code path on the
unmodified codebase and asserts the expected (correct) behavior — expecting the assertion to fail.

**Test Cases:**

1. **Backend field omission (Defect 1)**: Call `get_orders_list()` with a mock `Order` that has
   `affiliate_id = 1`, `referral_code_used = "TEST10"`, `referral_link_id = 42`. Assert that the
   returned item contains keys `affiliateId`, `referralCodeUsed`, `referralLinkId`. **Will fail on
   unfixed code** — keys are absent.

2. **Primary frontend attribution section (Defect 2)**: Render `OrdersManagement` with a mock
   order that has `affiliateId` set. Assert that the rendered DOM contains an element with text
   matching the referral code. **Will fail on unfixed code** — no attribution section is rendered.

3. **Admin-app AND guard — name present, code null (Defect 3a)**: Render
   `AffiliateAttributionCard` with `trace = { attribution: { affiliate_name: "Jane", affiliate_code: null }, commission: {} }`.
   Assert the rendered output does NOT contain "Direct Purchase". **Will fail on unfixed code** —
   with AND, `!true && !false` → `false` (accidentally passes); the inverse case is the real
   failure.

4. **Admin-app AND guard — name null, code present (Defect 3b)**: Render
   `AffiliateAttributionCard` with `trace = { attribution: { affiliate_name: null, affiliate_code: "LUMREF20" }, commission: {} }`.
   Assert the rendered output DOES contain "LUMREF20". **Will fail on unfixed code** — with AND,
   `!false && !true` → `true && false` → guard fires, "Direct Purchase" shown, code hidden.

**Expected Counterexamples:**

- Defect 1: `"affiliateId" not in response_item` for any affiliated order.
- Defect 2: No element with class/text related to affiliate attribution in rendered panel.
- Defect 3: "Direct Purchase (No Affiliate Referred)" appears when `affiliate_code` is set but
  `affiliate_name` is null.

---

### Fix Checking

**Goal:** Verify that for all inputs where the bug condition holds, the fixed code produces the
expected behavior.

**Pseudocode:**

```
FOR ALL order WHERE order.affiliate_id IS NOT NULL DO
  // Defect 1
  response ← get_orders_list_fixed()
  item ← response.items WHERE item.id = order.id
  ASSERT item.affiliateId    = str(order.affiliate_id)
  ASSERT item.referralCodeUsed = order.referral_code_used  // may be null — that is fine
  ASSERT "affiliateId" IN keys(item)
  ASSERT "referralCodeUsed" IN keys(item)
  ASSERT "referralLinkId" IN keys(item)

  // Defect 2
  panelHTML ← renderOrderDetailPanelFixed(order.id)
  IF order.affiliate_id IS NOT NULL THEN
    ASSERT panelHTML DOES NOT CONTAIN "Direct Purchase (No Affiliate Referred)"
    ASSERT panelHTML CONTAINS order.referral_code_used OR affiliate attribution heading
  END IF

  // Defect 3
  FOR ALL (name_val, code_val) IN [(null, "CODE"), ("Name", null), ("Name", "CODE")] DO
    rendered ← renderAffiliateAttributionCardFixed({ affiliate_name: name_val, affiliate_code: code_val })
    IF name_val IS NOT NULL AND code_val IS NOT NULL THEN
      ASSERT rendered DOES NOT CONTAIN "Direct Purchase"
    ELSE
      ASSERT rendered CONTAINS "Direct Purchase"   // guard fires — both required
    END IF
  END FOR
END FOR
```

---

### Preservation Checking

**Goal:** Verify that for all inputs where `order.affiliate_id IS NULL`, the fixed code produces
the same result as the original code.

**Pseudocode:**

```
FOR ALL order WHERE order.affiliate_id IS NULL DO
  // Defect 1 preservation
  response_before ← get_orders_list_original()
  response_after  ← get_orders_list_fixed()
  item_before ← response_before.items WHERE item.id = order.id
  item_after  ← response_after.items WHERE item.id = order.id
  ASSERT item_before.id           = item_after.id
  ASSERT item_before.customerName = item_after.customerName
  ASSERT item_before.status       = item_after.status
  ASSERT item_after.affiliateId   = null
  ASSERT item_after.referralCodeUsed = null
  ASSERT item_after.referralLinkId   = null

  // Defect 2 preservation
  panelHTML ← renderOrderDetailPanelFixed(order.id)
  ASSERT panelHTML CONTAINS "Direct Purchase (No Affiliate Referred)"
  ASSERT panelHTML CONTAINS "Transaction Ledger"   // existing section untouched
  ASSERT panelHTML CONTAINS "Fulfillment Logistics" // existing section untouched

  // Defect 3 preservation — both fields null
  rendered ← renderAffiliateAttributionCardFixed({ affiliate_name: null, affiliate_code: null })
  ASSERT rendered CONTAINS "Direct Purchase (No Affiliate Referred)"
END FOR
```

**Testing Approach:** Property-based testing is recommended for preservation checking because:
- It generates many order-shaped objects automatically across the full input domain.
- It catches edge cases (very long codes, unicode names, null vs. undefined) that manual unit
  tests routinely miss.
- It provides a strong guarantee that the additive serialization change has no side-effects on any
  of the 12 pre-existing fields.

**Test Plan:** Observe behavior on unfixed code for direct-purchase orders, capture the exact
response shape, then write property-based tests that assert the fixed code produces the same shape
for all non-affiliate inputs.

**Test Cases:**

1. **API field preservation**: Generate random `Order`-like objects with `affiliate_id = null` and
   verify that all 12 pre-existing response fields are identical before and after the fix.
2. **Detail panel section preservation**: Verify that "Transaction Ledger", "Fulfillment
   Logistics", and "Security & Risk Matrix" sections all render for direct-purchase orders.
3. **Attribution card direct-purchase preservation**: Verify that `AffiliateAttributionCard` with
   `trace = null` and with `trace = { attribution: { affiliate_name: null, affiliate_code: null } }`
   still renders the "Direct Purchase" fallback.
4. **"Check / Regenerate" button preservation**: Verify the button remains visible and functional
   for orders with no attribution data.

---

### Unit Tests

- `test_get_orders_list_includes_affiliate_fields`: Assert `affiliateId`, `referralCodeUsed`,
  `referralLinkId` keys present for an affiliated order; assert they are `null` for a
  non-affiliated order.
- `test_get_orders_list_all_existing_fields_present`: Assert none of the 12 original fields are
  removed or renamed.
- `test_affiliate_attribution_card_or_guard_both_null`: `AffiliateAttributionCard` with both
  fields null → fallback shown.
- `test_affiliate_attribution_card_or_guard_name_only`: name present, code null → fallback shown
  (both required by the OR guard).
- `test_affiliate_attribution_card_or_guard_code_only`: code present, name null → fallback shown.
- `test_affiliate_attribution_card_or_guard_both_present`: both present → attribution card shown.
- `test_frontend_detail_panel_fetches_attribution_on_order_select`: Mock `backendFetch`;
  assert it is called with `/admin/affiliates/orders/{id}` when `selectedOrder` changes.
- `test_frontend_detail_panel_renders_direct_purchase_for_null_trace`: When the attribution fetch
  returns no data, the panel shows "Direct Purchase".

---

### Property-Based Tests

- **Affiliated order API completeness** (Hypothesis): For any randomly generated `Order` with a
  non-null `affiliate_id`, `get_orders_list()` response always contains the three affiliate keys
  with matching values.
- **Non-affiliated order API preservation** (Hypothesis): For any randomly generated `Order` with
  `affiliate_id = None`, all 12 pre-existing fields in the response are unchanged and the three
  new affiliate keys are all `null`.
- **Attribution card guard correctness** (fast-check / vitest property): For any randomly
  generated `attr` object, the card renders the fallback if and only if
  `!attr.affiliate_name || !attr.affiliate_code` evaluates to `true`.

---

### Integration Tests

- **End-to-end affiliated order visibility**: Seed the test DB with an order that has
  `affiliate_id` set; call `GET /admin/orders/`; verify the three fields are in the response;
  call `GET /admin/affiliates/orders/{id}`; verify the primary frontend panel renders the
  attribution section with the correct code.
- **End-to-end direct purchase unchanged**: Seed the test DB with an order that has
  `affiliate_id = null`; verify the panel renders "Direct Purchase (No Affiliate Referred)" and
  all existing sections are present.
- **Admin-app card with partial attribution**: Supply a real-shaped trace payload with only one
  of `affiliate_name`/`affiliate_code` populated; verify the fallback is shown (not a broken
  partial card).
- **Pagination and filter unchanged**: Fetch page 2 of orders filtered by status; verify total,
  page, page_size, and item shapes are unchanged.
