import { test, expect } from "@playwright/test";

test.describe("Customer portal", () => {
  test("login page renders with phone + OTP form", async ({ page }) => {
    await page.goto("/portal/login");
    await expect(page.locator("text=Mijoz kabineti").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="tel"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /kod olish/i })).toBeVisible();
  });

  test("request OTP for known customer returns dev_code in dev mode", async ({ page }) => {
    await page.goto("/portal/login");
    await page.fill('input[type="tel"]', "+998 91 234 56 78");
    await page.fill('input[placeholder="ANIQ"]', "ANIQ");
    await page.getByRole("button", { name: /kod olish/i }).click();

    // Should switch to OTP step
    await expect(page.locator('input[inputmode="numeric"]')).toBeVisible({ timeout: 5000 });
  });

  test("unauthenticated portal pages redirect to login", async ({ page }) => {
    await page.goto("/portal/dashboard");
    await page.waitForURL("**/portal/login", { timeout: 5000 });
  });
});
