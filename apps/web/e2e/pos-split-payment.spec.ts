import { test, expect, type Route } from "@playwright/test";

// RG-7 — REGOS-style incremental payment panel (desktop + mobile POS
// checkout): amount input + tap-one-payment-method-button commits ONE /pay
// line immediately; repeat until remaining balance hits 0, then "Tasdiqlash"
// becomes enabled. Replaces RG-3's pre-fill-N-boxes + single-confirm model.
// All /api/v1 calls are mocked (same pattern as receipt-print.spec.ts and
// pos-barcode-scan.spec.ts) so this is independent of a live backend.

const PRODUCT = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Split test mahsulot",
  sku: "SKU-SPLIT-1",
  sale_price: "100000",
  currency_code: "UZS",
  is_service: false,
  total_stock: "10",
};

const CUSTOMER = { id: "22222222-2222-2222-2222-222222222222", name: "Aziz Aliyev" };

const PAYMENT_TYPES = [
  { id: 1, code: "cash", name: "Naqd", is_cash: true, is_active: true },
  { id: 2, code: "card", name: "Karta", is_cash: false, is_active: true },
];

function mockPaySequence(page: import("@playwright/test").Page, calls: Record<string, unknown>[]) {
  let paidSoFar = 0;
  const total = 100000;
  page.route("**/api/v1/sale/sales/*/pay", (route) => {
    const body = route.request().postDataJSON() as { amount?: number; redeem_points?: number };
    const amount = Number(body.amount || 0);
    const discount = Number(body.redeem_points || 0);
    paidSoFar += amount + discount;
    calls.push({ kind: "pay", json: body });
    route.fulfill({
      status: 200,
      json: {
        paid_amount: paidSoFar,
        status: paidSoFar >= total ? "paid" : "partial",
        loyalty_redeemed: discount,
        loyalty_earned: 0,
      },
    });
  });
}

async function mockDesktopApi(page: import("@playwright/test").Page, calls: Record<string, unknown>[]) {
  await page.route("**/api/v1/warehouse/products**", (route) => route.fulfill({ json: [PRODUCT] }));
  await page.route("**/api/v1/customer/customers**", (route) => {
    if (route.request().url().includes("/loyalty")) return route.fallback();
    route.fulfill({ json: [CUSTOMER] });
  });
  await page.route("**/api/v1/customer/customers/*/loyalty", (route) =>
    route.fulfill({ json: { balance: 5000, history: [] } })
  );
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

  mockPaySequence(page, calls);

  await page.route("**/api/v1/sale/sales/*", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        json: { head: { id: "sale-1", doc_number: "A-00099", total_amount: 100000, paid_amount: 100000 }, items: [] },
      });
    }
    return route.fallback();
  });
  await page.route("**/api/v1/sale/sales", (route) => {
    if (route.request().method() === "POST") {
      calls.push({ kind: "create", json: route.request().postDataJSON() });
      return route.fulfill({ status: 201, json: { id: "sale-1", total_amount: 100000, paid_amount: 0 } });
    }
    return route.fulfill({ json: [] });
  });
}

test.beforeEach(async ({ page }) => {
  await page.context().addInitScript(() => {
    window.localStorage.setItem("access_token", "fake-token-for-e2e");
    window.localStorage.setItem("org_id", "org-1");
    window.localStorage.setItem("locale", "ru");
  });
});

