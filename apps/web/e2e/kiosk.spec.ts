import { test, expect, type Page } from "@playwright/test";

// SC-5 — Kiosk customer-facing UI (scan -> cart -> pay -> wait -> done).
// All /api/v1/kiosk/* calls are mocked per the frozen contracts read directly
// from apps/api/app/modules/kiosk/{router,service,auth}.py (same mocking
// convention as kiosk-devices.spec.ts / pos-split-payment.spec.ts) — no live
// backend required. The device token is seeded into localStorage directly
// (mirrors kiosk-devices.spec.ts's seedAuth helper) rather than exercising
// the `?token=` query-param capture, since that's the one-time provisioning
// path, not what every subsequent kiosk boot does.
//
// The reused BarcodeScanner component (components/barcode/scanner.tsx) talks
// to the real camera + native BarcodeDetector API, neither of which exist in
// a headless test runner. Rather than re-testing that component's scanning
// mechanics (already covered by its own usage in app/m/pos), this spec fakes
// the two browser APIs it depends on: getUserMedia returns a software
// canvas-captured MediaStream (no camera hardware needed), and a fake
// BarcodeDetector class resolves whatever barcode the test pushes onto a
// queue. This exercises the exact same onScan callback / kiosk integration
// code a real scan would, without needing a decodable barcode image on screen.

const DEVICE_TOKEN = "kiosk_e2eDeviceToken1234567890";

const SESSION = {
  device_id: "device-1",
  device_name: "Kirish kiosk-1",
  organization_name: "Aniq Test Do'kon",
  cashbox_id: 4,
  cashbox_name: "Kassa-2",
  warehouse_id: 7,
  warehouse_name: "Asosiy ombor",
  max_cart_amount: 500_000,
};

const PRODUCT = {
  id: "11111111-1111-1111-1111-111111111111",
  barcode: "4780000000017",
  name: "Non 1 dona",
  image_url: null,
  price: 15_000,
  currency_code: "UZS",
  stock_qty: 40,
};

async function seedDeviceToken(page: Page) {
  await page.addInitScript((token) => {
    window.localStorage.setItem("kiosk_device_token", token);
  }, DEVICE_TOKEN);
}

async function installFakeScanner(page: Page) {
  await page.addInitScript(() => {
    const mediaDevices = navigator.mediaDevices;
    const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
    mediaDevices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
      if (constraints && constraints.video) {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, 640, 480);
        }
        return (canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }).captureStream(5);
      }
      return originalGetUserMedia(constraints);
    };

    (window as unknown as { __kioskFakeScanQueue: string[] }).__kioskFakeScanQueue = [];
    class FakeBarcodeDetector {
      async detect() {
        const queue = (window as unknown as { __kioskFakeScanQueue: string[] }).__kioskFakeScanQueue;
        if (queue.length > 0) {
          return [{ rawValue: queue.shift() as string, format: "ean_13" }];
        }
        return [];
      }
    }
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = FakeBarcodeDetector;
  });
}

async function fakeScan(page: Page, barcode: string) {
  await page.waitForFunction(() => Array.isArray((window as any).__kioskFakeScanQueue));
  await page.evaluate((code) => {
    (window as unknown as { __kioskFakeScanQueue: string[] }).__kioskFakeScanQueue.push(code);
  }, barcode);
}

function mockSession(page: Page, overrides: Partial<typeof SESSION> = {}) {
  return page.route("**/api/v1/kiosk/session", (route) =>
    route.fulfill({ json: { ...SESSION, ...overrides } }),
  );
}

function mockSession401(page: Page) {
  return page.route("**/api/v1/kiosk/session", (route) =>
    route.fulfill({ status: 401, json: { detail: "Qurilma tokeni noto'g'ri yoki bekor qilingan" } }),
  );
}

function mockCatalogBarcode(page: Page, products: Record<string, typeof PRODUCT>) {
  return page.route("**/api/v1/kiosk/catalog/*", (route) => {
    const barcode = decodeURIComponent(route.request().url().split("/catalog/")[1]);
    const product = products[barcode];
    if (!product) {
      return route.fulfill({ status: 404, json: { detail: "Mahsulot topilmadi" } });
    }
    return route.fulfill({ json: product });
  });
}

