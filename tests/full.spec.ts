import { test, expect } from '@playwright/test';

const ROUTES_TO_TEST = [
  '/',
  '/login',
  '/signup',
  '/rider-signup',
  '/app',
  '/app/book',
  '/app/errand',
  '/app/wallet',
  '/app/verification',
  '/app/escrow',
  '/rider',
  '/rider/dispatch',
  '/rider/documents',
  '/admin',
  '/admin/users',
  '/admin/drivers',
  '/merchant',
  '/merchant/bulk'
];

test.describe('Full Application Rendering Check', () => {
  for (const route of ROUTES_TO_TEST) {
    test(`Route should render and not freeze: ${route}`, async ({ page }) => {
      // Navigate to the route
      await page.goto(route);
      
      // Give the page some time to run React lifecycles and potentially redirect
      await page.waitForTimeout(2000);
      
      const currentUrl = new URL(page.url()).pathname;
      
      // If the app freezes, the test will timeout before reaching this point.
      // We check that the body is visible to ensure React rendered something.
      await expect(page.locator('body')).toBeVisible();
      
      // If there's an infinite loop, the page will crash or time out.
      // By completing this block, we know the page is stable!
      console.log(`✅ [${route}] Stable. Rendered or safely redirected to: ${currentUrl}`);
    });
  }
});
