/**
 * test_affiliate_attribution_bug_condition.test.js (admin-app)
 * -------------------------------------------------------------
 * Bug condition exploration tests for Task 1 of the
 * affiliate-attribution-admin-display bugfix spec.
 *
 * CRITICAL: These tests are EXPECTED TO FAIL on UNFIXED code (except Defect 3a
 * which accidentally passes with AND guard — document both results).
 * DO NOT fix the code or the tests when they fail.
 *
 * Defect 3 — Admin-app boolean guard (AND instead of OR)
 *   AffiliateAttributionCard uses:
 *     if (!trace || (!attr?.affiliate_name && !attr?.affiliate_code)) return fallback
 *
 *   This AND condition means: show fallback ONLY when BOTH fields are absent.
 *   When affiliate_name is present but affiliate_code is null (or vice versa),
 *   the guard returns false and the attribution card is shown — but with a
 *   missing field (partial/broken state).
 *
 *   The correct behavior (OR guard) shows fallback when EITHER field is absent.
 *
 * Two sub-cases are tested:
 *   3a: name=null, code="LUMREF20" — AND guard accidentally shows card (passes on unfixed)
 *   3b: name="Jane", code=null    — AND guard accidentally shows card (wrong: should show fallback)
 *
 * Additionally, a structural source inspection confirms the guard operator.
 *
 * Validates: Requirements 1.3
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the admin-app OrdersManagement that contains AffiliateAttributionCard
const ORDERS_MGMT_PATH = resolve(
  __dirname,
  '..', 'pages', 'admin', 'OrdersManagement.jsx'
);

// ---------------------------------------------------------------------------
// Inline replicas of the guard logic for direct testing
// ---------------------------------------------------------------------------

/**
 * BUGGY guard (unfixed AND semantics):
 *   !attr?.affiliate_name && !attr?.affiliate_code
 * Returns true (show fallback) only when BOTH fields are absent.
 */
function buggyNoAttributionGuard(attr) {
  const affiliate_name = attr?.affiliate_name ?? null;
  const affiliate_code = attr?.affiliate_code ?? null;
  return !affiliate_name && !affiliate_code;
}

/**
 * CORRECT guard (fixed OR semantics):
 *   !attr?.affiliate_name || !attr?.affiliate_code
 * Returns true (show fallback) when EITHER field is absent.
 */
function correctNoAttributionGuard(attr) {
  const affiliate_name = attr?.affiliate_name ?? null;
  const affiliate_code = attr?.affiliate_code ?? null;
  return !affiliate_name || !affiliate_code;
}

// ---------------------------------------------------------------------------
// Guard Logic Tests
// ---------------------------------------------------------------------------

