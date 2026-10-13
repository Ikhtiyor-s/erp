import { test, expect } from "@playwright/test";

// B2C storefront (/shop) — public, anonymous route group.
// These are smoke tests that don't assume seeded products/org data exist
// (unlike customer-portal.spec.ts, which relies on a known seeded phone
// number) — they only assert the public pages render their required
// loading/empty/error states without crashing and without requiring login.
// A full add-to-cart -> checkout -> confirmation run needs a live backend
// with an org that has `online_warehouse_id` configured and at least one
// `is_published_online` product; that's exercised manually per the ticket
// ("Done means") rather than asserted here.

test.describe("B2C storefront (/shop)", () => {
  test("catalog loads with no login required", async ({ page }) => {
    await page.goto("/shop");
    await expect(page).toHaveURL(/\/shop$/);
    await expect(page.getByRole("heading", { name: "Mahsulotlar" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder("Mahsulot qidirish...")).toBeVisible();
  });

  test("cart link is reachable from the catalog header", async ({ page }) => {
    await page.goto("/shop");
    await page.getByRole("link", { name: /Savat/i }).click();
    await expect(page).toHaveURL(/\/shop\/cart$/);
  });

  test("empty cart shows an honest empty state, not an error", async ({ page }) => {
    await page.goto("/shop/cart");
    await expect(page.getByText("Savat bo'sh")).toBeVisible();
    await expect(page.getByRole("button", { name: "Katalogga qaytish" })).toBeVisible();
  });

  test("checkout with an empty cart does not crash", async ({ page }) => {
    await page.goto("/shop/checkout");
    await expect(page.getByText("Savat bo'sh")).toBeVisible();
  });

  test("order confirmation without query params degrades gracefully", async ({ page }) => {
    await page.goto("/shop/order/SF-TEST-0001");
    await expect(page.getByText("Buyurtma qabul qilindi")).toBeVisible();
    await expect(
      page.getByText("Buyurtmangiz qabul qilindi. Tafsilotlar uchun operator bilan bog'laning."),
    ).toBeVisible();
  });

  test("order confirmation renders details carried via query params", async ({ page }) => {
    // The path segment is `sale_id` (checkout now redirects with sale_id, not
    // order_number, so GET /shop/order/{sale_id} can resolve a bare reload) —
    // a syntactically-valid but non-existent UUID here, so the lookup 404s
    // and the page falls back to rendering the query-param details below,
    // which now carry `order_number` as its own param instead of the path.
    await page.goto(
      "/shop/order/00000000-0000-0000-0000-00000000dead?order_number=SF-2026-00042&total=36000&mode=manual&provider=",
    );
    await expect(page.getByText("№ SF-2026-00042")).toBeVisible();
    await expect(page.getByText("36 000")).toBeVisible();
    await expect(
      page.getByText("To'lov keyinroq yoki yetkazib berishda amalga oshiriladi"),
    ).toBeVisible();
  });

  test("direct product-detail deep link without data degrades gracefully", async ({ page }) => {
    await page.goto("/shop/00000000-0000-0000-0000-000000000000");
    await expect(
      page.getByText(/Mahsulot topilmadi|Do'kon vaqtincha yopiq|Tarmoq xatosi/),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("core flow renders on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/shop");
    await expect(page.getByRole("heading", { name: "Mahsulotlar" })).toBeVisible({ timeout: 10_000 });
    await page.goto("/shop/cart");
    await expect(page.getByText("Savat bo'sh")).toBeVisible();
    await page.goto("/shop/checkout");
    await expect(page.getByText("Savat bo'sh")).toBeVisible();
  });
});
