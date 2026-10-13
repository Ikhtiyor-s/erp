import { test, expect } from "@playwright/test";

// POS-3 — cash drawer open button. Real Web Bluetooth pairing/pulse can only
// be verified on a real device (per the ticket); this spec covers what's
// checkable in CI: the button's disabled/tooltip state tracks printer
// connection, without a printer ever being connected.

const PRODUCT = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Test mahsulot",
  sku: "SKU-1",
  sale_price: "15000",
  currency_code: "UZS",
  is_service: false,
  total_stock: "10",
};

async function mockApi(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/warehouse/products**", (route) => route.fulfill({ json: [PRODUCT] }));
  await page.route("**/api/v1/customer/customers**", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/warehouse/warehouses**", (route) =>
    route.fulfill({ json: [{ id: 1, name: "Asosiy ombor" }] })
  );
  await page.route("**/api/v1/finance/cashboxes**", (route) =>
    route.fulfill({ json: [{ id: 1, name: "Asosiy kassa" }] })
  );
  await page.route("**/api/v1/reference/payment-types**", (route) =>
    route.fulfill({ json: [{ id: 1, code: "cash", name: "Naqd", is_cash: true, is_active: true }] })
  );
  await page.route("**/api/v1/settings/organization**", (route) =>
    route.fulfill({ json: { name: "Aniq Do'kon" } })
  );
  await page.route("**/api/v1/settings/key/receipt**", (route) =>
    route.fulfill({ json: { key: "receipt", value: { width_mm: "58", auto_print: false } } })
  );
  await page.route("**/api/v1/settings/print-templates**", (route) => route.fulfill({ json: [] }));
}

test.beforeEach(async ({ page }) => {
  await page.context().addInitScript(() => {
    window.localStorage.setItem("access_token", "fake-token-for-e2e");
    window.localStorage.setItem("org_id", "org-1");
    window.localStorage.setItem("locale", "ru");
  });
});

test.describe("POS cash drawer button (no Web Bluetooth printer connected)", () => {
  test("is disabled with a tooltip explaining the printer must be connected first", async ({ page }) => {
    await mockApi(page);
    await page.goto("/pos");

    const drawerButton = page.getByRole("button", { name: /Qutini ochish/i });
    await expect(drawerButton).toBeVisible();
    await expect(drawerButton).toBeDisabled();
    await expect(drawerButton).toHaveAttribute("title", /printerni ulang/i);
  });
});
