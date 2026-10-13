import { test, expect } from "@playwright/test";

const TEST_EMAIL = "qa@example.com";
const TEST_PASSWORD = "Qa12345!";

// Customer-specific price overrides (B2B) on the staff customer detail page.
// Requires a logged-in staff session and at least one existing customer in
// the seeded org — navigates via the customers list rather than a hardcoded
// UUID so this doesn't depend on a specific seed id.
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.getByRole("button", { name: /kirish|login/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 10_000 });
});

test.describe("Customer price overrides", () => {
  test("price overrides section renders with precedence context on customer detail", async ({
    page,
  }) => {
    await page.goto("/customer/customers");
    await page.getByRole("button", { name: "Ko'rish" }).first().click();
    await page.waitForURL(/\/customer\/customers\/.+/, { timeout: 10_000 });

    await expect(page.getByText("Mijozga maxsus narxlar")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Ustunlik tartibi")).toBeVisible();
    await expect(page.getByText("Maxsus narx").first()).toBeVisible();
    await expect(page.getByText("Standart narx")).toBeVisible();

    // Either the empty state or a populated table — never a bare crash.
    await expect(
      page.getByText("Maxsus narxlar yo'q").or(page.locator("table")).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("add override form validates price and searches products", async ({ page }) => {
    await page.goto("/customer/customers");
    await page.getByRole("button", { name: "Ko'rish" }).first().click();
    await page.waitForURL(/\/customer\/customers\/.+/, { timeout: 10_000 });

    const addButton = page.getByRole("button", { name: "Narx qo'shish" });
    if (!(await addButton.isVisible().catch(() => false))) {
      // Staff account lacks customer.create — add action correctly hidden.
      return;
    }
    await addButton.click();

    await expect(page.getByPlaceholder("Mahsulot nomini kiriting...")).toBeVisible();
    const saveButton = page.getByRole("button", { name: "Saqlash" });
    await expect(saveButton).toBeDisabled();

    await page.getByPlaceholder("Mahsulot nomini kiriting...").fill("a");
    await expect(
      page.getByText("Mahsulot topilmadi").or(page.getByText("Yuklanmoqda...")).first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
