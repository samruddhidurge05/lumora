const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER_PAGE_ERROR:', error.message));
  page.on('requestfailed', request => console.log('BROWSER_REQ_FAILED:', request.url(), request.failure()?.errorText));
  
  try {
    await page.goto('http://localhost:5173/auth/register?role=customer');
    console.log('Navigated to register page');
    
    await page.fill('input[id="name"]', 'Test User');
    const testEmail = 'test_' + Date.now() + '@example.com';
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="password"]', 'Password123');
    
    console.log('Filled form with:', testEmail);
    
    await page.click('button[type="submit"]');
    console.log('Clicked submit button');
    
    // Wait to see what happens
    await page.waitForTimeout(6000);
    
    console.log('CURRENT_URL:', page.url());
  } catch (err) {
    console.error('TEST SCRIPT ERROR:', err);
  } finally {
    await browser.close();
  }
})();
