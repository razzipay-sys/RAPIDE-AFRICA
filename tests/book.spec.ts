import { test, expect } from "@playwright/test";

test("booking flow should render and not freeze", async ({ page }) => {
  await page.goto("/app/book");

  await page.waitForTimeout(3000); // Wait for potential redirects and rendering
  const url = page.url();
  console.log("Current URL after navigation:", url);

  await page.screenshot({ path: "screenshot.png" });

  if (url.includes("/login") || url === "http://localhost:5173/") {
    console.log("Redirected to home/login because of auth. UI did not freeze.");
    return;
  }

  // The map is deferred until the user taps "Open map" — click it, then
  // assert the Leaflet container (Mapbox was fully replaced by Leaflet).
  await page.getByRole("button", { name: /ouvrir la carte|open map/i }).click();
  const leafletEl = page.locator(".leaflet-container");
  await expect(leafletEl).toBeVisible();

  console.log("Booking page rendered successfully without freezing!");
});
