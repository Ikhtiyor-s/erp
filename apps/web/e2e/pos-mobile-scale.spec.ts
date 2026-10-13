import { test, expect } from "@playwright/test";

const TEST_EMAIL = "qa@example.com";
const TEST_PASSWORD = "Qa12345!";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.getByRole("button", { name: /kirish|login/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 10_000 });
});

// Headless Chromium (and most real-world desktop/dev browsers) has no Web
// Bluetooth adapter wired up, so `navigator.bluetooth` is absent by default —
// this is the realistic "unsupported browser" case the mobile scale button
// must degrade gracefully against, without a real Bluetooth scale.
test.describe("Mobile POS scale — Web Bluetooth graceful degradation (POS-4)", () => {
  test("connect-scale button renders on /m/pos", async ({ page }) => {
    await page.goto("/m/pos");
    await expect(page.getByRole("button", { name: "Tarozini ulash" })).toBeVisible({ timeout: 10_000 });
  });

  test("Web Bluetooth is absent in this environment (precondition for the next test)", async ({ page }) => {
    await page.goto("/m/pos");
    const hasBluetooth = await page.evaluate(() => "bluetooth" in navigator);
    expect(hasBluetooth).toBe(false);
  });

  test("clicking connect without Web Bluetooth support shows a clear error instead of crashing", async ({ page }) => {
    await page.goto("/m/pos");
    const connectBtn = page.getByRole("button", { name: "Tarozini ulash" });
    await expect(connectBtn).toBeVisible({ timeout: 10_000 });

    await connectBtn.click();

    await expect(page.locator("text=Web Bluetooth qo'llab-quvvatlamaydi")).toBeVisible({ timeout: 5_000 });

    // Page stayed interactive — no unhandled-exception overlay, connect button
    // is still present (not stuck in a "connected" state), and unrelated UI
    // (search input) still works.
    await expect(connectBtn).toBeVisible();
    await expect(page.locator("text=Tarozi:")).toHaveCount(0);
    await expect(page.getByPlaceholder("Qidirish...")).toBeEditable();
  });
});
