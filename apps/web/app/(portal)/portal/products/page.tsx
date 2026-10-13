"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Minus, ShoppingCart, Send, PackageX, ImageOff, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, input } from "@/components/ui/modal";
import { getPortalToken } from "../../portal-auth";
import { CartProvider, useCart } from "../_components/cart";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

type Product = {
  id: string;
  sku: string | null;
  name: string;
  price: number;
  category_id: number | string | null;
  category_name: string | null;
  image_url: string | null;
  stock_qty: number;
  in_stock: boolean;
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

function ProductImage({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div className="w-14 h-14 shrink-0 rounded-md bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
        <ImageOff size={18} className="text-ink-400" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={name}
      width={56}
      height={56}
      className="w-14 h-14 shrink-0 rounded-md object-cover bg-ink-100 dark:bg-ink-800"
      onError={() => setFailed(true)}
    />
  );
}

function CategoryFilter({
  products,
  selected,
  onSelect,
}: {
  products: Product[];
  selected: string | null;
  onSelect: (v: string | null) => void;
}) {
  const t = useTranslations("portal");

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      const key = p.category_id == null ? "__none__" : String(p.category_id);
      if (!map.has(key)) {
        map.set(key, p.category_id == null ? t("category_uncategorized") : p.category_name || t("category_uncategorized"));
      }
    }
    return Array.from(map.entries());
  }, [products, t]);

  if (categories.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`shrink-0 px-3 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors ${
          selected === null
            ? "bg-brand-600 text-white"
            : "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-700"
        }`}
      >
        {t("category_all")}
      </button>
      {categories.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onSelect(key)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors ${
            selected === key
              ? "bg-brand-600 text-white"
              : "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ProductsPageInner() {
  const t = useTranslations("portal");
  const tc = useTranslations("common");
  const cart = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function loadProducts() {
    setLoadError(false);
    try {
      const tok = getPortalToken();
      const url = query
        ? `${API_BASE}/customer-portal/products?q=${encodeURIComponent(query)}`
        : `${API_BASE}/customer-portal/products`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${tok}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      setProducts([]);
      setLoadError(true);
    }
  }

  async function loadOrders() {
    try {
      const tok = getPortalToken();
      const r = await fetch(`${API_BASE}/customer-portal/me/orders`, {
        headers: { Authorization: `Bearer ${tok}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) return;
      const data = await r.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch {}
  }

  useEffect(() => {
    Promise.all([loadProducts(), loadOrders()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadProducts, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const visibleProducts = useMemo(() => {
    if (selectedCategory === null) return products;
    return products.filter((p) => {
      const key = p.category_id == null ? "__none__" : String(p.category_id);
      return key === selectedCategory;
    });
  }, [products, selectedCategory]);

  async function submitOrder() {
    if (cart.items.length === 0) return;
    setSubmitting(true);
    try {
      const data = await cart.submit();
      toast.success(`${t("order_success")} — № ${data.order_number}`);
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

      {loadError && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-danger-50 dark:bg-danger-500/15 text-danger-700 dark:text-danger-500 text-sm">
          <AlertTriangle size={16} className="shrink-0" />
          {tc("error")}
        </div>
      )}

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

      <CategoryFilter products={products} selected={selectedCategory} onSelect={setSelectedCategory} />

      {visibleProducts.length === 0 ? (
        <div className="py-16 text-center text-sm text-ink-400">{t("no_products_found")}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleProducts.map((p) => {
            const inCart = cart.items.find((c) => c.product_id === p.id);
            return (
              <Card key={p.id} padding="sm" className="flex flex-col justify-between gap-3">
                <div className="flex gap-3 min-w-0">
                  <ProductImage url={p.image_url} name={p.name} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink-900 dark:text-ink-100 truncate">
                      {p.name}
                    </div>
                    {p.sku && (
                      <div className="text-xs text-ink-400 font-mono truncate">SKU: {p.sku}</div>
                    )}
                    <div className="text-sm font-mono font-semibold text-brand-600 dark:text-brand-400 mt-1">
                      {fmt(p.price)} so&apos;m
                    </div>
                    <Badge tone={p.in_stock ? "success" : "danger"} className="mt-1.5">
                      {p.in_stock ? `${t("stock_in")} · ${fmt(p.stock_qty)} ${t("stock_unit")}` : t("stock_out")}
                    </Badge>
                  </div>
                </div>
                {inCart ? (
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={Minus}
                      onClick={() => cart.decrement(p.id)}
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
                      disabled={!p.in_stock}
                      onClick={() => cart.increment(p.id)}
                      aria-label="Miqdorni ko'paytirish"
                    />
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={p.in_stock ? Plus : PackageX}
                    fullWidth
                    disabled={!p.in_stock}
                    onClick={() => cart.addItem({ id: p.id, name: p.name, price: p.price, in_stock: p.in_stock })}
                  >
                    {p.in_stock ? t("add_to_cart") : t("stock_out")}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

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

      {cart.items.length > 0 && !showCart && (
        <Button
          type="button"
          variant="primary"
          size="lg"
          icon={ShoppingCart}
          onClick={() => setShowCart(true)}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-20 rounded-full shadow-lg px-5 py-3"
        >
          {cart.totalQty} ta • {fmt(cart.totalAmount)} so&apos;m
        </Button>
      )}

      <Modal open={showCart} onClose={() => setShowCart(false)} title={`${t("cart")} (${cart.items.length})`} size="lg">
        {cart.items.length === 0 ? (
          <p className="text-center text-sm text-ink-400 py-8">{t("cart_empty")}</p>
        ) : (
          <div className="space-y-3">
            {cart.items.map((it) => (
              <div key={it.product_id} className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">
                    {it.name}
                  </div>
                  <div className="text-xs text-ink-500 dark:text-ink-400 font-mono">
                    {it.quantity} x {fmt(it.price)} = {fmt(it.quantity * it.price)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    icon={Minus}
                    onClick={() => cart.decrement(it.product_id)}
                    aria-label="Miqdorni kamaytirish"
                  />
                  <span className="w-6 text-center text-sm font-mono">{it.quantity}</span>
                  <Button
                    type="button"
                    variant="primary"
                    size="xs"
                    icon={Plus}
                    onClick={() => cart.increment(it.product_id)}
                    aria-label="Miqdorni ko'paytirish"
                  />
                </div>
              </div>
            ))}
            <textarea
              value={cart.notes}
              onChange={(e) => cart.setNotes(e.target.value)}
              rows={2}
              className={`${input} resize-none`}
              placeholder={t("notes_placeholder")}
            />
            <div className="border-t border-ink-200 dark:border-ink-800 pt-3 space-y-2">
              <div className="flex justify-between text-base font-semibold text-ink-900 dark:text-ink-100">
                <span>{tc("total")}:</span>
                <span className="font-mono">{fmt(cart.totalAmount)} so&apos;m</span>
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

export default function PortalProductsPage() {
  return (
    <CartProvider>
      <ProductsPageInner />
    </CartProvider>
  );
}
