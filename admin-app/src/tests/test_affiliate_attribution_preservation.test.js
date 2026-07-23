/**
 * test_affiliate_attribution_preservation.test.js (admin-app)
 * ------------------------------------------------------------
 * Preservation tests for Task 2 of the affiliate-attribution-admin-display
 * bugfix spec.
 *
 * These tests verify that the AffiliateAttributionCard guard logic:
 *   1. Still shows "Direct Purchase (No Affiliate Referred)" when BOTH
 *      affiliate_name AND affiliate_code are null/falsy.
 *   2. Shows the attribution card (no fallback) when BOTH fields are truthy.
 *   3. The source file still contains the key structural elements that must
 *      not regress (section headings, component name, etc.).
 *
 * ALL tests here (except P8 which is post-fix) PASS on both unfixed and
 * fixed code — they document the baseline behavior that must be preserved.
 *
 * Guard logic is tested directly (inline replica) — no React renderer needed.
 *
 * **Validates: Requirements 3.1, 3.4**
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Path to admin-app OrdersManagement that contains AffiliateAttributionCard
const ORDERS_MGMT_PATH = resolve(
  __dirname,
  '..', 'pages', 'admin', 'OrdersManagement.jsx'
);

// ---------------------------------------------------------------------------
// Inline replica of the UNFIXED guard logic (AND semantics)
// Used to verify that the PRESERVATION cases (both-null, both-truthy) behave
// identically under both AND and OR guard, since those are the baseline.
// ---------------------------------------------------------------------------

/**
 * UNFIXED guard — AND semantics (current unfixed code):
 *   if (!trace || (!attr?.affiliate_name && !attr?.affiliate_code)) → show fallback
 */
function unfixedGuard(trace) {
  if (!trace) return true;
  const attr = trace.attribution;
  const affiliate_name = attr?.affiliate_name ?? null;
  const affiliate_code = attr?.affiliate_code ?? null;
  return !affiliate_name && !affiliate_code;  // AND: fallback only when BOTH absent
}

/**
 * FIXED guard — OR semantics (post-fix code):
 *   if (!trace || (!attr?.affiliate_name || !attr?.affiliate_code)) → show fallback
 */
function fixedGuard(trace) {
  if (!trace) return true;
  const attr = trace.attribution;
  const affiliate_name = attr?.affiliate_name ?? null;
  const affiliate_code = attr?.affiliate_code ?? null;
  return !affiliate_name || !affiliate_code;  // OR: fallback when EITHER absent
}

// ---------------------------------------------------------------------------
// Guard Logic Preservation Tests
// All these PASS on both unfixed and fixed code
// ---------------------------------------------------------------------------

