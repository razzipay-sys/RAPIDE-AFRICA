import { test, expect } from "@playwright/test";

test("booking flow should render and not freeze", async ({ page }) => {
  // Go to login
  await page.goto("/login");

  // Fill credentials (assuming test@example.com / password)
  // Or just bypass if there's a bypass. Let's assume we can login via UI.
  // Actually, we can just inject a session into localStorage.

  // Or just click "Login" if it's already filled
  await page.fill('input[type="email"]', "test@example.com");
  await page.fill('input[type="password"]', "password");
  await page.click('button[type="submit"]');

  // Wait for /app
  await page.waitForURL("**/app");

  // Click the Book tab (third tab)
  await page.click('nav a[href="/app/book"]');

  // Wait for the Book page to load
  await page.waitForSelector("text=Définissez la route", { timeout: 5000 });

  console.log("Booking page rendered successfully without freezing!");
});
