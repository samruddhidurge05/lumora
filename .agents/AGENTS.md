# Lumora Project Rules

## Authentication Preservation
- **NEVER** modify, revert, or disable the authentication fixes, email verification flows, lowercase/strip email normalization, or login gates in the Lumora codebase.
- Standard customer/vendor/affiliate login and registration must always enforce email verification status.
- Admin authentication flows must remain separate and must not be forced through email verification checks.

## Payment & Checkout Page Preservation
- **NEVER** restore manual payment tabs, input controls, or custom UPI/Card forms on the checkout/payment page. The checkout flow must remain unified under a single primary "Pay" button that directly triggers Razorpay Checkout.
- **NEVER** round the checkout total to the nearest integer on the frontend (e.g., using `Math.round`) prior to sending it to the backend. The total must be calculated as a precise float to pass backend expected-total validation.