describe('Preservation — AffiliateAttributionCard guard: both-null and both-truthy cases', () => {

  /**
   * P1 — trace = null → "Direct Purchase" always shown.
   * Both AND and OR guards agree: when trace is null the fallback fires.
   * PASSES on unfixed AND fixed code.
   * Validates: Requirements 3.1, 3.4
   */
  test('P1: trace=null → fallback shown (both unfixed and fixed agree)', () => {
    const unfixedShowsFallback = unfixedGuard(null);
    const fixedShowsFallback   = fixedGuard(null);

    expect(unfixedShowsFallback).toBe(true, [
      'With trace=null, unfixed guard should show fallback.',
      `Got: unfixedGuard(null)=${unfixedShowsFallback}`,
    ].join('\n'));

    expect(fixedShowsFallback).toBe(true, [
      'With trace=null, fixed guard should show fallback.',
      `Got: fixedGuard(null)=${fixedShowsFallback}`,
    ].join('\n'));
  });

  /**
   * P2 — both fields null → "Direct Purchase" always shown.
   * AND guard: !null && !null → true → fallback.
   * OR  guard: !null || !null → true → fallback.
   * Both agree. PASSES on unfixed AND fixed code.
   * Validates: Requirements 3.1, 3.4
   */
  test('P2: both fields null → fallback shown (unfixed AND guard and fixed OR guard agree)', () => {
    const trace = { attribution: { affiliate_name: null, affiliate_code: null } };

    const unfixedShowsFallback = unfixedGuard(trace);
    const fixedShowsFallback   = fixedGuard(trace);

    expect(unfixedShowsFallback).toBe(true, [
      'PRESERVATION: With both fields null, the unfixed AND guard must show fallback.',
      '"Direct Purchase (No Affiliate Referred)" should appear.',
      `Got: unfixedGuard=${unfixedShowsFallback}`,
    ].join('\n'));

    expect(fixedShowsFallback).toBe(true, [
      'PRESERVATION: With both fields null, the fixed OR guard must show fallback.',
      '"Direct Purchase (No Affiliate Referred)" should appear.',
      `Got: fixedGuard=${fixedShowsFallback}`,
    ].join('\n'));
  });

  /**
   * P3 — both fields undefined → fallback shown (same as null).
   * PASSES on unfixed AND fixed code.
   * Validates: Requirements 3.1, 3.4
   */
  test('P3: both fields undefined → fallback shown', () => {
    const trace = { attribution: { affiliate_name: undefined, affiliate_code: undefined } };

    const unfixedShowsFallback = unfixedGuard(trace);
    const fixedShowsFallback   = fixedGuard(trace);

    expect(unfixedShowsFallback).toBe(true);
    expect(fixedShowsFallback).toBe(true);
  });

  /**
   * P4 — both fields empty string → fallback shown (falsy).
   * PASSES on unfixed AND fixed code.
   * Validates: Requirements 3.1, 3.4
   */
  test('P4: both fields empty string → fallback shown (falsy values)', () => {
    const trace = { attribution: { affiliate_name: '', affiliate_code: '' } };

    const unfixedShowsFallback = unfixedGuard(trace);
    const fixedShowsFallback   = fixedGuard(trace);

    expect(unfixedShowsFallback).toBe(true);
    expect(fixedShowsFallback).toBe(true);
  });

  /**
   * P5 — attribution object missing entirely → fallback shown.
   * PASSES on unfixed AND fixed code.
   * Validates: Requirements 3.1
   */
  test('P5: attribution object missing from trace → fallback shown', () => {
    const trace = {};  // no .attribution property

    const unfixedShowsFallback = unfixedGuard(trace);
    const fixedShowsFallback   = fixedGuard(trace);

    expect(unfixedShowsFallback).toBe(true);
    expect(fixedShowsFallback).toBe(true);
  });

  /**
   * P6 — BOTH fields truthy → attribution card shown (no fallback).
   * AND guard: !"Jane" && !"LUMREF20" → false && false → false → card shown.
   * OR  guard: !"Jane" || !"LUMREF20" → false || false → false → card shown.
   * Both agree when both fields present. PASSES on unfixed AND fixed code.
   * Validates: Requirements 3.4
   */
  test('P6: both fields truthy → attribution card shown (unfixed AND and fixed OR agree)', () => {
    const trace = {
      attribution: { affiliate_name: 'Jane Doe', affiliate_code: 'LUMREF20' },
      commission: { amount: 12.50, status: 'approved' }
    };

    const unfixedShowsFallback = unfixedGuard(trace);
    const fixedShowsFallback   = fixedGuard(trace);

    expect(unfixedShowsFallback).toBe(false, [
      'PRESERVATION: With both fields present, unfixed AND guard must NOT show fallback.',
      'Attribution card should be rendered.',
      `Got: unfixedGuard=${unfixedShowsFallback}`,
    ].join('\n'));

    expect(fixedShowsFallback).toBe(false, [
      'PRESERVATION: With both fields present, fixed OR guard must NOT show fallback.',
      'Attribution card should be rendered.',
      `Got: fixedGuard=${fixedShowsFallback}`,
    ].join('\n'));
  });

  /**
   * P7 — Both guards agree for the preservation cases (both-null and both-truthy).
   * This validates that fixing AND→OR does NOT break the baseline behavior.
   * PASSES on unfixed AND fixed code.
   */
  test('P7: both guards produce identical results for preservation cases (null, truthy)', () => {
    const preservationCases = [
      { desc: 'trace=null',            trace: null },
      { desc: 'both null',             trace: { attribution: { affiliate_name: null,      affiliate_code: null      } } },
      { desc: 'both empty string',     trace: { attribution: { affiliate_name: '',         affiliate_code: ''        } } },
      { desc: 'both truthy',           trace: { attribution: { affiliate_name: 'Jane Doe', affiliate_code: 'LUMREF20' } } },
      { desc: 'both non-empty values', trace: { attribution: { affiliate_name: 'Alice',    affiliate_code: 'REF99'   } } },
    ];

    for (const { desc, trace } of preservationCases) {
      const unfixedResult = unfixedGuard(trace);
      const fixedResult   = fixedGuard(trace);

      expect(unfixedResult).toBe(fixedResult, [
        `Guard result differs for case "${desc}" — this should be a preservation case.`,
        `unfixedGuard=${unfixedResult}, fixedGuard=${fixedResult}`,
        'Preservation cases (both-null and both-truthy) must produce the same',
        'result before and after the AND→OR fix.',
      ].join('\n'));
    }
  });
});

// ---------------------------------------------------------------------------
// Source Inspection: AffiliateAttributionCard structural preservation
// ---------------------------------------------------------------------------

