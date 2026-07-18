# Lumora Project Rules

## Authentication Preservation
- **NEVER** modify, revert, or disable the authentication fixes, email verification flows, lowercase/strip email normalization, or login gates in the Lumora codebase.
- Standard customer/vendor/affiliate login and registration must always enforce email verification status.
- Admin authentication flows must remain separate and must not be forced through email verification checks.
