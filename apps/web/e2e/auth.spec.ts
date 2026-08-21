import { test, expect } from "@playwright/test";

const TEST_EMAIL = "qa@example.com";
const TEST_PASSWORD = "Qa12345!";

test.describe("Auth", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Aniq/);
    await expect(page.getByRole("button", { name: /kirish|login/i })).toBeVisible();
  });

  test("login with valid credentials redirects to dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.getByRole("button", { name: /kirish|login/i }).click();
    await page.waitForURL("**/dashboard", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("login with wrong password stays on /login", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', "WrongPass12345");
    await page.getByRole("button", { name: /kirish|login/i }).click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/login/);
  });
});
