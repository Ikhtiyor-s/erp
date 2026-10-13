// Public B2C storefront API client — /shop/* endpoints, no auth, org-scoped
// via org_code. Mirrors the fetch + API_BASE + thrown-Error convention used
// by the (portal) route group's inline fetch calls (see portal/_components/cart.tsx).

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

export type ShopStockStatus = "in_stock" | "low" | "out_of_stock";

export type ShopCategory = {
  id: number;
  name: string;
  product_count: number;
};

export type ShopProduct = {
  id: string;
  name: string;
  category_id: number | null;
  category_name: string | null;
  image_url: string | null;
  price: number;
  currency_code: string;
  stock_status: ShopStockStatus;
};

export type ShopCatalog = {
  configured: boolean;
  items: ShopProduct[];
  total: number;
};

export type ShopCheckoutPayload = {
  org_code: string;
  customer: { name: string; phone: string };
  items: { product_id: string; quantity: number }[];
  notes: string | null;
};

export type ShopCheckoutResult = {
  sale_id: string;
  order_number: string;
  status: string;
  total_amount: number;
  payment: {
    mode: "manual" | "gateway";
    provider: string | null;
    payment_url: string | null;
  };
};

export type ShopOrder = {
  sale_id: string;
  order_number: string;
  status: string;
  total_amount: number;
  payment: {
    mode: "manual" | "gateway";
    provider: string | null;
    payment_url: string | null;
  };
};

export class ShopApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ShopApiError";
    this.status = status;
  }
}

async function shopFetch<T>(path: string, init?: RequestInit, timeoutMs = 10000): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ShopApiError("Tarmoq xatosi. Internet aloqasini tekshiring.", 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : null;
    throw new ShopApiError(detail || `Server xatosi (${res.status})`, res.status);
  }
  return data as T;
}

export function fetchShopCategories(orgCode: string): Promise<{ items: ShopCategory[] }> {
  return shopFetch(`/shop/categories?org_code=${encodeURIComponent(orgCode)}`);
}

export function fetchShopProducts(
  orgCode: string,
  opts: { categoryId?: number | null; q?: string; limit?: number; offset?: number } = {},
): Promise<ShopCatalog> {
  const params = new URLSearchParams({ org_code: orgCode });
  if (opts.categoryId != null) params.set("category_id", String(opts.categoryId));
  if (opts.q) params.set("q", opts.q);
  params.set("limit", String(opts.limit ?? 50));
  params.set("offset", String(opts.offset ?? 0));
  return shopFetch(`/shop/products?${params.toString()}`);
}

export function fetchShopProduct(orgCode: string, productId: string): Promise<ShopProduct> {
  return shopFetch(
    `/shop/products/${encodeURIComponent(productId)}?org_code=${encodeURIComponent(orgCode)}`,
  );
}

export function fetchShopOrder(orgCode: string, saleId: string): Promise<ShopOrder> {
  return shopFetch(
    `/shop/order/${encodeURIComponent(saleId)}?org_code=${encodeURIComponent(orgCode)}`,
  );
}

export function submitShopCheckout(
  payload: ShopCheckoutPayload,
  idempotencyKey: string,
): Promise<ShopCheckoutResult> {
  return shopFetch(
    `/shop/checkout`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(payload),
    },
    20000,
  );
}
