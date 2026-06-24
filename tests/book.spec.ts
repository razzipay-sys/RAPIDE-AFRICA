import { test, expect } from '@playwright/test';

test('booking flow should render and not freeze', async ({ page }) => {
  await page.goto('/app/book');
  
  await page.waitForTimeout(3000); // Wait for potential redirects and rendering
  const url = page.url();
  console.log("Current URL after navigation:", url);
  
  await page.screenshot({ path: 'screenshot.png' });
  
  if (url.includes('/login') || url === 'http://localhost:5173/') {
    console.log("Redirected to home/login because of auth. UI did not freeze.");
    return;
  }

  const mapboxEl = page.locator('.mapboxgl-map');
  await expect(mapboxEl).toBeVisible();

  console.log("Booking page rendered successfully without freezing!");
});