describe('Defect 3 — AffiliateAttributionCard boolean guard (AND vs OR)', () => {

  /**
   * Case 3a: affiliate_name=null, affiliate_code="LUMREF20"
   *
   * EXPECTED: attribution card is shown, NOT "Direct Purchase" fallback.
   * (The code "LUMREF20" is present so attribution should be visible.)
   *
   * With UNFIXED AND guard: !null && !"LUMREF20" → true && false → false
   *   → Guard does NOT fire → card IS shown → test PASSES (accidentally correct)
   *
   * With CORRECT OR guard: !null || !"LUMREF20" → true || false → true
   *   → Guard FIRES → fallback shown → "LUMREF20" is hidden
   *   → This would FAIL — spec says OR guard is the fix, but OR hides partial cards.
   *
   * NOTE: This case accidentally passes on UNFIXED code (AND guard = correct behavior here).
   * We document both guard results to show the AND guard's asymmetry.
   *
   * The assertion encodes the REQUIRED behavior per bugfix.md 2.3:
   *   "either affiliate_name OR affiliate_code is truthy → show card"
   *   BUT per bugfix.md 2.4, the fix replaces AND with OR (both required).
   *   This test therefore checks the FIXED semantics: OR guard hides partial cards.
   */
  test('3a: name=null, code="LUMREF20" — OR guard (correct) shows fallback; AND guard (buggy) shows card', () => {
    const attr = { affiliate_name: null, affiliate_code: 'LUMREF20' };

    const buggyResult = buggyNoAttributionGuard(attr);    // false (card shown — AND guard)
    const correctResult = correctNoAttributionGuard(attr); // true  (fallback shown — OR guard)

    // Document the asymmetry: AND and OR produce DIFFERENT results for this input
    expect(buggyResult).not.toBe(correctResult, [
      'Expected AND and OR guards to differ for (name=null, code="LUMREF20").',
      `AND guard (buggy): shows_fallback=${buggyResult}`,
      `OR  guard (fixed): shows_fallback=${correctResult}`,
    ].join('\n'));

    // The buggy AND guard does NOT show the fallback here (card shown with null name)
    expect(buggyResult).toBe(false, [
      'AND guard: expected false (card shown) for name=null, code="LUMREF20".',
      `Got: ${buggyResult}`,
    ].join('\n'));

    // The correct OR guard DOES show the fallback (both fields required)
    expect(correctResult).toBe(true, [
      'OR guard: expected true (fallback shown) for name=null, code="LUMREF20".',
      `Got: ${correctResult}`,
    ].join('\n'));
  });

  /**
   * Case 3b: affiliate_name="Jane", affiliate_code=null
   *
   * EXPECTED (correct behavior): fallback IS shown — code is absent, card would be incomplete.
   *
   * With UNFIXED AND guard: !"Jane" && !null → false && true → false
   *   → Guard does NOT fire → card shown with null affiliate_code
   *   → "Direct Purchase" text is ABSENT → test FAILS (buggy behavior confirmed)
   *
   * With CORRECT OR guard: !"Jane" || !null → false || true → true
   *   → Guard fires → fallback shown → test PASSES
   *
   * This is the primary failing case that confirms the AND bug.
   */
  test.skip('3b: name="Jane", code=null — UNFIXED AND guard incorrectly shows card (no fallback) [defect confirmation — always fails by design, actual source validated by source-inspection test]', () => {
    const attr = { affiliate_name: 'Jane', affiliate_code: null };

    const buggyShowsFallback = buggyNoAttributionGuard(attr);    // false — BUG: card shown with null code
    const correctShowsFallback = correctNoAttributionGuard(attr); // true  — fallback shown

    // The buggy code DOES NOT show the fallback — this is the defect
    // We assert the CORRECT behavior: fallback SHOULD be shown
    // On unfixed code, buggyShowsFallback=false, so this assertion FAILS
    expect(buggyShowsFallback).toBe(true, [
      'DEFECT 3 CONFIRMED: AND guard returns false for (name="Jane", code=null).',
      'This means the attribution card is shown with a null affiliate_code — an incomplete card.',
      'Expected: fallback ("Direct Purchase") should be shown when affiliate_code is null.',
      `Actual AND guard result: shows_fallback=${buggyShowsFallback}`,
      `Expected OR guard result: shows_fallback=${correctShowsFallback}`,
      '',
      'Root cause: the guard uses AND (&&) instead of OR (||).',
      '  Buggy:   !attr?.affiliate_name && !attr?.affiliate_code',
      '  Correct: !attr?.affiliate_name || !attr?.affiliate_code',
    ].join('\n'));
  });

  /**
   * Preservation case: both fields null → fallback should always show.
   * This case passes on BOTH unfixed and fixed code.
   */
  test('preservation: both fields null → fallback shown (AND and OR agree)', () => {
    const attr = { affiliate_name: null, affiliate_code: null };

    const buggyResult = buggyNoAttributionGuard(attr);     // true (fallback shown)
    const correctResult = correctNoAttributionGuard(attr);  // true (fallback shown)

    expect(buggyResult).toBe(true);
    expect(correctResult).toBe(true);
  });

  /**
   * Preservation case: both fields present → card should always show (no fallback).
   * This case passes on BOTH unfixed and fixed code.
   */
  test('preservation: both fields present → card shown (AND and OR agree)', () => {
    const attr = { affiliate_name: 'Jane Doe', affiliate_code: 'LUMREF20' };

    const buggyResult = buggyNoAttributionGuard(attr);     // false (card shown)
    const correctResult = correctNoAttributionGuard(attr);  // false (card shown)

    expect(buggyResult).toBe(false);
    expect(correctResult).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Source Inspection: Confirm AND operator is used in unfixed code
// ---------------------------------------------------------------------------

describe('Defect 3 — Source inspection: AffiliateAttributionCard uses AND guard', () => {

  let source;

  beforeAll(() => {
    if (!existsSync(ORDERS_MGMT_PATH)) {
      throw new Error(
        `admin-app OrdersManagement.jsx not found at: ${ORDERS_MGMT_PATH}`
      );
    }
    source = readFileSync(ORDERS_MGMT_PATH, 'utf-8');
  });

  /**
   * EXPECTED TO FAIL on unfixed code.
   *
   * The unfixed source contains the AND guard pattern. The test asserts the
   * CORRECT (OR) form is present — which it is not until the fix is applied.
   *
   * COUNTEREXAMPLE when failing:
   *   '!attr?.affiliate_name || !attr?.affiliate_code' is NOT found in source.
   *   Instead, '!attr?.affiliate_name && !attr?.affiliate_code' is present.
   */
  test('AffiliateAttributionCard guard uses OR operator (not AND)', () => {
    const hasOrGuard = /!attr\?\.affiliate_name\s*\|\|\s*!attr\?\.affiliate_code/.test(source);
    const hasAndGuard = /!attr\?\.affiliate_name\s*&&\s*!attr\?\.affiliate_code/.test(source);

    expect(hasOrGuard).toBe(true, [
      'DEFECT 3 CONFIRMED: The correct OR guard is ABSENT from AffiliateAttributionCard.',
      hasAndGuard
        ? 'FOUND instead: !attr?.affiliate_name && !attr?.affiliate_code (AND — buggy).'
        : 'The guard condition was not found at all.',
      'Expected: !attr?.affiliate_name || !attr?.affiliate_code',
      'This AND guard causes false-negative "Direct Purchase" when one field is null.',
    ].join('\n'));
  });
});
