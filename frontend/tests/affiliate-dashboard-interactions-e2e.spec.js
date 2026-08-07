import { test, expect } from '@playwright/test';

test.describe('Affiliate Dashboard Comprehensive Interactions E2E', () => {
  const TEST_EMAIL = 'apexventurs25@gmail.com';
  const TEST_PASSWORD = '123456';

  test.setTimeout(180000); // 3 minutes for comprehensive interactions

  test('Complete Affiliate Journey and Interactions', async ({ page, context }) => {
    // 1. Navigate to Affiliate Login
    console.log('Navigating to affiliate login...');
    await page.goto('/auth/login?role=affiliate', { waitUntil: 'commit' });
    await page.waitForURL('**/auth/login?role=affiliate');

    // 2. Perform Login
    console.log('Performing login...');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for Dashboard to load
    console.log('Waiting for Dashboard...');
    await expect(page).toHaveURL(/.*#affiliate\/dashboard/, { timeout: 30000 });
    await expect(page.locator('h1.text-editorial')).toContainText('Overview', { timeout: 15000 });
    
    // Grant clipboard permissions to test Copy Link functionality
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // ----------------------------------------------------------------------
    // 3. DASHBOARD TAB INTERACTIONS
    // ----------------------------------------------------------------------
    console.log('Testing Dashboard interactions...');
    
    // Copy main referral link
    const copyLinkBtn = page.locator('button:has-text("Copy Link")').first();
    await expect(copyLinkBtn).toBeVisible();
    await copyLinkBtn.click();
    await expect(page.locator('button:has-text("Copied!")')).toBeVisible({ timeout: 5000 });
    
    // Verify clipboard content contains the domain or "ref/"
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('ref/');

    // Click "Get Links" button inside the Hero banner
    await page.click('button:has-text("Get Links")');
    await expect(page).toHaveURL(/.*#affiliate\/products/, { timeout: 15000 });
    
    // ----------------------------------------------------------------------
    // 4. PRODUCTS TAB INTERACTIONS
    // ----------------------------------------------------------------------
    console.log('Testing Products interactions...');
    await expect(page.locator('h1.text-editorial')).toContainText('Products & Links');
    
    // Search for a non-existent product
    const searchInput = page.locator('input[placeholder="Search products…"]');
    await searchInput.fill('ZZZZZ_NON_EXISTENT_PRODUCT_123');
    await expect(page.locator('h3', { hasText: 'No products found' })).toBeVisible({ timeout: 10000 });
    
    // Clear search and use category filter
    await searchInput.fill('');
    await page.click('button:has-text("All")');
    
    // Wait for products to load, or empty state
    await page.waitForTimeout(2000); // brief wait for React state to settle
    
    // Reset to "All" category
    await page.click('button:has-text("All")');
    await page.waitForTimeout(2000);
    
    // Interact with the first product card if available
    const firstProductCard = page.locator('.glass-card:has(h3)').first();
    if (await firstProductCard.isVisible()) {
      console.log('Product card found. Testing product actions...');
      
      // Copy product-specific link
      const productCopyBtn = firstProductCard.locator('button:has-text("Copy Link")');
      await productCopyBtn.click();
      await expect(firstProductCard.locator('button:has-text("Copied!")')).toBeVisible({ timeout: 5000 });
      
      const prodClipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(prodClipboardText).toContain('product/');

      // Add to wishlist
      const wishlistBtn = firstProductCard.locator('button[title="Add to wishlist"], button[title="Remove from wishlist"]');
      await wishlistBtn.click();
      
      // Open Wishlist drawer
      await page.click('button:has-text("Wishlist")');
      const drawer = page.locator('text=/My Wishlist/');
      await expect(drawer).toBeVisible({ timeout: 5000 });
      
      // Close drawer (click outside)
      await page.mouse.click(50, 50);
      await expect(drawer).not.toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(1000); // Wait for drawer closing animation to finish

      // View Details
      await page.locator('button:has-text("Details")').first().click();
      // Should open product detail view
      await expect(page.locator('h1.text-editorial').first()).toBeVisible({ timeout: 10000 });
      
      // Click Back button inside details view
      await page.click('button:has-text("Back")');
      await expect(page.locator('h1.text-editorial')).toContainText('Products & Links', { timeout: 10000 });
    } else {
      console.log('No products available to test product card interactions.');
    }

    // ----------------------------------------------------------------------
    // 5. EARNINGS TAB INTERACTIONS
    // ----------------------------------------------------------------------
    console.log('Testing Earnings interactions...');
    await page.click('nav button:has-text("Earnings")');
    await expect(page).toHaveURL(/.*#affiliate\/earnings/, { timeout: 15000 });
    
    // Test the commission log filters
    const filterApproved = page.locator('.aff-filter-tabs button:has-text("approved")');
    if (await filterApproved.isVisible()) {
      await filterApproved.click();
      // Verify filter applies (just checking it doesn't crash)
      await page.waitForTimeout(1000);
      
      const filterAll = page.locator('.aff-filter-tabs button:has-text("all")');
      await filterAll.click();
    }
    
    // Open Withdrawal Modal
    const withdrawBtn = page.locator('button:has-text("Request Withdrawal")');
    if (await withdrawBtn.isVisible()) {
      await withdrawBtn.click();
      const modalText = page.locator('h3:has-text("Request Payout")');
      await expect(modalText).toBeVisible({ timeout: 5000 });
      
      // Close Modal
      await page.keyboard.press('Escape');
      await expect(modalText).not.toBeVisible({ timeout: 5000 });
    }

    // ----------------------------------------------------------------------
    // 6. PROFILE TAB INTERACTIONS
    // ----------------------------------------------------------------------
    console.log('Testing Profile interactions...');
    await page.click('nav button:has-text("Profile")');
    await expect(page).toHaveURL(/.*#affiliate\/profile/, { timeout: 15000 });
    await expect(page.locator('h1.text-editorial')).toContainText('Profile');

    // ----------------------------------------------------------------------
    // 7. LOGOUT
    // ----------------------------------------------------------------------
    console.log('Logging out...');
    await page.click('button:has-text("Logout Affiliate")');
    await expect(page).toHaveURL(/.*(auth\/login|\/$|^$)/, { timeout: 15000 });
    
    console.log('Comprehensive Interactions Audit completed successfully.');
  });
});