async function openScanner(page: Page) {
  await page.getByRole("button", { name: "Skanerlash" }).click();
}

test.describe("Kiosk self-checkout customer UI (SC-5)", () => {
  test("scan -> cart -> checkout -> waiting screen -> paid", async ({ page }) => {
    await seedDeviceToken(page);
    await installFakeScanner(page);
    await mockSession(page);
    await mockCatalogBarcode(page, { [PRODUCT.barcode]: PRODUCT });

    const checkoutBodies: unknown[] = [];
    await page.route("**/api/v1/kiosk/checkout", (route) => {
      checkoutBodies.push(route.request().postDataJSON());
      route.fulfill({
        status: 201,
        json: {
          sale_id: "sale-1",
          order_number: "KS-2026-00001",
          status: "awaiting_payment",
          total_amount: PRODUCT.price,
          payment: { mode: "gateway", provider: "click", payment_url: null },
        },
      });
    });

    let orderPollCount = 0;
    await page.route("**/api/v1/kiosk/order/*", (route) => {
      orderPollCount += 1;
      route.fulfill({
        json: {
          sale_id: "sale-1",
          order_number: "KS-2026-00001",
          status: orderPollCount < 2 ? "awaiting_payment" : "paid",
          total_amount: PRODUCT.price,
          payment: { mode: "gateway" },
        },
      });
    });

    await page.goto("/kiosk");
    await expect(page.getByText(SESSION.organization_name)).toBeVisible({ timeout: 10_000 });

    await openScanner(page);
    await fakeScan(page, PRODUCT.barcode);
    await expect(page.getByText(PRODUCT.name).first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Savat" }).click();
    await page.getByRole("button", { name: "To'lash" }).click();

    await expect(page.getByText("To'lovni kuting")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Tasdiqlandi, xayr")).toBeVisible({ timeout: 15_000 });

    expect(checkoutBodies).toEqual([{ items: [{ product_id: PRODUCT.id, quantity: 1 }] }]);
    expect(orderPollCount).toBeGreaterThanOrEqual(2);
  });

  test("scanning a nonexistent/weight-sold barcode shows 'mahsulot topilmadi', no crash", async ({ page }) => {
    await seedDeviceToken(page);
    await installFakeScanner(page);
    await mockSession(page);
    await mockCatalogBarcode(page, {});

    await page.goto("/kiosk");
    await expect(page.getByText(SESSION.organization_name)).toBeVisible({ timeout: 10_000 });

    await openScanner(page);
    await fakeScan(page, "0000000000000");

    await expect(page.getByText("Mahsulot topilmadi")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(SESSION.organization_name)).toBeVisible();
  });

  test("payment.mode = unavailable shows its own explicit screen, not a generic error", async ({ page }) => {
    await seedDeviceToken(page);
    await installFakeScanner(page);
    await mockSession(page);
    await mockCatalogBarcode(page, { [PRODUCT.barcode]: PRODUCT });

    let orderRequested = false;
    await page.route("**/api/v1/kiosk/checkout", (route) =>
      route.fulfill({
        status: 201,
        json: {
          sale_id: "sale-2",
          order_number: "KS-2026-00002",
          status: "awaiting_payment",
          total_amount: PRODUCT.price,
          payment: { mode: "unavailable", provider: null, payment_url: null },
        },
      }),
    );
    await page.route("**/api/v1/kiosk/order/*", (route) => {
      orderRequested = true;
      route.fulfill({
        json: {
          sale_id: "sale-2",
          order_number: "KS-2026-00002",
          status: "awaiting_payment",
          total_amount: PRODUCT.price,
          payment: { mode: "unavailable" },
        },
      });
    });

    await page.goto("/kiosk");
    await openScanner(page);
    await fakeScan(page, PRODUCT.barcode);
    await expect(page.getByText(PRODUCT.name).first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Savat" }).click();
    await page.getByRole("button", { name: "To'lash" }).click();

    await expect(page.getByText("To'lov tizimi hali ulanmagan — kassaga murojaat qiling")).toBeVisible({
      timeout: 10_000,
    });
    // Unavailable mode is a terminal screen reached straight off the 201 —
    // it must never start polling an order that can never auto-confirm.
    expect(orderRequested).toBe(false);
  });

  test("backend 422 cart_limit_exceeded at checkout is handled gracefully, not a crash", async ({ page }) => {
    await seedDeviceToken(page);
    await installFakeScanner(page);
    await mockSession(page);
    await mockCatalogBarcode(page, { [PRODUCT.barcode]: PRODUCT });

    await page.route("**/api/v1/kiosk/checkout", (route) =>
      route.fulfill({
        status: 422,
        json: {
          detail: { detail: "Savat qiymati juda katta — kassaga murojaat qiling", code: "cart_limit_exceeded" },
        },
      }),
    );

    await page.goto("/kiosk");
    await openScanner(page);
    await fakeScan(page, PRODUCT.barcode);
    await expect(page.getByText(PRODUCT.name).first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Savat" }).click();
    await page.getByRole("button", { name: "To'lash" }).click();

    await expect(page.getByText("Savat qiymati juda katta — kassaga murojaat qiling")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: "Savatga qaytish" })).toBeVisible();
  });

  test("90s payment timeout -> escalation screen, never a fake success, never loops forever", async ({ page }) => {
    await seedDeviceToken(page);
    await installFakeScanner(page);
    await mockSession(page);
    await mockCatalogBarcode(page, { [PRODUCT.barcode]: PRODUCT });

    let orderPollCount = 0;
    await page.route("**/api/v1/kiosk/checkout", (route) =>
      route.fulfill({
        status: 201,
        json: {
          sale_id: "sale-3",
          order_number: "KS-2026-00003",
          status: "awaiting_payment",
          total_amount: PRODUCT.price,
          payment: { mode: "gateway", provider: "payme", payment_url: null },
        },
      }),
    );
    // Never confirms, exactly like the SPEC's "abandoned/unresolved kiosk
    // sale" case — nothing on the frontend may ever turn this into "paid".
    await page.route("**/api/v1/kiosk/order/*", (route) => {
      orderPollCount += 1;
      route.fulfill({
        json: {
          sale_id: "sale-3",
          order_number: "KS-2026-00003",
          status: "awaiting_payment",
          total_amount: PRODUCT.price,
          payment: { mode: "gateway" },
        },
      });
    });

    await page.goto("/kiosk");
    await openScanner(page);
    await fakeScan(page, PRODUCT.barcode);
    await expect(page.getByText(PRODUCT.name).first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Savat" }).click();
    await page.getByRole("button", { name: "To'lash" }).click();
    await expect(page.getByText("To'lovni kuting")).toBeVisible({ timeout: 10_000 });

    // Clock installed only now (post-scan, post-checkout) — the camera/raf
    // scanning loop and the checkout call already ran in real time; only the
    // ~90s payment-poll budget itself is virtual, so this test doesn't
    // actually wait 90 real seconds.
    await page.clock.install();
    await page.clock.fastForward(95_000);

    await expect(page.getByText("Xodimga murojaat qiling")).toBeVisible({ timeout: 10_000 });
    expect(orderPollCount).toBeGreaterThan(0);
    expect(orderPollCount).toBeLessThan(60); // bounded — not an infinite hot loop

    // Never flips to a fake success after giving up.
    await expect(page.getByText("Tasdiqlandi, xayr")).not.toBeVisible();
  });

  test("401 from GET /kiosk/session shows 'qurilma faol emas' and halts — no retry storm", async ({ page }) => {
    await seedDeviceToken(page);
    let sessionRequests = 0;
    await page.route("**/api/v1/kiosk/session", (route) => {
      sessionRequests += 1;
      route.fulfill({ status: 401, json: { detail: "Qurilma tokeni noto'g'ri yoki bekor qilingan" } });
    });

    await page.goto("/kiosk");

    await expect(page.getByText("Qurilma faol emas — administratorga murojaat qiling")).toBeVisible({
      timeout: 10_000,
    });

    await page.waitForTimeout(3_000);
    expect(sessionRequests).toBe(1);
  });

  test("no device token at all is treated the same as revoked — never shows a login form", async ({ page }) => {
    await page.goto("/kiosk");

    await expect(page.getByText("Qurilma faol emas — administratorga murojaat qiling")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator("input[type=password]")).toHaveCount(0);
    await expect(page.getByText(/login|parol|kirish/i)).toHaveCount(0);
  });
});
