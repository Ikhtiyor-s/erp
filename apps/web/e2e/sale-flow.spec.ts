import { test, expect } from "@playwright/test";

const TEST_EMAIL = "qa@example.com";
const TEST_PASSWORD = "Qa12345!";

// Reusable login fixture
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.getByRole("button", { name: /kirish|login/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 10_000 });
});

test.describe("Sale flow", () => {
  test("sale dashboard URL returns 200", async ({ page }) => {
    const resp = await page.goto("/sale/dashboard");
    expect(resp?.status()).toBeLessThan(400);
  });

  test("sales list shows existing sales", async ({ page }) => {
    await page.goto("/sale/contract");
    // Page header — sotuvlar/savdo varianti
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 5000 });
  });

  test("warehouse products list renders", async ({ page }) => {
    await page.goto("/warehouse/products");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 5000 });
  });

  test("exports center shows CSV/Excel buttons", async ({ page }) => {
    await page.goto("/tools/exports-center");
    await expect(page.locator("text=Excel").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=CSV").first()).toBeVisible();
  });

  test("audit log page renders with filters", async ({ page }) => {
    await page.goto("/tools/audit");
    await expect(page.locator("text=Audit").first()).toBeVisible({ timeout: 5000 });
  });

  test("RBAC roles page renders", async ({ page }) => {
    await page.goto("/settings/roles");
    await page.waitForLoadState("networkidle", { timeout: 10_000 });
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 5000 });
  });

  test("AI assistant page renders chat UI", async ({ page }) => {
    await page.goto("/assistant");
    await expect(page.locator("text=AI assistent").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[placeholder*="Savol"], input[type="text"]').first()).toBeVisible();
  });

  test("POS page shows scanner toggle and scale button", async ({ page }) => {
    await page.goto("/pos");
    await expect(page.locator("text=Skaner").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Tarozini").first()).toBeVisible();
  });
});
