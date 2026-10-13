// Kiosk device-credential API client — /kiosk/* endpoints (SC-5).
//
// Deliberately NOT the shared lib/api.ts axios instance: that instance's
// interceptor always attaches a staff `access_token`/`X-Organization-Id`
// from localStorage and redirects to /login on any 401 — both wrong for the
// kiosk's fourth, device-token auth model (DESIGN-self-checkout-auth.md).
// Mirrors lib/shop-api.ts's fetch + API_BASE + thrown-error convention,
// the established pattern for this app's other non-staff-auth route group.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

const KIOSK_TOKEN_STORAGE_KEY = "kiosk_device_token";

// Provisioning: a `?token=kiosk_<...>` query param captured into
// localStorage on first load, persisted across reloads/navigation. This
// route group never renders a login form — if neither a query param nor a
// previously-stored token exists, callers treat it exactly like a revoked
// token (same "qurilma faol emas" screen, no network call attempted).
export function readKioskDeviceToken(): string | null {
  if (typeof window === "undefined") return null;
  const fromQuery = new URLSearchParams(window.location.search).get("token");
  if (fromQuery) {
    localStorage.setItem(KIOSK_TOKEN_STORAGE_KEY, fromQuery);
    return fromQuery;
  }
  return localStorage.getItem(KIOSK_TOKEN_STORAGE_KEY);
}

export type KioskSession = {
  device_id: string;
  device_name: string;
  organization_name: string | null;
  cashbox_id: number;
  cashbox_name: string;
  warehouse_id: number;
  warehouse_name: string;
  max_cart_amount: number | null;
};

export type KioskProduct = {
  id: string;
  barcode: string | null;
  name: string;
  image_url: string | null;
  price: number;
  currency_code: string | null;
  stock_qty: number;
};

export type KioskPayment = {
  mode: "gateway" | "unavailable" | string;
  provider: string | null;
  payment_url: string | null;
};

export type KioskCheckoutResult = {
  sale_id: string;
  order_number: string;
  status: string;
  total_amount: number;
  payment: KioskPayment;
};

export type KioskOrderStatusValue = "awaiting_payment" | "paid" | "cancelled" | "payment_failed";

export type KioskOrderStatus = {
  sale_id: string;
  order_number: string;
  status: KioskOrderStatusValue;
  total_amount: number;
  payment: { mode: string };
};

export class KioskApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "KioskApiError";
    this.status = status;
    this.code = code;
  }
}

function extractDetail(data: unknown): { message: string | null; code?: string } {
  const rawDetail = (data as { detail?: unknown } | null)?.detail;
  if (typeof rawDetail === "string") return { message: rawDetail };
  if (Array.isArray(rawDetail)) {
    const message = rawDetail
      .map((d: any) => `${d?.loc?.[d.loc.length - 1] || "maydon"}: ${d?.msg}`)
      .join("; ");
    return { message };
  }
  if (rawDetail && typeof rawDetail === "object") {
    const d = rawDetail as { detail?: unknown; code?: unknown };
    return {
      message: typeof d.detail === "string" ? d.detail : null,
      code: typeof d.code === "string" ? d.code : undefined,
    };
  }
  return { message: null };
}

async function kioskFetch<T>(path: string, init?: RequestInit, timeoutMs = 10000): Promise<T> {
  const token = readKioskDeviceToken();
  if (!token) {
    throw new KioskApiError("Qurilma tokeni topilmadi", 401);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new KioskApiError("Tarmoq xatosi. Internet aloqasini tekshiring.", 0);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const { message, code } = extractDetail(data);
    throw new KioskApiError(message || `Server xatosi (${res.status})`, res.status, code);
  }
  return data as T;
}

export function fetchKioskSession(): Promise<KioskSession> {
  return kioskFetch("/kiosk/session");
}

export function fetchKioskProductByBarcode(barcode: string): Promise<KioskProduct> {
  return kioskFetch(`/kiosk/catalog/${encodeURIComponent(barcode)}`);
}

export function submitKioskCheckout(
  items: { product_id: string; quantity: number }[],
  idempotencyKey: string,
): Promise<KioskCheckoutResult> {
  return kioskFetch(
    "/kiosk/checkout",
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ items }),
    },
    20000,
  );
}

export function fetchKioskOrder(saleId: string): Promise<KioskOrderStatus> {
  return kioskFetch(`/kiosk/order/${encodeURIComponent(saleId)}`);
}
