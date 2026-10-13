import { test, expect, type Page } from "@playwright/test";

// SC-6 — Kiosk device provisioning admin UI (settings/kiosk-devices).
// All /api/v1 calls are mocked per the frozen DESIGN-self-checkout-auth.md
// contract (same pattern as pos-split-payment.spec.ts / receipt-print.spec.ts)
// since SC-2's real backend endpoints are a separate, parallel ticket and are
// not live yet. Dashboard layout only gates on localStorage.access_token
// (checked client-side), so login is seeded directly.

const CASHBOXES = [{ id: 1, name: "Kassa-1" }];

const FULL_PERMISSIONS = {
  role: { code: "admin", name: "Admin" },
  permissions: ["kiosk.view", "kiosk.create", "kiosk.update", "kiosk.delete"],
  is_superadmin: false,
};

const NO_KIOSK_PERMISSIONS = {
  role: { code: "manager", name: "Manager" },
  permissions: ["sale.view"],
  is_superadmin: false,
};

async function seedAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("access_token", "e2e-fake-token-kiosk");
    window.localStorage.setItem("locale", "uz");
  });
}

async function mockPermissions(page: Page, perms: typeof FULL_PERMISSIONS) {
  await page.route("**/api/v1/rbac/me/permissions**", (route) =>
    route.fulfill({ json: perms }),
  );
}

async function mockCashboxes(page: Page) {
  await page.route("**/api/v1/finance/cashboxes**", (route) =>
    route.fulfill({ json: CASHBOXES }),
  );
}

type MockDevice = {
  id: string;
  name: string;
  cashbox_id: number;
  cashbox_name: string;
  warehouse_name: string;
  token_prefix: string;
  status: "active" | "revoked";
  last_used_at: string | null;
  created_at: string;
};

function mockKioskDevices(page: Page, initial: MockDevice[]) {
  const devices: MockDevice[] = [...initial];
  let nextId = 100;

  page.route("**/api/v1/kiosk-devices", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: devices });
    }
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { name: string; cashbox_id: number };
      const id = `new-${nextId++}`;
      const tokenPrefix = "kiosk_NEW";
      devices.push({
        id,
        name: body.name,
        cashbox_id: body.cashbox_id,
        cashbox_name: CASHBOXES.find((c) => c.id === body.cashbox_id)?.name || "",
        warehouse_name: "Asosiy ombor",
        token_prefix: tokenPrefix,
        status: "active",
        last_used_at: null,
        created_at: new Date().toISOString(),
      });
      return route.fulfill({
        status: 201,
        json: {
          id,
          name: body.name,
          cashbox_id: body.cashbox_id,
          status: "active",
          token: "kiosk_FRESHPLAINTEXT1234567890",
          token_prefix: tokenPrefix,
        },
      });
    }
    return route.fallback();
  });

  page.route("**/api/v1/kiosk-devices/*/rotate", (route) => {
    const id = route.request().url().split("/kiosk-devices/")[1].split("/rotate")[0];
    const device = devices.find((d) => d.id === id);
    if (device) device.token_prefix = "kiosk_ROT";
    return route.fulfill({
      json: { token: "kiosk_ROTATEDPLAINTEXT987654321", token_prefix: "kiosk_ROT" },
    });
  });

  page.route("**/api/v1/kiosk-devices/*", (route) => {
    const id = route.request().url().split("/kiosk-devices/")[1];
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as { name: string; cashbox_id: number };
      const device = devices.find((d) => d.id === id);
      if (device) {
        device.name = body.name;
        device.cashbox_id = body.cashbox_id;
      }
      return route.fulfill({ json: { ok: true } });
    }
    if (route.request().method() === "DELETE") {
      const device = devices.find((d) => d.id === id);
      if (device) device.status = "revoked";
      return route.fulfill({ json: { ok: true } });
    }
    return route.fallback();
  });

  return devices;
}

