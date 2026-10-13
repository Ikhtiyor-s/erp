import { test, expect } from "@playwright/test";

// POS-2 — checkout() print wiring. All /api/v1 calls are mocked so this spec
// is independent of a live backend/DB and of login state (dashboard layout
// only gates on localStorage.access_token, checked client-side).

const PRODUCT = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Test mahsulot",
  sku: "SKU-1",
  sale_price: "15000",
  currency_code: "UZS",
  is_service: false,
  total_stock: "10",
};

const PAYMENT_TYPES = [{ id: 1, code: "cash", name: "Naqd", is_cash: true, is_active: true }];

async function mockApi(page: import("@playwright/test").Page, opts?: { template?: string | null }) {
  await page.route("**/api/v1/warehouse/products**", (route) =>
    route.fulfill({ json: [PRODUCT] })
  );
  await page.route("**/api/v1/customer/customers**", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/warehouse/warehouses**", (route) =>
    route.fulfill({ json: [{ id: 1, name: "Asosiy ombor" }] })
  );
  await page.route("**/api/v1/finance/cashboxes**", (route) =>
    route.fulfill({ json: [{ id: 1, name: "Asosiy kassa" }] })
  );
  await page.route("**/api/v1/reference/payment-types**", (route) =>
    route.fulfill({ json: PAYMENT_TYPES })
  );
  await page.route("**/api/v1/sale/sales/*/pay", (route) =>
    route.fulfill({ status: 200, json: { paid_amount: 15000, status: "paid", loyalty_redeemed: 0, loyalty_earned: 0 } })
  );
  await page.route("**/api/v1/settings/organization**", (route) =>
    route.fulfill({
      json: { name: "Aniq Do'kon", address: "Toshkent, Amir Temur 1", phone: "+998901234567" },
    })
  );
  await page.route("**/api/v1/settings/key/receipt**", (route) =>
    route.fulfill({
      json: { key: "receipt", value: { width_mm: "58", auto_print: false, footer: "Xaridingiz uchun rahmat!" } },
    })
  );
  const hasTemplate = opts?.template !== null;
  await page.route("**/api/v1/settings/print-templates/*", (route) =>
    route.fulfill({ json: { id: 1, kind: "receipt", body: opts?.template } })
  );
  await page.route("**/api/v1/settings/print-templates", (route) =>
    route.fulfill({
      json: hasTemplate
        ? [{ id: 1, kind: "receipt", name: "Standart", is_default: true, is_active: true }]
        : [],
    })
  );
  await page.route("**/api/v1/sale/sales/*", (route) =>
    route.fulfill({
      json: {
        head: { id: "sale-1", doc_number: "A-00042", total_amount: 15000, paid_amount: 15000 },
        items: [],
      },
    })
  );
  await page.route("**/api/v1/sale/sales", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({ status: 201, json: { id: "sale-1", total_amount: 15000 } });
    }
    return route.fulfill({ json: [] });
  });
}

test.beforeEach(async ({ page }) => {
  // Applies to the page AND any popup windows it opens (context-level).
  // window.print/close are stubbed so the HTML fallback's auto-print-then-close
  // (same pattern as components/barcode/label-print.tsx) doesn't tear the popup
  // down before this test can inspect its rendered content.
  await page.context().addInitScript(() => {
    window.localStorage.setItem("access_token", "fake-token-for-e2e");
    window.localStorage.setItem("org_id", "org-1");
    window.localStorage.setItem("locale", "ru");
    window.print = () => {};
    window.close = () => {};
  });
});

test.describe("POS checkout receipt printing (HTML fallback — no Web Bluetooth)", () => {
  test("no printer connected: shows print button and HTML fallback renders filled placeholders with correct @page size", async ({
    page,
  }) => {
    await mockApi(page, { template: "{org_name}\n{org_address}\nChek: {doc_number}\n{items}\nJAMI: {total} {currency}\n{footer}" });
    await page.goto("/pos");

    await expect(page.getByRole("button", { name: /Printerni ulash/i })).toBeVisible();

    await page.getByRole("button", { name: "Test mahsulot", exact: false }).first().click();
    await expect(page.locator("text=Корзина (1)")).toBeVisible();

    const createPromise = page.waitForResponse("**/api/v1/sale/sales");
    await page.getByRole("button", { name: "Naqd" }).click();
    await createPromise;
    await expect(page.getByRole("button", { name: "Tasdiqlash" })).toBeEnabled();
    await page.getByRole("button", { name: "Tasdiqlash" }).click();

    await expect(page.locator("text=Sotuv №A-00042").first()).toBeVisible({ timeout: 5000 });

    const printButton = page.getByRole("button", { name: /Chekni chop etish/i });
    await expect(printButton).toBeVisible();

    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      printButton.click(),
    ]);
    await popup.waitForLoadState();

    const html = await popup.content();
    expect(html).toContain("Aniq Do'kon");
    expect(html).toContain("Toshkent, Amir Temur 1");
    expect(html).toContain("A-00042");
    expect(html).toContain("Test mahsulot");
    expect(html).toContain("Xaridingiz uchun rahmat!");
    expect(html).toMatch(/size:\s*58mm auto/);
  });

  test("no template configured: built-in default is used, still fills real data", async ({ page }) => {
    await mockApi(page, { template: null });
    await page.goto("/pos");

    await page.getByRole("button", { name: "Test mahsulot", exact: false }).first().click();
    const createPromise = page.waitForResponse("**/api/v1/sale/sales");
    await page.getByRole("button", { name: "Naqd" }).click();
    await createPromise;
    await page.getByRole("button", { name: "Tasdiqlash" }).click();

    const printButton = page.getByRole("button", { name: /Chekni chop etish/i });
    await expect(printButton).toBeVisible();

    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      printButton.click(),
    ]);
    await popup.waitForLoadState();
    const html = await popup.content();
    expect(html).toContain("A-00042");
    expect(html).toContain("Test mahsulot");
    expect(html).toContain("JAMI");
  });

  test("sale POST failure does not crash the page and does not show a print button", async ({ page }) => {
    await mockApi(page);
    await page.unroute("**/api/v1/sale/sales");
    await page.route("**/api/v1/sale/sales", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({ status: 500, json: { detail: "Server xatosi" } });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto("/pos");

    await page.getByRole("button", { name: "Test mahsulot", exact: false }).first().click();
    await page.getByRole("button", { name: "Naqd" }).click();

    await expect(page.locator("text=Server xatosi").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Chekni chop etish/i })).toHaveCount(0);
  });
});
