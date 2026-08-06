import { test, expect } from '@playwright/test';

test.describe('Affiliate Module - Referral Flow Audit', () => {
  const AFFILIATE_CODE = 'AFF0004';
  const PRODUCT_ID = '1';

  test('Affiliate Referral Link - Product Direct', async ({ page }) => {
    // 1. Visit the affiliate link
    const referralUrl = `/ref/${AFFILIATE_CODE}/product/${PRODUCT_ID}`;
    console.log(`Navigating to affiliate link: ${referralUrl}`);
    await page.goto(referralUrl, { waitUntil: 'commit' });

    // 2. Wait for redirect to product page
    await page.waitForURL(`**/#product/${PRODUCT_ID}**`, { timeout: 15000 });

    // 3. Check if referral tracking data is stored in sessionStorage/localStorage
    const trackingData = await page.evaluate(() => {
      return {
        pendingRef: localStorage.getItem('lumora_pending_referral'),
        affRef: sessionStorage.getItem('lumora_aff_ref'),
        refSession: sessionStorage.getItem('lumora_ref_session_id')
      };
    });
    
    console.log('Referral Tracking Data:', trackingData);

    // Assert that SOME form of referral tracking is present in storage
    expect(trackingData.pendingRef).toBeTruthy();
    
    // Verify the URL
    const currentUrl = page.url();
    expect(currentUrl).toContain(`#product/${PRODUCT_ID}`);
    
    // Take a screenshot of the tracking state
    await page.screenshot({ path: `test-results/product-referral-success.png` });
  });

  test('Affiliate Referral Link - Generic Direct', async ({ page }) => {
    // Visit a generic affiliate link
    const genericRefUrl = `/ref/${AFFILIATE_CODE}`;
    await page.goto(genericRefUrl, { waitUntil: 'commit' });
    
    // Generic referral links usually redirect to the homepage or login page
    await page.waitForURL(/\/(auth\/login|#)/, { timeout: 15000 });

    const trackingData = await page.evaluate(() => {
      return {
        affRef: sessionStorage.getItem('lumora_aff_ref'),
        refSession: sessionStorage.getItem('lumora_ref_session_id')
      };
    });

    console.log('Generic Referral Tracking Data:', trackingData);
    
    // Assert that the generic affiliate ref is stored in sessionStorage
    expect(trackingData.affRef).toBe(AFFILIATE_CODE);
  });
});
