# Bugfix Requirements Document

## Introduction

Every order placed through a valid affiliate referral link correctly creates `ReferralAttribution` and `AffiliateCommission` records in SQLite — attribution data is present and accurate. Despite this, the Admin Order Details page always displays "Direct Purchase (No Affiliate Referred)" and the "Check / Regenerate" button also reports no valid attribution.

Three independent defects combine to produce this symptom:

1. **Backend** — `get_orders_list()` omits `affiliate_id`, `referral_code_used`, and `referral_link_id` from its response, so the admin frontend never receives affiliate metadata alongside order data.
2. **Primary frontend** (`frontend/src/pages/admin/OrdersManagement.jsx`) — The order detail panel has no code to fetch or render affiliate attribution; it never calls the `/admin/affiliates/orders/{id}` endpoint.
3. **Secondary frontend** (`admin-app/src/pages/admin/OrdersManagement.jsx`) — The `AffiliateAttributionCard` component uses `!attr?.affiliate_name && !attr?.affiliate_code` (AND) as its "no attribution" guard, which can incorrectly trigger the "Direct Purchase" fallback when only one of the two fields is populated.

The combined impact is that admins cannot verify affiliate conversions for any order, and the "Check / Regenerate" workflow produces false negatives even when attribution records exist.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the admin orders list API (`GET /admin/orders/`) is called THEN the system returns order objects that omit `affiliate_id`, `referral_code_used`, and `referral_link_id` even when those fields are populated on the underlying `Order` model.

1.2 WHEN an admin selects any order in `frontend/src/pages/admin/OrdersManagement.jsx` THEN the system displays an order detail panel that never fetches or renders affiliate attribution data, regardless of whether attribution exists in the database.

1.3 WHEN an admin selects an order in `admin-app/src/pages/admin/OrdersManagement.jsx` where `trace.attribution.affiliate_name` is null but `trace.attribution.affiliate_code` is set (or vice versa) THEN the system incorrectly renders "Direct Purchase (No Affiliate Referred)" due to the AND condition `!attr?.affiliate_name && !attr?.affiliate_code`.

1.4 WHEN an admin clicks "Check / Regenerate" on any order that has valid attribution in the database THEN the system reports no valid attribution exists, because the same AND condition gates both the attribution display and the regeneration feedback.

### Expected Behavior (Correct)

2.1 WHEN the admin orders list API (`GET /admin/orders/`) is called THEN the system SHALL include `affiliateId`, `referralCodeUsed`, and `referralLinkId` fields in every order object in the response, populated from the corresponding `Order` model fields (`affiliate_id`, `referral_code_used`, `referral_link_id`), with `null` values where no affiliate attribution exists.

2.2 WHEN an admin selects an order in `frontend/src/pages/admin/OrdersManagement.jsx` THEN the system SHALL fetch affiliate attribution from `GET /admin/affiliates/orders/{id}` for the selected order and render the attribution details (affiliate name, referral code, commission amount, commission status) within the order detail panel.

2.3 WHEN the `/admin/affiliates/orders/{id}` response contains attribution where either `affiliate_name` OR `affiliate_code` is a non-empty truthy value THEN the system SHALL display the attributed affiliate details and SHALL NOT show "Direct Purchase (No Affiliate Referred)".

2.4 WHEN the attribution guard condition is evaluated THEN the system SHALL use the OR operator — `!attr?.affiliate_name && !attr?.affiliate_code` SHALL be replaced with `!attr?.affiliate_name || !attr?.affiliate_code` — ensuring attribution is displayed whenever at least one identifying field is present.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an order genuinely has no affiliate attribution (i.e., `affiliate_id` is null and no `ReferralAttribution` record exists) THEN the system SHALL CONTINUE TO display "Direct Purchase (No Affiliate Referred)" in the order detail panel.

3.2 WHEN the admin orders list is fetched and filtered by status THEN the system SHALL CONTINUE TO apply status filtering, pagination, and ordering correctly, unaffected by the addition of affiliate fields.

3.3 WHEN an admin views order details for a non-affiliate order in `frontend/src/pages/admin/OrdersManagement.jsx` THEN the system SHALL CONTINUE TO display all existing order fields (customer info, items, total, status, payment method) without regression.

3.4 WHEN the `AffiliateAttributionCard` in `admin-app` renders an order with confirmed full attribution (both `affiliate_name` and `affiliate_code` are truthy) THEN the system SHALL CONTINUE TO display the affiliate details card correctly with no change in behavior.

3.5 WHEN the customer checkout flow executes (purchase, payment confirmation, commission creation) THEN the system SHALL CONTINUE TO operate without modification — no changes to `purchase_service.py`, `payment_service.py`, or any customer-facing route.

3.6 WHEN an admin uses the "Check / Regenerate" button on an order that truly has no attribution THEN the system SHALL CONTINUE TO indicate no valid attribution exists and offer commission regeneration.

---

## Bug Condition Pseudocode

### Bug Condition Function

```pascal
FUNCTION isBugCondition(order)
  INPUT: order — an Order record with potential affiliate attribution
  OUTPUT: boolean

  // Bug is triggered when any of the following are true:
  RETURN (
    // Defect 1: API response is missing affiliate fields
    order.affiliate_id IS NOT NULL
    AND "affiliateId" NOT IN getOrdersListResponseKeys(order)
  )
  OR (
    // Defect 2: Primary frontend never fetches attribution
    adminFrontendIsLegacy(requestingFrontend)
    AND order.affiliate_id IS NOT NULL
  )
  OR (
    // Defect 3: AND guard triggers false "Direct Purchase"
    order.affiliate_id IS NOT NULL
    AND attr.affiliate_name IS NULL
    AND attr.affiliate_code IS NOT NULL
    // OR vice versa — one field missing but other is present
  )
END FUNCTION
```

### Fix Checking Property

```pascal
// Property: Fix Checking — Attribution must be visible for any affiliated order
FOR ALL order WHERE order.affiliate_id IS NOT NULL DO
  response ← getOrdersListAPI(order.id)
  ASSERT "affiliateId" IN response AND response.affiliateId = order.affiliate_id

  panelHTML ← renderOrderDetailPanel(order.id)
  ASSERT panelHTML DOES NOT CONTAIN "Direct Purchase (No Affiliate Referred)"
  ASSERT panelHTML CONTAINS order.referral_code_used
END FOR
```

### Preservation Checking Property

```pascal
// Property: Preservation Checking — Non-affiliate orders must be unaffected
FOR ALL order WHERE order.affiliate_id IS NULL DO
  response ← getOrdersListAPI(order.id)
  ASSERT F(order) = F'(order)  // All non-affiliate fields identical before/after fix

  panelHTML ← renderOrderDetailPanel(order.id)
  ASSERT panelHTML CONTAINS "Direct Purchase (No Affiliate Referred)"
END FOR
```
