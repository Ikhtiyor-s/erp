import { test, expect } from "@playwright/test";

// POS-6 — Idempotency-Key wiring + synchronous double-click guard on the
// REGOS incremental tap-to-pay flow (POST /sale/sales create, POST
// /sale/sales/{id}/pay per tap). Mocks all /api/v1 calls (same pattern as
// pos-split-payment.spec.ts) so this is independent of a live backend.

const PRODUCT = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Idem test mahsulot",
  sku: "SKU-IDEM-1",
  sale_price: "100000",
  currency_code: "UZS",
  is_service: false,
  total_stock: "10",
};

const PAYMENT_TYPES = [
  { id: 1, code: "cash", name: "Naqd", is_cash: true, is_active: true },
  { id: 2, code: "card", name: "Karta", is_cash: false, is_active: true },
];

async function mockCommon(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/warehouse/products**", (route) => route.fulfill({ json: [PRODUCT] }));
  await page.route("**/api/v1/customer/customers**", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/warehouse/warehouses**", (route) =>
    route.fulfill({ json: [{ id: 1, name: "Asosiy ombor" }] })
  );
  await page.route("**/api/v1/finance/cashboxes**", (route) =>
    route.fulfill({ json: [{ id: 1, name: "Asosiy kassa", currency_id: 1 }] })
  );
  await page.route("**/api/v1/reference/payment-types**", (route) =>
    route.fulfill({ json: PAYMENT_TYPES })
  );
  await page.route("**/api/v1/settings/organization**", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/v1/settings/key/receipt**", (route) =>
    route.fulfill({ json: { key: "receipt", value: {} } })
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

test("rapid double-click on a payment button fires exactly ONE /sale/sales and ONE /pay call", async ({ page }) => {
  const createCalls: string[] = [];
  const payCalls: string[] = [];
  await mockCommon(page);

  await page.route("**/api/v1/sale/sales", (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: [] });
    createCalls.push(route.request().headers()["idempotency-key"] || "");
    route.fulfill({ status: 201, json: { id: "sale-1", total_amount: 100000, paid_amount: 0 } });
  });
  await page.route("**/api/v1/sale/sales/*/pay", (route) => {
    payCalls.push(route.request().headers()["idempotency-key"] || "");
    route.fulfill({ json: { paid_amount: 100000, status: "paid", loyalty_redeemed: 0, loyalty_earned: 0 } });
  });

  await page.goto("/pos");
  await page.getByRole("button", { name: "Idem test mahsulot", exact: false }).first().click();

  const cashBtn = page.getByRole("button", { name: "Naqd" });
  await Promise.all([cashBtn.click(), cashBtn.click()]);
  await expect.poll(() => payCalls.length, { timeout: 5000 }).toBe(1);

  expect(createCalls).toHaveLength(1);
  expect(payCalls).toHaveLength(1);
  expect(createCalls[0]).toMatch(/^[0-9a-f-]{36}$/);
  expect(payCalls[0]).toMatch(/^[0-9a-f-]{36}$/);
});

test("each payment tap sends a FRESH Idempotency-Key, distinct from the create-sale key", async ({ page }) => {
  const createCalls: string[] = [];
  const payCalls: string[] = [];
  await mockCommon(page);

  let paidSoFar = 0;
  const total = 100000;
  await page.route("**/api/v1/sale/sales", (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: [] });
    createCalls.push(route.request().headers()["idempotency-key"] || "");
    route.fulfill({ status: 201, json: { id: "sale-1", total_amount: total, paid_amount: 0 } });
  });
  await page.route("**/api/v1/sale/sales/*/pay", (route) => {
    payCalls.push(route.request().headers()["idempotency-key"] || "");
    const body = route.request().postDataJSON() as { amount?: number };
    paidSoFar += Number(body.amount || 0);
    route.fulfill({
      json: { paid_amount: paidSoFar, status: paidSoFar >= total ? "paid" : "partial", loyalty_redeemed: 0, loyalty_earned: 0 },
    });
  });

  await page.goto("/pos");
  await page.getByRole("button", { name: "Idem test mahsulot", exact: false }).first().click();

  await page.getByLabel("To'lov summasi").fill("40000");
  await page.getByRole("button", { name: "Naqd" }).click();
  await expect.poll(() => payCalls.length).toBe(1);

  await page.getByRole("button", { name: "Karta" }).click();
  await expect.poll(() => payCalls.length).toBe(2);

  expect(createCalls).toHaveLength(1);
  expect(new Set(payCalls).size).toBe(2); // two distinct keys, one per tap
  expect(payCalls[0]).not.toBe(createCalls[0]);
  expect(payCalls[1]).not.toBe(createCalls[0]);
});

test("a network-level failure on /sale/sales retries automatically with the SAME Idempotency-Key", async ({ page }) => {
  const createKeys: string[] = [];
  await mockCommon(page);
  await page.route("**/api/v1/sale/sales/*/pay", (route) =>
    route.fulfill({ json: { paid_amount: 100000, status: "paid", loyalty_redeemed: 0, loyalty_earned: 0 } })
  );

  let attempt = 0;
  await page.route("**/api/v1/sale/sales", (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: [] });
    createKeys.push(route.request().headers()["idempotency-key"] || "");
    attempt += 1;
    if (attempt === 1) return route.abort("failed");
    route.fulfill({ status: 201, json: { id: "sale-1", total_amount: 100000, paid_amount: 0 } });
  });

  await page.goto("/pos");
  await page.getByRole("button", { name: "Idem test mahsulot", exact: false }).first().click();
  await page.getByRole("button", { name: "Naqd" }).click();

  await expect.poll(() => createKeys.length, { timeout: 5000 }).toBe(2);
  expect(createKeys[0]).toBe(createKeys[1]);
});
