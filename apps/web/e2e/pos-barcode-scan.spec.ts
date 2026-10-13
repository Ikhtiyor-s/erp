import { test, expect, type Route } from "@playwright/test";

// POS-1: HID scanner cannot be attached here, so fast sequential keystrokes +
// Enter (Playwright's pressSequentially, real trusted bubbling CDP key events)
// simulate one. Backend is mocked via route interception instead of the
// shared dev stack so this doesn't depend on/interfere with other agents'
// concurrent work. The dashboard layout only checks localStorage.access_token,
// so that's seeded directly instead of exercising the full login flow.

const SCANNED_SKU = "SKU-POS1-9players";
const SCANNED_NAME = "POS-1 Test mahsuloti";

function mockProducts(route: Route) {
  const q = new URL(route.request().url()).searchParams.get("q") || "";
  const matches =
    q === SCANNED_SKU
      ? [
          {
            id: "11111111-1111-1111-1111-111111111111",
            name: SCANNED_NAME,
            sku: SCANNED_SKU,
            sale_price: "10000",
            currency_code: "UZS",
            is_service: false,
            total_stock: "5",
          },
        ]
      : [];
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(matches) });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "e2e-fake-token-pos1");
  });
  for (const path of ["**/customer/customers**", "**/warehouse/warehouses**", "**/finance/cashboxes**"]) {
    await page.route(path, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );
  }
});

test.describe("POS barcode scanner / search input conflict (POS-1)", () => {
  test("fast scan while search input is focused: one product added to cart, input cleared, one request fired", async ({ page }) => {
    const productRequests: string[] = [];
    await page.route("**/warehouse/products**", (route) => {
      productRequests.push(route.request().url());
      mockProducts(route);
    });

    await page.goto("/pos");
    const searchInput = page.getByPlaceholder("Mahsulot qidirish (nom, shtrix-kod)...");
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.click();

    productRequests.length = 0;

    // useBarcodeScanner's gap heuristic is 50ms — stay well under it.
    await searchInput.pressSequentially(SCANNED_SKU, { delay: 5 });
    await page.keyboard.press("Enter");

    await expect(page.locator(`text=${SCANNED_NAME}`).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("text=Корзина (1)")).toBeVisible({ timeout: 5_000 });
    await expect(searchInput).toHaveValue("");

    await page.waitForTimeout(500);

    const fullScanRequests = productRequests.filter((u) => u.includes(`q=${encodeURIComponent(SCANNED_SKU)}`));
    expect(fullScanRequests.length).toBe(1);

    const partialPrefixRequests = productRequests.filter((u) => {
      const m = u.match(/[?&]q=([^&]*)/);
      if (!m) return false;
      const qVal = decodeURIComponent(m[1]);
      return qVal.length > 0 && qVal.length < SCANNED_SKU.length && SCANNED_SKU.startsWith(qVal);
    });
    expect(partialPrefixRequests.length).toBe(0);
    expect(productRequests.length).toBeLessThanOrEqual(2);
  });

  test("manual typing in the search box still debounces to one request (no regression)", async ({ page }) => {
    const productRequests: string[] = [];
    await page.route("**/warehouse/products**", (route) => {
      productRequests.push(route.request().url());
      mockProducts(route);
    });

    await page.goto("/pos");
    const searchInput = page.getByPlaceholder("Mahsulot qidirish (nom, shtrix-kod)...");
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    productRequests.length = 0;

    // Above the 50ms scanner heuristic — must be treated as ordinary typing.
    await searchInput.pressSequentially("abc", { delay: 150 });
    await page.waitForTimeout(500);

    expect(productRequests.filter((u) => u.includes("q=abc")).length).toBe(1);
    await expect(searchInput).toHaveValue("abc");
  });

  test("scanning while the search input is NOT focused still works (unchanged)", async ({ page }) => {
    await page.route("**/warehouse/products**", mockProducts);

    await page.goto("/pos");
    const searchInput = page.getByPlaceholder("Mahsulot qidirish (nom, shtrix-kod)...");
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Skaner/i }).focus();
    // Let useBarcodeScanner's effect actually attach its window listener
    // before dispatching — DOM visibility can win the race against React's
    // post-commit effect flush.
    await page.waitForTimeout(150);

    // Dispatched synchronously in-page so gaps stay near 0ms (CDP round-trip
    // per keystroke via page.keyboard.type is too slow under system load and
    // flakes against useBarcodeScanner's 50ms heuristic — pre-existing code,
    // unrelated to this fix).
    await page.evaluate((sku) => {
      for (const ch of sku) window.dispatchEvent(new KeyboardEvent("keydown", { key: ch, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }, SCANNED_SKU);

    await expect(page.locator(`text=${SCANNED_NAME}`).first()).toBeVisible({ timeout: 5_000 });
    await expect(searchInput).toHaveValue("");
  });
});
