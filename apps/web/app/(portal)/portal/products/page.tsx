"use client";

import { useEffect, useState } from "react";
import { Search, Plus, Minus, ShoppingCart, Send } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, input } from "@/components/ui/modal";
import { getPortalToken } from "../../portal-auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

type Product = {
  id: string;
  sku: string | null;
  name: string;
  price: number;
};

type CartItem = {
  product: Product;
  quantity: number;
  note?: string;
};

type Order = {
  id: string;
  order_number: string;
  status: string;
  total: number;
  item_count: number;
  created_at: string;
};

const fmt = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

const ORDER_STATUS_KEY: Record<string, string> = {
  new: "order_status_new",
  confirmed: "order_status_confirmed",
  cancelled: "order_status_cancelled",
  delivered: "order_status_delivered",
};

const ORDER_STATUS_TONE: Record<string, "neutral" | "info" | "success" | "danger"> = {
  new: "neutral",
  confirmed: "info",
  delivered: "success",
  cancelled: "danger",
};

export default function PortalProductsPage() {
  const t = useTranslations("portal");
  const tc = useTranslations("common");

  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");

  async function loadProducts() {
    const tok = getPortalToken();
    const url = query
      ? `${API_BASE}/customer-portal/products?q=${encodeURIComponent(query)}`
      : `${API_BASE}/customer-portal/products`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${tok}` },
      signal: AbortSignal.timeout(10000),
    });
    const data = await r.json();
    setProducts(Array.isArray(data) ? data : []);
  }

  async function loadOrders() {
    const tok = getPortalToken();
    const r = await fetch(`${API_BASE}/customer-portal/me/orders`, {
      headers: { Authorization: `Bearer ${tok}` },
      signal: AbortSignal.timeout(10000),
    });
    const data = await r.json();
    setOrders(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    Promise.all([loadProducts(), loadOrders()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadProducts, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function addToCart(p: Product) {
    setCart((c) => {
      const existing = c.find((it) => it.product.id === p.id);
      if (existing) {
        return c.map((it) =>
          it.product.id === p.id ? { ...it, quantity: it.quantity + 1 } : it
        );
      }
      return [...c, { product: p, quantity: 1 }];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((c) =>
      c
        .map((it) =>
          it.product.id === productId
            ? { ...it, quantity: Math.max(0, it.quantity + delta) }
            : it
        )
        .filter((it) => it.quantity > 0)
    );
  }

  const cartTotal = cart.reduce((s, it) => s + it.product.price * it.quantity, 0);

  async function submitOrderOnce(tok: string | null): Promise<any> {
    const res = await fetch(`${API_BASE}/customer-portal/me/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tok}`,
      },
      body: JSON.stringify({
        items: cart.map((it) => ({
          product_id: it.product.id,
          quantity: it.quantity,
          note: it.note,
        })),
        notes,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || tc("error"));
    return data;
  }

  async function submitOrder() {
    if (cart.length === 0) return;
    setSubmitting(true);
    const tok = getPortalToken();
    try {
      let data: any;
      try {
        data = await submitOrderOnce(tok);
      } catch (firstErr: any) {
        // Retry once on network/timeout errors (not on HTTP errors)
        if (firstErr instanceof TypeError || firstErr?.name === "TimeoutError") {
          data = await submitOrderOnce(tok);
        } else {
          throw firstErr;
        }
      }
      toast.success(`${t("order_success")} — № ${data.order_number}`);
      setCart([]);
      setNotes("");
      setShowCart(false);
      loadOrders();
    } catch (e: any) {
      toast.error(e?.message || tc("error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-sm text-ink-400">{tc("loading")}</div>;
  }

  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-[clamp(16px,2.2vw,18px)] font-semibold text-ink-900 dark:text-ink-50 tracking-tight">
        {t("products_title")}
      </h1>

      {/* Search */}
      <Card padding="sm">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            placeholder={t("search_placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${input} pl-9`}
          />
        </div>
      </Card>

      {/* Products grid */}
      {products.length === 0 ? (
        <div className="py-16 text-center text-sm text-ink-400">{t("no_products_found")}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {products.map((p) => {
            const inCart = cart.find((c) => c.product.id === p.id);
            return (
              <Card key={p.id} padding="sm" className="flex flex-col justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-ink-900 dark:text-ink-100 truncate">
                    {p.name}
                  </div>
                  {p.sku && (
                    <div className="text-xs text-ink-400 font-mono truncate">SKU: {p.sku}</div>
                  )}
                  <div className="text-sm font-mono font-semibold text-brand-600 dark:text-brand-400 mt-1">
                    {fmt(p.price)} so&apos;m
                  </div>
                </div>
                {inCart ? (
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={Minus}
                      onClick={() => changeQty(p.id, -1)}
                      aria-label="Miqdorni kamaytirish"
                    />
                    <span className="font-mono font-semibold text-ink-900 dark:text-ink-100">
                      {inCart.quantity}
                    </span>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      icon={Plus}
                      onClick={() => changeQty(p.id, 1)}
                      aria-label="Miqdorni ko'paytirish"
                    />
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    fullWidth
                    onClick={() => addToCart(p)}
                  >
                    {t("add_to_cart")}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* My orders */}
      <Card padding="none">
        <CardHeader title={`${t("my_orders")} (${orders.length})`} />
        {orders.length === 0 ? (
          <CardBody>
            <p className="text-center text-sm text-ink-400 py-2">{t("no_orders")}</p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {orders.map((o) => (
              <li key={o.id} className="px-4 sm:px-5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink-900 dark:text-ink-100">
                    № {o.order_number}
                  </div>
                  <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
                    {new Date(o.created_at).toLocaleString("uz-Cyrl-UZ")} • {o.item_count} {t("item_count_suffix")}
                  </div>
                  <Badge tone={ORDER_STATUS_TONE[o.status] ?? "neutral"} className="mt-1">
                    {ORDER_STATUS_KEY[o.status] ? t(ORDER_STATUS_KEY[o.status]) : o.status}
                  </Badge>
                </div>
                <div className="text-sm font-mono font-semibold text-ink-900 dark:text-ink-100 shrink-0">
                  {fmt(o.total)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Floating cart button */}
      {cart.length > 0 && !showCart && (
        <Button
          type="button"
          variant="primary"
          size="lg"
          icon={ShoppingCart}
          onClick={() => setShowCart(true)}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-20 rounded-full shadow-lg px-5 py-3"
        >
          {cart.reduce((s, it) => s + it.quantity, 0)} ta • {fmt(cartTotal)} so&apos;m
        </Button>
      )}

      {/* Cart modal */}
      <Modal open={showCart} onClose={() => setShowCart(false)} title={`${t("cart")} (${cart.length})`} size="lg">
        {cart.length === 0 ? (
          <p className="text-center text-sm text-ink-400 py-8">{t("cart_empty")}</p>
        ) : (
          <div className="space-y-3">
            {cart.map((it) => (
              <div key={it.product.id} className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">
                    {it.product.name}
                  </div>
                  <div className="text-xs text-ink-500 dark:text-ink-400 font-mono">
                    {it.quantity} x {fmt(it.product.price)} = {fmt(it.quantity * it.product.price)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    icon={Minus}
                    onClick={() => changeQty(it.product.id, -1)}
                    aria-label="Miqdorni kamaytirish"
                  />
                  <span className="w-6 text-center text-sm font-mono">{it.quantity}</span>
                  <Button
                    type="button"
                    variant="primary"
                    size="xs"
                    icon={Plus}
                    onClick={() => changeQty(it.product.id, 1)}
                    aria-label="Miqdorni ko'paytirish"
                  />
                </div>
              </div>
            ))}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`${input} resize-none`}
              placeholder={t("notes_placeholder")}
            />
            <div className="border-t border-ink-200 dark:border-ink-800 pt-3 space-y-2">
              <div className="flex justify-between text-base font-semibold text-ink-900 dark:text-ink-100">
                <span>{tc("total")}:</span>
                <span className="font-mono">{fmt(cartTotal)} so&apos;m</span>
              </div>
              <Button
                type="button"
                variant="primary"
                size="lg"
                icon={Send}
                fullWidth
                loading={submitting}
                onClick={submitOrder}
              >
                {t("submit_order")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
