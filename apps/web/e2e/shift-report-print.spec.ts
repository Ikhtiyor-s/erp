import { test, expect } from "@playwright/test";

// RG-1 — internal cash-control shift X/Z report print wiring. All /api/v1
// calls are mocked, same pattern as e2e/receipt-print.spec.ts (POS-2). This
// spec runs with no Web Bluetooth API present (headless Chromium default),
// exercising the "printer not connected" graceful-degradation path.

const ACTIVE_SESSION = {
  id: "11111111-1111-1111-1111-111111111111",
  cashbox_id: 1,
  cashbox_name: "Asosiy kassa",
  opened_at: "2026-10-12T08:00:00Z",
  opened_balance: "100000",
  opened_diff: "0",
  opened_by_name: "Aziz",
  status: "open",
};

const CLOSED_SESSION = {
  id: "22222222-2222-2222-2222-222222222222",
  cashbox_id: 1,
  cashbox_name: "Asosiy kassa",
  opened_at: "2026-10-11T08:00:00Z",
  opened_balance: "50000",
  opened_diff: "0",
  opened_by_name: "Aziz",
  closed_at: "2026-10-11T20:00:00Z",
  closed_balance: "480000",
  closed_diff: "-2000",
  closed_by_name: "Aziz",
  total_income: "450000",
  total_expense: "20000",
  sale_count: 12,
  status: "closed",
};

const TOTALS = {
  total_income: 450000,
  total_expense: 20000,
  sale_count: 12,
  by_payment_type: [
    { payment_type: "Naqd", direction: "in", total: 300000 },
    { payment_type: "Karta", direction: "in", total: 150000 },
  ],
};

async function mockApi(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/finance/cashboxes**", (route) =>
    route.fulfill({ json: [{ id: 1, name: "Asosiy kassa" }] })
  );
  await page.route("**/api/v1/cashbox-sessions/active**", (route) =>
    route.fulfill({ json: ACTIVE_SESSION })
  );
  await page.route("**/api/v1/cashbox-sessions/*/totals", (route) =>
    route.fulfill({ json: TOTALS })
  );
  await page.route("**/api/v1/cashbox-sessions?*", (route) =>
    route.fulfill({ json: [ACTIVE_SESSION, CLOSED_SESSION] })
  );
}

test.beforeEach(async ({ page }) => {
  await page.context().addInitScript(() => {
    window.localStorage.setItem("access_token", "fake-token-for-e2e");
    window.localStorage.setItem("org_id", "org-1");
    window.localStorage.setItem("locale", "ru");
  });
});

test.describe("Cashbox session X/Z shift report printing (no Web Bluetooth)", () => {
  test("active session: shows X-hisobot button; printing without a connected printer shows a clear error toast, no crash", async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto("/finance/cashbox-sessions");

    await expect(page.getByRole("button", { name: /Printerni ulash/i })).toBeVisible();

    const printButton = page.getByRole("button", { name: "X-hisobot", exact: true });
    await expect(printButton).toBeVisible();
    await printButton.click();

    await expect(page.locator("text=Printer ulanmagan")).toBeVisible();
    // Page must still be responsive after the error — not crashed.
    await expect(printButton).toBeVisible();
  });

  test("closed session row: print icon triggers the same graceful error, never a crash", async ({ page }) => {
    await mockApi(page);
    await page.goto("/finance/cashbox-sessions");

    const rowPrintButton = page.getByRole("button", { name: "Z-hisobotni chop etish" });
    await expect(rowPrintButton).toBeVisible();
    await rowPrintButton.click();

    await expect(page.locator("text=Printer ulanmagan")).toBeVisible();
  });

  test("connecting the printer without Web Bluetooth support shows a clear unsupported-browser error", async ({ page }) => {
    await mockApi(page);
    await page.goto("/finance/cashbox-sessions");

    await page.getByRole("button", { name: /Printerni ulash/i }).click();
    await expect(page.locator("text=Web Bluetooth")).toBeVisible();
  });
});