test.describe("Desktop POS — incremental payment panel (RG-7)", () => {
  test("tap cash for part of the total, then card for the rest: finalize enabled only at zero remaining", async ({ page }) => {
    const calls: Record<string, unknown>[] = [];
    await mockDesktopApi(page, calls);
    await page.goto("/pos");

    await page.getByRole("button", { name: "Split test mahsulot", exact: false }).first().click();
    await expect(page.locator("text=Корзина (1)")).toBeVisible();

    const finalizeBtn = page.getByRole("button", { name: "Tasdiqlash" });
    await expect(finalizeBtn).toBeDisabled();

    await page.getByLabel("To'lov summasi").fill("40000");
    await page.getByRole("button", { name: "Naqd" }).click();
    await expect.poll(() => calls.map((c) => c.kind)).toEqual(["create", "pay"]);
    await expect(finalizeBtn).toBeDisabled();

    // amountInput cleared after a tap; leaving it empty taps the full
    // remaining balance (REGOS "0 = apply full remaining" convention).
    await expect(page.getByLabel("To'lov summasi")).toHaveValue("");
    await page.getByRole("button", { name: "Karta" }).click();
    await expect.poll(() => calls.map((c) => c.kind)).toEqual(["create", "pay", "pay"]);

    const firstPay = calls[1].json as { amount: number; payment_type_id: number };
    const secondPay = calls[2].json as { amount: number; payment_type_id: number };
    expect(firstPay.amount).toBe(40000);
    expect(firstPay.payment_type_id).toBe(1);
    expect(secondPay.amount).toBe(60000);
    expect(secondPay.payment_type_id).toBe(2);

    await expect(finalizeBtn).toBeEnabled();
    await finalizeBtn.click();
    await expect(page.locator("text=Sotuv №A-00099").first()).toBeVisible({ timeout: 5000 });

    // Cart + panel both reset for the next sale.
    await expect(page.locator("text=Корзина (0)")).toBeVisible();
  });

  test("cash overpay: change is shown and the /pay call is clamped to the remaining balance, never the entered amount", async ({ page }) => {
    const calls: Record<string, unknown>[] = [];
    await mockDesktopApi(page, calls);
    await page.goto("/pos");

    await page.getByRole("button", { name: "Split test mahsulot", exact: false }).first().click();

    await page.getByLabel("To'lov summasi").fill("150000");
    await page.getByRole("button", { name: "Naqd" }).click();
    await expect.poll(() => calls.map((c) => c.kind)).toEqual(["create", "pay"]);

    const payBody = calls[1].json as { amount: number };
    expect(payBody.amount).toBe(100000);

    await expect(page.getByText("Qaytim (naqd)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tasdiqlash" })).toBeEnabled();
  });

  test("bonus button only appears once a customer with a positive balance is selected, and redeems via /pay with redeem_points", async ({ page }) => {
    const calls: Record<string, unknown>[] = [];
    await mockDesktopApi(page, calls);
    await page.goto("/pos");

    await page.getByRole("button", { name: "Split test mahsulot", exact: false }).first().click();
    await expect(page.getByRole("button", { name: "Bonus" })).toHaveCount(0);

    await page.locator("select").nth(2).selectOption(CUSTOMER.id);
    await expect(page.getByText("Mijoz ball balansi")).toBeVisible();
    await expect(page.getByRole("button", { name: "Bonus" })).toBeVisible();

    // Entered far above the customer's real balance (5000) — must be capped.
    await page.getByLabel("To'lov summasi").fill("999999");
    await page.getByRole("button", { name: "Bonus" }).click();
    await expect.poll(() => calls.map((c) => c.kind)).toEqual(["create", "pay"]);

    const payBody = calls[1].json as { amount: number; redeem_points: number };
    expect(payBody.amount).toBe(0);
    expect(payBody.redeem_points).toBe(5000);

    // Bonus consumed the full available balance — button disappears, cash/card remain.
    await expect(page.getByRole("button", { name: "Bonus" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Naqd" })).toBeVisible();
  });

  test("cart and warehouse/cashbox/customer selectors lock once the sale is created", async ({ page }) => {
    const calls: Record<string, unknown>[] = [];
    await mockDesktopApi(page, calls);
    await page.goto("/pos");

    await page.getByRole("button", { name: "Split test mahsulot", exact: false }).first().click();
    await page.getByRole("button", { name: "Naqd" }).click();
    await expect.poll(() => calls.map((c) => c.kind)).toEqual(["create", "pay"]);

    await expect(page.locator("select").nth(0)).toBeDisabled();
    await expect(page.locator("select").nth(1)).toBeDisabled();
    await expect(page.locator("select").nth(2)).toBeDisabled();
    await expect(page.getByRole("button", { name: "Split test mahsulot", exact: false }).first()).toBeDisabled();
  });
});

function mockMobileProducts(route: Route) {
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([PRODUCT]) });
}

test.describe("Mobile POS — incremental payment panel (RG-7)", () => {
  test("tap cash for part, then card for the rest: Tasdiqlash enabled only at zero remaining, no bonus button", async ({ page }) => {
    const calls: Record<string, unknown>[] = [];
    await page.route("**/api/v1/warehouse/products**", mockMobileProducts);
    await page.route("**/api/v1/warehouse/warehouses**", (route) => route.fulfill({ json: [] }));
    await page.route("**/api/v1/finance/cashboxes**", (route) =>
      route.fulfill({ json: [{ id: 1, name: "Asosiy kassa", currency_id: 1 }] })
    );
    await page.route("**/api/v1/reference/payment-types**", (route) => route.fulfill({ json: PAYMENT_TYPES }));
    await page.route("**/api/v1/cashbox-sessions/active**", (route) =>
      route.fulfill({ json: { id: "sess-1" } })
    );
    mockPaySequence(page, calls);
    await page.route("**/api/v1/sale/sales", (route) => {
      if (route.request().method() === "POST") {
        calls.push({ kind: "create", json: route.request().postDataJSON() });
        return route.fulfill({ status: 201, json: { id: "sale-1", total_amount: 100000, paid_amount: 0 } });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto("/m/pos");
    await page.locator("text=Split test mahsulot").first().click();
    await page.locator("text=1 ta").first().click();

    await expect(page.getByRole("button", { name: "Bonus" })).toHaveCount(0);

    const confirmBtn = page.getByRole("button", { name: "Tasdiqlash" });
    await expect(confirmBtn).toBeDisabled();

    await page.getByLabel("To'lov summasi").fill("30000");
    await page.getByRole("button", { name: "Naqd" }).click();
    await expect.poll(() => calls.map((c) => c.kind)).toEqual(["create", "pay"]);
    await expect(confirmBtn).toBeDisabled();

    await page.getByRole("button", { name: "Karta" }).click();
    await expect.poll(() => calls.map((c) => c.kind)).toEqual(["create", "pay", "pay"]);

    const firstPay = calls[1].json as { amount: number };
    const secondPay = calls[2].json as { amount: number };
    expect(firstPay.amount).toBe(30000);
    expect(secondPay.amount).toBe(70000);

    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();
    await expect(page.locator("text=Sotuv ro'yxatga olindi!").first()).toBeVisible({ timeout: 5000 });
  });
});
