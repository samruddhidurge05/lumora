# Phase 2: Mock Data Detection & Classification Report

This document records the complete forensic scan conducted across all data stores (Firestore collections, local SQLite databases, backup dumps, and Render PostgreSQL) to identify and classify mock, test, synthetic, sandbox, or load-test data prior to production consolidation.

---

## Data Classification Matrix

| Data Collection / Store | Total Audited | Real Production | Mock / Test | Classification Rule & Excluded Patterns |
|---|---|---|---|---|
| **Firestore `users`** | 124 | **110** | 14 | Excluded `@example.com`, `@lumora.io`, `localadmin@lumora.com`, `testbuyer@lumora.dev`, `testcustomer_140726@example.com`, `newvendor@example.com`. |
| **Firestore `orders`** | 77 | **15** | 62 | Excluded orders containing `vendor-001`, `demo-prod-001`, `test-user-verify`, `vendor-mock-001`, `test@lumora.io`, `localadmin@lumora.com`. |
| **Firestore `products`** | 194 | **194** | 0 | All 194 products verified as real production items. |
| **Firestore `payments`** | 0 | **0** | 0 | Empty collection. |
| **Firestore `reviews`** | 0 | **0** | 0 | Empty collection. |
| **Firestore `reports`** | 0 | **0** | 0 | Empty collection. |
| **SQLite Sandbox (`test_lumora_sandbox.db`)** | 139 | **0** | 139 | 100% synthetic `@lumora.io` invitations (Category C pytest fixtures). **STRICTLY EXCLUDED**. |
| **Backup `lumora_backup_20260718_233756.db` (Invitations)** | 6 | **5** | 1 | 5 verified real Gmail addresses (`durgesamruddhi@gmail.com`, `68.samruddhidurge@gmail.com`, `avikapawar4@gmail.com`, `alokparmar251181@gmail.com`, `vaizagupta19@gmail.com`). 1 duplicate skipped. |
| **Backup `lumora_backup_20260718_233756.db` (Audit Logs)** | 162 | **161** | 1 | 161 real admin audit logs (login_success, product_updated, admin_invited). 1 duplicate skipped. |

---

## Mock Data Filtering Policy

1. **Email Exclusion Patterns**: Any record containing `@example.com`, `@lumora.io`, `test*@*`, `load_*`, `dummy`, `localadmin@lumora.com` was marked as `MOCK` and blocked from entry into Render PostgreSQL.
2. **Product Exclusion Patterns**: Demo items such as `TEST-001`, `demo-prod-001`, `Aetherial UI Kit Pro (Mock)` were blocked.
3. **ID Remapping Policy**: Real backup records with `admin_user_id=8` were remapped to the verified live admin `user_id=2` (`avikapawar08@gmail.com`).

---

## Final Enforcement Result

- **Total Mock Records Filtered Out**: 216 records (139 sandbox invitations, 62 test orders, 14 test users, 1 duplicate invite).
- **Mock Records Migrated to PostgreSQL**: **0 (ZERO)**.
