# Lumora Identity Lifecycle & Role Elevation Specification

## Overview
This document outlines how Lumora handles identity transitions for all 5 user role archetypes.

---

## Identity Scenarios

### Scenario 1: Brand New Email Onboarding
1. Super Admin invites `new_user@lumora.io`.
2. User clicks link and registers via Firebase Auth (Customer bootstrap).
3. User calls `POST /api/admin/team/accept-invite`.
4. Role elevated from `customer` ➔ `admin`. `AdminRole` record created.

### Scenario 2: Existing Customer Role Elevation
1. Customer has existing purchase history, wishlist, and orders.
2. Super Admin invites `customer@lumora.io`.
3. Customer accepts invitation.
4. `User.role` updated to `admin`. Orders, wishlist, and customer profile remain **100% intact**.

### Scenario 3: Existing Vendor Role Addition
1. Vendor has active products and store setup.
2. Super Admin invites `vendor@lumora.io`.
3. Vendor accepts invitation.
4. `AdminRole` granted. Products, sales, and vendor storefront remain **100% intact**.

### Scenario 4: Existing Affiliate Role Addition
1. Affiliate has active referral tracking and earnings.
2. Super Admin invites `affiliate@lumora.io`.
3. Affiliate accepts invitation.
4. `AdminRole` granted. Affiliate links, earnings, and referrals remain **100% intact**.

### Scenario 5: Existing Admin Access
1. User is already an active admin.
2. Accept invite attempt detects active status and returns clean `200 OK` routing immediately to Admin Dashboard.
