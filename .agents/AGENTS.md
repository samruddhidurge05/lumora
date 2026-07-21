# Lumora Project Rules

## Authentication Preservation
- **NEVER** modify, revert, or disable the authentication fixes, email verification flows, lowercase/strip email normalization, or login gates in the Lumora codebase.
- Standard customer/vendor/affiliate login and registration must always enforce email verification status.
- Admin authentication flows must remain separate and must not be forced through email verification checks.

## Payment & Checkout Page Preservation
- **NEVER** restore manual payment tabs, input controls, or custom UPI/Card forms on the checkout/payment page. The checkout flow must remain unified under a single primary "Pay" button that directly triggers Razorpay Checkout.
- **NEVER** round the checkout total to the nearest integer on the frontend (e.g., using `Math.round`) prior to sending it to the backend. The total must be calculated as a precise float to pass backend expected-total validation.

## Product File Extension Integrity
- **NEVER** hardcode product file extensions (like `.zip`) in the backend product creation/update services. Always preserve and use the original uploaded file extension from the temporary source path.

## Multi-Database Fallback for Reports
- **NEVER** remove the SQL database fallback and dual-write logic for reports. In case Firestore is over quota or unavailable, the backend must gracefully read and write reports via the `SQLReport` SQL database model.

## Message Center Removal
- **NEVER** restore or re-add the customer-creator direct "Messages Center" (chat conversation system) on the customer dashboard or product/creator pages unless explicitly requested. All customer inquiries must be routed through the Support Center ticket system.

## Price Alert Types
- **NEVER** change the `product_id` parameter or DB column type for `PriceAlert` and `RecentlyViewed` from `Integer` to string (`str`/`Union`), to ensure full compatibility with SQL database queries and avoid type mismatch failures.