test.describe("Kiosk devices admin UI (SC-6)", () => {
  test("create: shows one-time token with copy button, list shows only the prefix afterward", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await seedAuth(page);
    await mockPermissions(page, FULL_PERMISSIONS);
    await mockCashboxes(page);
    mockKioskDevices(page, []);

    await page.goto("/settings/kiosk-devices");
    await expect(page.getByText("Kiosk qurilmalari", { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Kiosk qurilmalari yo'q")).toBeVisible();

    await page.getByRole("button", { name: "Yangi qurilma" }).click();
    await page.getByPlaceholder("Masalan: Kirish kiosk-1").fill("Kirish kiosk-1");
    await page.locator("select").selectOption({ label: "Kassa-1" });
    await page.getByRole("button", { name: "Saqlash" }).click();

    await expect(page.getByText("Qurilma tokeni")).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText("Bu token qayta ko'rsatilmaydi — hozir nusxalab oling yoki yozib qo'ying."),
    ).toBeVisible();

    const tokenInput = page.locator('input[readonly]');
    await expect(tokenInput).toHaveValue("kiosk_FRESHPLAINTEXT1234567890");

    await page.getByTitle("Nusxalash").click();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe("kiosk_FRESHPLAINTEXT1234567890");

    await page.getByRole("button", { name: "Tushundim, yozib oldim" }).click();
    await expect(page.getByText("Qurilma tokeni")).not.toBeVisible();

    await expect(page.getByText("kiosk_NEW…")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("kiosk_FRESHPLAINTEXT1234567890")).not.toBeVisible();
  });

  test("rotate: new one-time token is shown, old token value never reappears", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await seedAuth(page);
    await mockPermissions(page, FULL_PERMISSIONS);
    await mockCashboxes(page);
    mockKioskDevices(page, [
      {
        id: "dev-1",
        name: "Kirish kiosk-1",
        cashbox_id: 1,
        cashbox_name: "Kassa-1",
        warehouse_name: "Asosiy ombor",
        token_prefix: "kiosk_OLD",
        status: "active",
        last_used_at: null,
        created_at: "2026-09-01T10:00:00Z",
      },
    ]);

    await page.goto("/settings/kiosk-devices");
    await expect(page.getByText("kiosk_OLD…")).toBeVisible({ timeout: 10_000 });

    const row = page.locator("tr", { hasText: "Kirish kiosk-1" });
    await row.getByTitle("Tokenni yangilash").click();

    await expect(page.getByText("Eski token zudlik bilan ishdan chiqadi — davom etasizmi?")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Yangilash" }).click();

    await expect(page.getByText("Qurilma tokeni")).toBeVisible({ timeout: 10_000 });
    const tokenInput = page.locator("input[readonly]");
    await expect(tokenInput).toHaveValue("kiosk_ROTATEDPLAINTEXT987654321");

    await page.getByRole("button", { name: "Tushundim, yozib oldim" }).click();

    await expect(page.getByText("kiosk_ROT…")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("kiosk_OLD…")).not.toBeVisible();
    await expect(page.getByText("kiosk_ROTATEDPLAINTEXT987654321")).not.toBeVisible();
  });

  test("revoke: row status flips to revoked immediately, no stale active badge", async ({ page }) => {
    await seedAuth(page);
    await mockPermissions(page, FULL_PERMISSIONS);
    await mockCashboxes(page);
    mockKioskDevices(page, [
      {
        id: "dev-2",
        name: "Chiqish kiosk-2",
        cashbox_id: 1,
        cashbox_name: "Kassa-1",
        warehouse_name: "Asosiy ombor",
        token_prefix: "kiosk_ABC",
        status: "active",
        last_used_at: null,
        created_at: "2026-09-01T10:00:00Z",
      },
    ]);

    await page.goto("/settings/kiosk-devices");
    const row = page.locator("tr", { hasText: "Chiqish kiosk-2" });
    await expect(row.getByText("Faol")).toBeVisible({ timeout: 10_000 });

    await row.getByTitle("Bekor qilish").click();
    await expect(
      page.getByText("Bu qurilma zudlik bilan ishdan chiqadi. Qayta yoqib bo'lmaydi"),
    ).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Bekor qilish" }).click();

    await expect(row.getByText("Bekor qilingan")).toBeVisible({ timeout: 10_000 });
    await expect(row.getByText("Faol")).not.toBeVisible();
    await expect(row.getByTitle("Tokenni yangilash")).not.toBeVisible();
    await expect(row.getByTitle("Bekor qilish")).not.toBeVisible();
  });

  test("no kiosk.view permission: shows restricted-access state, not an empty-looking list", async ({
    page,
  }) => {
    await seedAuth(page);
    await mockPermissions(page, NO_KIOSK_PERMISSIONS);
    await mockCashboxes(page);
    let devicesRequested = false;
    await page.route("**/api/v1/kiosk-devices", (route) => {
      devicesRequested = true;
      return route.fulfill({ json: [] });
    });

    await page.goto("/settings/kiosk-devices");

    await expect(page.getByText("Ruxsat yo'q")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/kiosk\.view/)).toBeVisible();
    await expect(page.getByText("Kiosk qurilmalari yo'q")).not.toBeVisible();
    await expect(page.locator("table")).not.toBeVisible();
    expect(devicesRequested).toBe(false);
  });
});
