/**
 * test_affiliate_attribution_bug_condition.test.js
 * -------------------------------------------------
 * Bug condition exploration tests for Task 1 of the
 * affiliate-attribution-admin-display bugfix spec.
 *
 * CRITICAL: These tests are EXPECTED TO FAIL on UNFIXED code.
 * Failure CONFIRMS Defect 2 exists.
 * DO NOT fix the code or the tests when they fail.
 *
 * Defect 2 — Primary frontend missing fetch / render
 *   frontend/src/pages/admin/OrdersManagement.jsx has no useEffect that calls
 *   /admin/affiliates/orders/{id} and no JSX to render the returned attribution data.
 *
 * Because the frontend has no React testing library installed, these tests use
 * structural source-code assertions — the same approach used for other
 * exploratory bug condition probes in this project.
 *
 * Validates: Requirements 1.2
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path: frontend/src/tests/ → frontend/src/pages/admin/OrdersManagement.jsx
const ORDERS_MGMT_PATH = resolve(
  __dirname,
  '..', 'pages', 'admin', 'OrdersManagement.jsx'
);

describe('Defect 2 — Primary Frontend: OrdersManagement attribution fetch', () => {
  let source;

  beforeAll(() => {
    if (!existsSync(ORDERS_MGMT_PATH)) {
      throw new Error(
        `OrdersManagement.jsx not found at expected path: ${ORDERS_MGMT_PATH}`
      );
    }
    source = readFileSync(ORDERS_MGMT_PATH, 'utf-8');
  });

  /**
   * EXPECTED TO FAIL on unfixed code.
   *
   * The unfixed component has no state variable for affiliate trace data.
   * The order detail panel is structurally missing attribution state.
   *
   * COUNTEREXAMPLE when failing:
   *   'affiliateTrace' is NOT present in the source file.
   */
  test('OrdersManagement declares affiliateTrace state for attribution data', () => {
    const hasAffiliateTraceState = source.includes('affiliateTrace');

    expect(hasAffiliateTraceState).toBe(true, [
      'DEFECT 2 CONFIRMED: No "affiliateTrace" state variable found in',
      'frontend/src/pages/admin/OrdersManagement.jsx.',
      'The order detail panel is structurally missing attribution state —',
      'the component never stores affiliate data for the selected order.',
    ].join('\n'));
  });

  /**
   * EXPECTED TO FAIL on unfixed code.
   *
   * The unfixed component has no useEffect that fetches affiliate attribution
   * from /admin/affiliates/orders/{id}.
   *
   * COUNTEREXAMPLE when failing:
   *   '/admin/affiliates/orders/' is NOT present anywhere in the source.
   */
  test('OrdersManagement fetches affiliate attribution via /admin/affiliates/orders/:id', () => {
    const hasFetchCall = source.includes('/admin/affiliates/orders/');

    expect(hasFetchCall).toBe(true, [
      'DEFECT 2 CONFIRMED: The string "/admin/affiliates/orders/" is ABSENT from',
      'frontend/src/pages/admin/OrdersManagement.jsx.',
      'The component never calls GET /admin/affiliates/orders/{id} when an order',
      'is selected — the detail panel always shows no attribution data.',
    ].join('\n'));
  });

  /**
   * EXPECTED TO FAIL on unfixed code.
   *
   * Even if the fetch existed, the unfixed JSX has no rendering block for
   * affiliate attribution in the ORDER DETAIL PANEL section.
   *
   * COUNTEREXAMPLE when failing:
   *   No attribute attribution section heading or referral code render found.
   */
  test('OrdersManagement renders an affiliate attribution section in the detail panel', () => {
    // The fix adds a section with "Affiliate Attribution" heading and
    // renders referral code / affiliate name from affiliateTrace state.
    const hasAttributionSection = (
      source.includes('Affiliate Attribution') ||
      (source.includes('affiliateTrace') && source.includes('affiliate_code'))
    );

    expect(hasAttributionSection).toBe(true, [
      'DEFECT 2 CONFIRMED: No affiliate attribution section found in the ORDER DETAIL PANEL',
      'of frontend/src/pages/admin/OrdersManagement.jsx.',
      'The panel never renders affiliate name, referral code, or commission data,',
      'even when attribution records exist in the database.',
    ].join('\n'));
  });
});
