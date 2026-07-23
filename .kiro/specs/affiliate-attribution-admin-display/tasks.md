# Implementation Plan

## Overview

Fix three independent defects that together make affiliate attribution invisible on the admin order detail pages. The workflow follows the exploratory bugfix approach: write tests against unfixed code first, implement the three localized fixes, then verify all tests pass with no regressions.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3.1", "3.2", "3.3"] },
    { "wave": 4, "tasks": ["3.4", "3.5"] },
    { "wave": 5, "tasks": ["4"] }
  ]
}
```

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Affiliate Fields Omitted from Orders List API
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate all three defects exist
  - **Scoped PBT Approach**: For Defect 1, scope to the concrete failing case: any Order with `affiliate_id` set
  - Write a pytest test in `backend/tests/test_affiliate_attribution_bug_condition.py`:
    - Create a mock `Order` with `affiliate_id=1`, `referral_code_used="LUMREF20"`, `referral_link_id=42`
    - Call `get_orders_list()` and assert the returned item contains keys `affiliateId`, `referralCodeUsed`, `referralLinkId`
    - **On unfixed code**: assertion fails — keys are absent from the serialized dict
  - Write a frontend unit test in `frontend/src/` that renders `OrdersManagement` with a selected order that has `affiliateId` set and asserts the detail panel DOM contains an element with the referral code text
    - **On unfixed code**: assertion fails — no attribution section is rendered
  - Write a component test for `AffiliateAttributionCard` with `trace = { attribution: { affiliate_name: null, affiliate_code: "LUMREF20" }, commission: {} }`:
    - Assert the rendered output DOES contain `"LUMREF20"` (i.e., the attribution card is shown, NOT the "Direct Purchase" fallback)
    - **On unfixed code**: `!null && !"LUMREF20"` → `true && false` → `false` — accidentally renders card for this specific case
    - Also test with `trace = { attribution: { affiliate_name: "Jane", affiliate_code: null }, commission: {} }`:
      - Assert rendered output does NOT contain "Direct Purchase (No Affiliate Referred)"
      - **On unfixed code**: `!"Jane" && !null` → `false && true` → `false` — card shown (accidentally correct); confirms AND guard is wrong by symmetry
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Backend and frontend attribution-fetch tests FAIL (proves bugs exist); document the exact counterexample
  - Mark task complete when tests are written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Affiliate Order Fields and Direct-Purchase Display
  - **IMPORTANT**: Follow observation-first methodology — observe unfixed code behavior for direct-purchase orders first
  - Observe: `get_orders_list()` returns these 12 fields for a direct-purchase order (affiliate_id = None): `id`, `orderId`, `customerId`, `customerName`, `customerEmail`, `items`, `totalUSD`, `price`, `status`, `paymentStatus`, `paymentMethod`, `createdAt`
  - Observe: `AffiliateAttributionCard` with `trace = None` renders "Direct Purchase (No Affiliate Referred)"
  - Observe: `AffiliateAttributionCard` with `trace = { attribution: { affiliate_name: None, affiliate_code: None } }` renders "Direct Purchase (No Affiliate Referred)"
  - Write property-based test using Hypothesis in `backend/tests/test_affiliate_attribution_preservation_pbt.py`:
    - Use `@given` to generate random `Order`-like objects with `affiliate_id = None` and arbitrary valid values for all other fields
    - Assert all 12 pre-existing response fields are present and have correct types/values
    - Assert `affiliateId = None`, `referralCodeUsed = None`, `referralLinkId = None` in the response (these keys may not exist yet on unfixed code — that is fine; the test is written for the fixed shape and should PASS on fixed code)
    - **Strategy**: Split into two tests — (a) existing-fields preservation (should PASS on unfixed code), (b) null affiliate fields (should PASS after fix)
    - Run only the existing-fields preservation test on unfixed code
  - Write frontend preservation test: render `OrdersManagement` with a direct-purchase order (no `affiliateId`) and assert the panel contains "Transaction Ledger", "Fulfillment Logistics", and "Direct Purchase (No Affiliate Referred)"
  - Write admin-app component preservation test: `AffiliateAttributionCard` with both fields null → assert "Direct Purchase (No Affiliate Referred)" is present; with both fields truthy → assert attribution card is shown
  - Run all preservation tests on UNFIXED code
  - **EXPECTED OUTCOME**: Existing-field preservation tests PASS (confirms baseline to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix affiliate attribution admin display (three localized defects)

  - [x] 3.1 Defect 1 — Add affiliate fields to `get_orders_list()` serialization
    - File: `backend/app/admin_api/orders/services.py`, function `get_orders_list()`
    - In the `result.append({...})` block, add three fields immediately after `"createdAt"`:
      ```python
      "affiliateId": str(o.affiliate_id) if o.affiliate_id else None,
      "referralCodeUsed": o.referral_code_used or None,
      "referralLinkId": str(o.referral_link_id) if o.referral_link_id else None,
      ```
    - No other changes — existing fields, pagination, ordering, and filter logic are untouched
    - DO NOT modify: `backend/app/models/order.py`, `backend/app/services/purchase_service.py`, `backend/app/services/payment_service.py`
    - _Bug_Condition: `isBugCondition(order)` where `order.affiliate_id IS NOT NULL` and `"affiliateId" NOT IN getOrdersListResponseKeys(order)`_
    - _Expected_Behavior: response item contains `affiliateId = str(order.affiliate_id)`, `referralCodeUsed = order.referral_code_used or None`, `referralLinkId = str(order.referral_link_id) or None`_
    - _Preservation: all 12 pre-existing fields (`id`, `orderId`, `customerId`, `customerName`, `customerEmail`, `items`, `totalUSD`, `price`, `status`, `paymentStatus`, `paymentMethod`, `createdAt`) remain present and unchanged; direct-purchase orders get `null` for all three new fields_
    - _Requirements: 2.1, 3.2_

  - [x] 3.2 Defect 2 — Wire up affiliate attribution fetch and render in primary frontend
    - File: `frontend/src/pages/admin/OrdersManagement.jsx`
    - Add two state variables near the top of `OrdersManagement()`:
      ```js
      const [affiliateTrace, setAffiliateTrace] = useState(null);
      const [affiliateTraceLoading, setAffiliateTraceLoading] = useState(false);
      ```
    - Add a `useEffect` that fires when `selectedOrder?.id` changes:
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
    - Add an "Affiliate Attribution" section to the ORDER DETAIL PANEL JSX (right 40% panel), placed directly after the "Transaction Ledger" section:
      - Show a loading spinner/indicator while `affiliateTraceLoading` is `true`
      - When `affiliateTrace?.attribution?.affiliate_name || affiliateTrace?.attribution?.affiliate_code` is truthy, render: affiliate name, referral code, commission amount, commission status
      - Otherwise render "Direct Purchase (No Affiliate Referred)" consistent with the admin-app card's appearance
    - DO NOT modify any customer-facing routes, checkout flow, or payment/purchase services
    - _Bug_Condition: `order.affiliate_id IS NOT NULL` and `requestingFrontend = "frontend/src/pages/admin/OrdersManagement.jsx"` — detail panel never fetches attribution_
    - _Expected_Behavior: `backendFetch("/admin/affiliates/orders/{id}")` is called when `selectedOrder?.id` changes; attribution details are rendered in the panel_
    - _Preservation: all existing panel sections (Customer Profile Header, Fulfillment Logistics, Transaction Ledger, Security & Risk Matrix, Lifecycle Event Timeline) render without regression_
    - _Requirements: 2.2, 2.3, 3.1, 3.3_

  - [x] 3.3 Defect 3 — Fix boolean guard in `AffiliateAttributionCard`
    - File: `admin-app/src/pages/admin/OrdersManagement.jsx`, component `AffiliateAttributionCard`
    - Replace the AND operator with OR in the no-attribution guard:
      ```jsx
      // BEFORE (buggy):
      if (!trace || (!attr?.affiliate_name && !attr?.affiliate_code)) return (

      // AFTER (fixed):
      if (!trace || (!attr?.affiliate_name || !attr?.affiliate_code)) return (
      ```
    - This ensures the fallback is shown unless BOTH `affiliate_name` AND `affiliate_code` are truthy — preventing partial/incomplete attribution cards from being displayed to admins
    - No other changes in this file
    - _Bug_Condition: `order.affiliate_id IS NOT NULL` and exactly one of `attr.affiliate_name` / `attr.affiliate_code` is null — AND guard fires false negative_
    - _Expected_Behavior: fallback ("Direct Purchase") shown when either field is absent; full attribution card shown only when both fields are truthy_
    - _Preservation: when both fields are truthy, existing attribution card rendering is unchanged; when both fields are null/falsy, "Direct Purchase" is still shown_
    - _Requirements: 2.3, 2.4, 3.4_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Affiliate Attribution Visibility for Affiliated Orders
    - **IMPORTANT**: Re-run the SAME tests written in task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior across all three defects
    - Run `backend/tests/test_affiliate_attribution_bug_condition.py` — assert `affiliateId`, `referralCodeUsed`, `referralLinkId` are present in the response for affiliated orders
    - Run frontend component test — assert attribution section renders with the referral code
    - Run `AffiliateAttributionCard` test — assert "LUMREF20" is shown and "Direct Purchase" is NOT shown when one field is present
    - **EXPECTED OUTCOME**: All tests from task 1 now PASS (confirms all three defects are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Affiliate Order Fields and Direct-Purchase Display
    - **IMPORTANT**: Re-run the SAME tests written in task 2 — do NOT write new tests
    - Run `backend/tests/test_affiliate_attribution_preservation_pbt.py` — full suite including the null-affiliate-fields assertion
    - Run frontend preservation test — assert "Transaction Ledger", "Fulfillment Logistics", and "Direct Purchase (No Affiliate Referred)" render for direct-purchase orders
    - Run admin-app preservation tests — both-null shows fallback, both-truthy shows attribution card
    - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions)
    - Confirm pagination, filtering, and ordering in the admin orders list are unaffected

- [ ] 4. Checkpoint — Ensure all tests pass
  - Run the full backend test suite: `pytest backend/tests/ -v`
  - Run frontend unit tests: `npm test --run` (or equivalent single-run command) in `frontend/`
  - Run admin-app unit tests: `npm test --run` in `admin-app/`
  - All of the following must be green:
    - `test_affiliate_attribution_bug_condition.py` — all assertions pass
    - `test_affiliate_attribution_preservation_pbt.py` — all Hypothesis examples pass
    - Frontend attribution fetch and render tests pass
    - Admin-app `AffiliateAttributionCard` guard tests pass (all four cases: both-null, name-only, code-only, both-present)
    - No pre-existing tests are newly failing
  - Confirm files NOT modified: `backend/app/services/purchase_service.py`, `backend/app/services/payment_service.py`, `backend/app/models/order.py`, `backend/app/models/affiliate.py`, `backend/admin/routes/affiliates.py`, any customer-facing route
  - Ask the user if any questions arise before marking complete

## Notes

- **Do not modify**: `backend/app/services/purchase_service.py`, `backend/app/services/payment_service.py`, `backend/app/models/order.py`, `backend/app/models/affiliate.py`, `backend/admin/routes/affiliates.py`, any customer-facing route, or the checkout flow.
- All three defect fixes are purely additive and localized — no shared utilities, base classes, or models are changed.
- The Hypothesis PBT suite in task 2 / 3.5 is the strongest preservation guarantee for the backend serialization change (12 pre-existing fields across arbitrary order shapes).
- Tasks 3.1, 3.2, and 3.3 are independent of each other and can be implemented in parallel.
