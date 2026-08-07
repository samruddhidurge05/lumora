import { test, expect } from '@playwright/test';

test.describe('Affiliate Dashboard E2E Audit', () => {
  const TEST_EMAIL = 'apexventurs25@gmail.com';
  const TEST_PASSWORD = '123456';

  test.setTimeout(120000); // Allow enough time for all tabs

  test('Affiliate Login and Full Dashboard Verification', async ({ page }) => {
    // 1. Navigate to Affiliate Login
    console.log('Navigating to affiliate login...');
    await page.goto('/auth/login?role=affiliate', { waitUntil: 'commit' });
    await page.waitForURL('**/auth/login?role=affiliate');

    // 2. Perform Login
    console.log('Performing login...');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    
    // Check "Remember me" just in case
    const rememberMe = page.locator('input[type="checkbox"]');
    if (await rememberMe.isVisible()) {
      await rememberMe.check();
    }

    await page.click('button[type="submit"]');

    // 3. Wait for redirect to Dashboard
    console.log('Waiting for redirect to affiliate dashboard...');
    await expect(page).toHaveURL(/.*#affiliate\/dashboard/, { timeout: 30000 });
    console.log('Successfully logged into the Affiliate Dashboard.');

    // Wait for the Dashboard API to load (it shows 'Overview')
    await expect(page.locator('h1.text-editorial')).toContainText('Overview', { timeout: 15000 });

    // 4. Verify Dashboard Tab
    console.log('Verifying Dashboard tab...');
    // Take a screenshot of the main dashboard
    await page.screenshot({ path: 'test-results/affiliate-dashboard-overview.png' });

    // 5. Navigate to Products Tab
    console.log('Navigating to Products tab...');
    await page.click('button:has-text("Products")');
    await expect(page).toHaveURL(/.*#affiliate\/products/, { timeout: 15000 });
    await expect(page.locator('h1.text-editorial')).toContainText('Products & Links');
    await page.screenshot({ path: 'test-results/affiliate-dashboard-products.png' });

    // 6. Navigate to Analytics Tab
    console.log('Navigating to Analytics tab...');
    await page.click('button:has-text("Analytics")');
    await expect(page).toHaveURL(/.*#affiliate\/analytics/, { timeout: 15000 });
    await expect(page.locator('h1.text-editorial')).toContainText('Analytics');
    await page.screenshot({ path: 'test-results/affiliate-dashboard-analytics.png' });

    // 7. Navigate to Earnings Tab
    console.log('Navigating to Earnings tab...');
    await page.click('button:has-text("Earnings")');
    await expect(page).toHaveURL(/.*#affiliate\/earnings/, { timeout: 15000 });
    await expect(page.locator('h1.text-editorial')).toContainText('Earnings');
    await page.screenshot({ path: 'test-results/affiliate-dashboard-earnings.png' });

    // 8. Navigate to Profile Tab
    console.log('Navigating to Profile tab...');
    await page.click('button:has-text("Profile")');
    await expect(page).toHaveURL(/.*#affiliate\/profile/, { timeout: 15000 });
    await expect(page.locator('h1.text-editorial')).toContainText('Profile');
    await page.screenshot({ path: 'test-results/affiliate-dashboard-profile.png' });

    // 9. Logout
    console.log('Logging out...');
    await page.click('button:has-text("Logout Affiliate")');
    await expect(page).toHaveURL(/.*(auth\/login|\/$|^$)/, { timeout: 15000 });
    
    console.log('Dashboard Audit completed successfully.');
  });
});