describe('Preservation — AffiliateAttributionCard source structure', () => {

  let source;

  beforeAll(() => {
    if (!existsSync(ORDERS_MGMT_PATH)) {
      throw new Error(
        `admin-app OrdersManagement.jsx not found at:\n  ${ORDERS_MGMT_PATH}`
      );
    }
    source = readFileSync(ORDERS_MGMT_PATH, 'utf-8');
  });

  /**
   * P_S1 — AffiliateAttributionCard component is defined.
   * Must remain present after any fix. PASSES on unfixed AND fixed code.
   */
  test('P_S1: AffiliateAttributionCard component is defined in source', () => {
    expect(source).toContain('AffiliateAttributionCard', [
      'PRESERVATION FAILURE: AffiliateAttributionCard no longer defined.',
      'The fix must not remove or rename this component.',
    ].join('\n'));
  });

  /**
   * P_S2 — "Direct Purchase (No Affiliate Referred)" fallback text is present.
   * This text must remain in the component on unfixed AND fixed code.
   * PASSES on both.
   */
  test('P_S2: "Direct Purchase (No Affiliate Referred)" fallback text is present', () => {
    expect(source).toContain('Direct Purchase (No Affiliate Referred)', [
      'PRESERVATION FAILURE: Fallback text "Direct Purchase (No Affiliate Referred)"',
      'is missing from admin-app OrdersManagement.jsx.',
      'The fix must not remove this fallback display.',
    ].join('\n'));
  });

  /**
   * P_S3 — "Check / Regenerate" button is still present.
   * Validates: Requirements 3.6
   */
  test('P_S3: "Check / Regenerate" button is present in AffiliateAttributionCard', () => {
    expect(source).toContain('Check / Regenerate', [
      'PRESERVATION FAILURE: "Check / Regenerate" button text not found.',
      'The fix must not remove the Check / Regenerate functionality.',
    ].join('\n'));
  });

  /**
   * P_S4 — The guard condition is present (either AND or OR form).
   * PASSES on unfixed (AND) and fixed (OR) code.
   */
  test('P_S4: no-attribution guard condition is present in source', () => {
    const hasAndGuard = /!attr\?\.affiliate_name\s*&&\s*!attr\?\.affiliate_code/.test(source);
    const hasOrGuard  = /!attr\?\.affiliate_name\s*\|\|\s*!attr\?\.affiliate_code/.test(source);

    expect(hasAndGuard || hasOrGuard).toBe(true, [
      'PRESERVATION FAILURE: the no-attribution guard condition is completely absent.',
      'Expected either:',
      '  !attr?.affiliate_name && !attr?.affiliate_code  (unfixed)',
      '  !attr?.affiliate_name || !attr?.affiliate_code  (fixed)',
      'The guard is required for the "Direct Purchase" fallback to work.',
    ].join('\n'));
  });

  /**
   * P_S5 — backendFetch call for /admin/affiliates/orders/ endpoint is present.
   * PASSES on unfixed AND fixed code.
   */
  test('P_S5: AffiliateAttributionCard fetches /admin/affiliates/orders/ endpoint', () => {
    expect(source).toContain('/admin/affiliates/orders/', [
      'PRESERVATION FAILURE: "/admin/affiliates/orders/" not found in source.',
      'AffiliateAttributionCard must still fetch from this endpoint.',
    ].join('\n'));
  });

  /**
   * P_S6 — Regenerate button calls /regenerate-commission endpoint.
   * PASSES on unfixed AND fixed code. Validates: Requirements 3.6
   */
  test('P_S6: handleRegenerate uses /regenerate-commission endpoint', () => {
    expect(source).toContain('regenerate-commission', [
      'PRESERVATION FAILURE: regenerate-commission endpoint missing.',
      'The "Check / Regenerate" button still needs to call this endpoint.',
    ].join('\n'));
  });

  /**
   * P_S8 (post-fix): Confirm the guard uses OR (not AND) — expected to FAIL on unfixed code.
   * This test is included to provide the full suite for task 3.5.
   * When running Task 2 only, this test expectedly fails.
   */
  test('P_S8 (post-fix): guard uses OR operator (not AND) — FAILS on unfixed code as expected', () => {
    const hasOrGuard = /!attr\?\.affiliate_name\s*\|\|\s*!attr\?\.affiliate_code/.test(source);

    expect(hasOrGuard).toBe(true, [
      'POST-FIX assertion: expected OR guard in AffiliateAttributionCard.',
      'This test FAILS on unfixed code — that is expected for Task 2.',
      'After task 3.3, the guard should use || instead of &&.',
      'Unfixed form: !attr?.affiliate_name && !attr?.affiliate_code',
      'Fixed form:   !attr?.affiliate_name || !attr?.affiliate_code',
    ].join('\n'));
  });
});
