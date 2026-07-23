/**
 * test_affiliate_attribution_preservation.test.js (frontend)
 * -----------------------------------------------------------
 * Preservation tests for Task 2 of the affiliate-attribution-admin-display
 * bugfix spec.
 *
 * These tests verify that existing panel sections in
 * frontend/src/pages/admin/OrdersManagement.jsx survive unchanged after
 * the fix is applied (task 3.2).
 *
 * ALL tests here are EXPECTED TO PASS on both unfixed and fixed code.
 * They encode the baseline that must not regress.
 *
 * Testing approach: structural source-code assertions (no React test renderer
 * needed — the project has no testing library installed). This matches the
 * approach used throughout the project (see bug condition exploration tests).
 *
 * Tests:
 *   P1 — "Transaction Ledger" section heading is present in the source
 *   P2 — "Fulfillment Logistics" section heading is present in the source
 *   P3 — The component uses backendFetch for data loading
 *   P4 — Customer-profile fields (customerName, customerEmail) are rendered
 *   P5 — Order status handling code is present
 *   P6 — The component does NOT currently contain "Direct Purchase"
 *         in its own source (the direct-purchase fallback lives in admin-app,
 *         not in the primary frontend — before the fix)
 *   P7 — After fix: "Direct Purchase (No Affiliate Referred)" appears in source
 *         (the attribution section added by task 3.2 includes the fallback text)
 *
 * **Validates: Requirements 3.1, 3.3**
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Path: frontend/src/tests/ → frontend/src/pages/admin/OrdersManagement.jsx
const ORDERS_MGMT_PATH = resolve(
  __dirname,
  '..', 'pages', 'admin', 'OrdersManagement.jsx'
);

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

describe('Preservation — frontend OrdersManagement existing panel sections', () => {
  let source;

  beforeAll(() => {
    if (!existsSync(ORDERS_MGMT_PATH)) {
      throw new Error(
        `OrdersManagement.jsx not found at expected path:\n  ${ORDERS_MGMT_PATH}`
      );
    }
    source = readFileSync(ORDERS_MGMT_PATH, 'utf-8');
  });

  // -------------------------------------------------------------------------
  // P1 — "Transaction Ledger" section
  // -------------------------------------------------------------------------

  /**
   * EXPECTED TO PASS on unfixed AND fixed code.
   *
   * The "Transaction Ledger" section heading must remain present after any fix.
   * Validates: Requirements 3.3
   */
  test('P1: "Transaction Ledger" section heading is present in the detail panel', () => {
    expect(source).toContain('Transaction Ledger', [
      'PRESERVATION FAILURE: "Transaction Ledger" section heading is missing from',
      'frontend/src/pages/admin/OrdersManagement.jsx.',
      'The fix must not remove or rename this pre-existing panel section.',
    ].join('\n'));
  });

  // -------------------------------------------------------------------------
  // P2 — "Fulfillment Logistics" section
  // -------------------------------------------------------------------------

  /**
   * EXPECTED TO PASS on unfixed AND fixed code.
   *
   * The "Fulfillment Logistics" section must remain present after any fix.
   * Validates: Requirements 3.3
   */
  test('P2: "Fulfillment Logistics" section heading is present in the detail panel', () => {
    expect(source).toContain('Fulfillment Logistics', [
      'PRESERVATION FAILURE: "Fulfillment Logistics" section heading is missing from',
      'frontend/src/pages/admin/OrdersManagement.jsx.',
      'The fix must not remove or rename this pre-existing panel section.',
    ].join('\n'));
  });

  // -------------------------------------------------------------------------
  // P3 — backendFetch is used for data loading
  // -------------------------------------------------------------------------

  /**
   * EXPECTED TO PASS on unfixed AND fixed code.
   *
   * backendFetch must continue to be used (not replaced or removed).
   * Validates: Requirements 3.3
   */
  test('P3: component uses backendFetch for backend communication', () => {
    expect(source).toContain('backendFetch', [
      'PRESERVATION FAILURE: backendFetch is no longer present in',
      'frontend/src/pages/admin/OrdersManagement.jsx.',
      'The fix must not change the data-fetching mechanism.',
    ].join('\n'));
  });

  // -------------------------------------------------------------------------
  // P4 — Customer-profile data is rendered
  // -------------------------------------------------------------------------

  /**
   * EXPECTED TO PASS on unfixed AND fixed code.
   *
   * The detail panel renders customer name and email (customerName, customerEmail).
   * These must remain present.
   * Validates: Requirements 3.3
   */
  test('P4: component renders customerName and customerEmail fields', () => {
    expect(source).toContain('customerName', [
      'PRESERVATION FAILURE: "customerName" reference missing from the source.',
    ].join('\n'));
    expect(source).toContain('customerEmail', [
      'PRESERVATION FAILURE: "customerEmail" reference missing from the source.',
    ].join('\n'));
  });

  // -------------------------------------------------------------------------
  // P5 — Order status update logic is intact
  // -------------------------------------------------------------------------

  /**
   * EXPECTED TO PASS on unfixed AND fixed code.
   *
   * The order status handler (handleUpdateStatus) must remain present.
   * Validates: Requirements 3.3
   */
  test('P5: handleUpdateStatus function is present (order status logic intact)', () => {
    expect(source).toContain('handleUpdateStatus', [
      'PRESERVATION FAILURE: "handleUpdateStatus" not found in OrdersManagement.jsx.',
      'The fix must not remove the order status update functionality.',
    ].join('\n'));
  });

  // -------------------------------------------------------------------------
  // P6 — Pagination controls are present
  // -------------------------------------------------------------------------

  /**
   * EXPECTED TO PASS on unfixed AND fixed code.
   *
   * Pagination state (orderPage, orderTotalPages) must remain present.
   * Validates: Requirements 3.2
   */
  test('P6: pagination state variables are present (orderPage, orderTotalPages)', () => {
    expect(source).toContain('orderPage', [
      'PRESERVATION FAILURE: "orderPage" state not found — pagination was removed.',
    ].join('\n'));
    expect(source).toContain('orderTotalPages', [
      'PRESERVATION FAILURE: "orderTotalPages" state not found — pagination was removed.',
    ].join('\n'));
  });

  // -------------------------------------------------------------------------
  // P7 — After fix: attribution section with "Direct Purchase" fallback exists
  // -------------------------------------------------------------------------

  /**
   * EXPECTED TO PASS on FIXED code (after task 3.2).
   * Will FAIL on unfixed code — document this as expected.
   *
   * The fix (task 3.2) adds an "Affiliate Attribution" section. For direct-
   * purchase orders (affiliateTrace null) the section renders the fallback text
   * "Direct Purchase (No Affiliate Referred)". This test checks the FIXED shape.
   *
   * On unfixed code: "Direct Purchase (No Affiliate Referred)" is ABSENT from
   * this file (it only exists in admin-app). Expected to fail before fix.
   *
   * Validates: Requirements 3.1, 3.3
   */
  test('P7 (post-fix): detail panel includes "Direct Purchase (No Affiliate Referred)" fallback', () => {
    expect(source).toContain('Direct Purchase (No Affiliate Referred)', [
      'POST-FIX assertion: "Direct Purchase (No Affiliate Referred)" not found.',
      'After task 3.2, the Affiliate Attribution section must include this fallback',
      'for orders where affiliateTrace is null (genuine direct purchases).',
      'This test FAILS on unfixed code — that is expected for Task 2.',
    ].join('\n'));
  });
});
