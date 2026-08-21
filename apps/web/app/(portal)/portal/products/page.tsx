"use client";

import { useEffect, useState } from "react";
import { Search, Plus, Minus, ShoppingCart, Send } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
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

const STATUS_LABEL: Record<string, string> = {
  new: "Yangi",
  confirmed: "Tasdiqlangan",
  cancelled: "Bekor qilingan",
  delivered: "Yetkazildi",
};

export default function PortalProductsPage() {
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
    const t = setTimeout(loadProducts, 300);
    return () => clearTimeout(t);
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
    if (!res.ok) throw new Error(data?.detail || "Buyurtma yuborishda xato");
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
      toast.success(`Buyurtma ${data.order_number} yuborildi`);
      setCart([]);
      setNotes("");
      setShowCart(false);
      loadOrders();
    } catch (e: any) {
      toast.error(e?.message || "Buyurtma yuborishda xato");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="py-20 text-center text-slate-400">Yuklanmoqda...</div>;

  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Buyurtma berish</h1>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        <input
          placeholder="Mahsulot qidirish..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm"
        />
      </div>

      {/* Products grid */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
        {products.length === 0 && (
          <div className="px-4 py-12 text-center text-slate-400 text-sm">
            Mahsulot topilmadi
          </div>
        )}
        {products.map((p) => {
          const inCart = cart.find((c) => c.product.id === p.id);
          return (
            <div
              key={p.id}
              className="px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                  {p.name}
                </div>
                <div className="text-sm font-mono text-brand-600 dark:text-brand-400">
                  {fmt(p.price)} so'm
                </div>
              </div>
              {inCart ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => changeQty(p.id, -1)}
                    aria-label="Miqdorni kamaytirish"
                    className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center"
                  >
                    <Minus size={14} aria-hidden="true" />
                  </button>
                  <span className="font-mono font-semibold w-7 text-center">
                    {inCart.quantity}
                  </span>
                  <button
                    onClick={() => changeQty(p.id, 1)}
                    aria-label="Miqdorni ko'paytirish"
                    className="w-8 h-8 rounded bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center"
                  >
                    <Plus size={14} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => addToCart(p)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-md"
                >
                  <Plus size={14} /> Qo'shish
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* My orders */}
      {orders.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100">
            Mening buyurtmalarim ({orders.length})
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {orders.map((o) => (
              <div key={o.id} className="px-4 py-3 flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    № {o.order_number}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {new Date(o.created_at).toLocaleString("uz-Cyrl-UZ")} •{" "}
                    {o.item_count} ta mahsulot
                  </div>
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {STATUS_LABEL[o.status] || o.status}
                  </span>
                </div>
                <div className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {fmt(o.total)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating cart button */}
      {cart.length > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg"
        >
          <ShoppingCart size={18} />
          <span className="font-semibold">
            {cart.reduce((s, it) => s + it.quantity, 0)} ta • {fmt(cartTotal)} so'm
          </span>
        </button>
      )}

      {/* Cart modal */}
      <Modal
        open={showCart}
        onClose={() => setShowCart(false)}
        title={`Savat (${cart.length})`}
        size="lg"
      >
        <div className="space-y-3">
          {cart.map((it) => (
            <div key={it.product.id} className="flex items-center justify-between">
              <div className="flex-1 mr-3">
                <div className="text-sm font-medium">{it.product.name}</div>
                <div className="text-xs text-slate-500 font-mono">
                  {it.quantity} x {fmt(it.product.price)} = {fmt(it.quantity * it.product.price)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => changeQty(it.product.id, -1)}
                        aria-label="Miqdorni kamaytirish"
                        className="w-7 h-7 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <Minus size={12} aria-hidden="true" />
                </button>
                <span className="w-6 text-center text-sm font-mono">{it.quantity}</span>
                <button onClick={() => changeQty(it.product.id, 1)}
                        aria-label="Miqdorni ko'paytirish"
                        className="w-7 h-7 rounded bg-brand-600 text-white flex items-center justify-center">
                  <Plus size={12} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
          <div>
            <label className="text-xs text-slate-500 block mb-1">Izoh (ixtiyoriy)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-md"
              placeholder="Yetkazib berish manzili, vaqt..."
            />
          </div>
          <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2">
            <div className="flex justify-between text-base font-semibold">
              <span>Jami:</span>
              <span className="font-mono">{fmt(cartTotal)} so'm</span>
            </div>
            <button
              onClick={submitOrder}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-md font-medium"
            >
              <Send size={16} />
              {submitting ? "Yuborilmoqda..." : "Buyurtmani yuborish"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
