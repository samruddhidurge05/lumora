import { test, expect } from '@playwright/test';
import { getEmailAddress, waitForVerificationEmail } from './utils/mailHelper.js';

test.describe('Affiliate Module E2E Audit', () => {
  let sessionData;

  test('Affiliate Registration & Verification Flow', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes timeout for email fetching and cold starts
    
    // 1. Get temporary email
    sessionData = await getEmailAddress();
    const testEmail = sessionData.email_addr;
    const testPassword = 'TestPassword123!';
    const testName = `QA Affiliate ${Date.now()}`;
    
    console.log(`Using temporary email: ${testEmail}`);

    // 2. Navigate to Affiliate Registration
    await page.goto('/auth/register?role=affiliate');
    await expect(page).toHaveTitle(/Lumora/i);

    // 3. Fill out registration form
    await page.fill('input[id="name"]', testName);
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="phone"]', '9876543210');
    await page.fill('input[id="password"]', testPassword);
    
    // Submit form
    await page.click('button[type="submit"]');

    // 4. Wait for email verification gate
    await page.waitForURL(/\/auth\/verify-email|\/affiliate\/dashboard/);
    const url = page.url();
    
    if (url.includes('/verify-email')) {
      console.log('Registration successful, blocked by email verification. Waiting for email...');
      
      // 5. Fetch verification email from mail.tm
      const verifyLink = await waitForVerificationEmail(sessionData);
      console.log(`Found verification link: ${verifyLink}`);
      
      // 6. Navigate to verification link
      await page.goto(verifyLink);
      await expect(page.locator('text=has been verified')).toBeVisible({ timeout: 15000 });
      console.log('Email successfully verified!');
      
      // 7. Login now that it's verified
      await page.goto('/auth/login?role=affiliate');
      await page.fill('input[id="email"]', testEmail);
      await page.fill('input[id="password"]', testPassword);
      await page.click('button[type="submit"]');
      
      await page.waitForURL(/\/affiliate\/dashboard/, { timeout: 8000 });
      console.log('Successfully reached Affiliate Dashboard after verification!');
    } else {
      console.log('Successfully reached dashboard (no verification required).');
    }
    
    await expect(page.locator('text=Affiliate Dashboard')).toBeVisible();
  });
});
