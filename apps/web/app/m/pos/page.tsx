"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Plus, Minus, ShoppingCart, ScanLine, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { BarcodeScanner } from "@/components/barcode/scanner";
import { usePermissions } from "@/lib/permissions";

type Product = { id: string; name: string; sku?: string; barcode?: string; sale_price: string; total_stock?: string };
type CartItem = { product: Product; quantity: number; price: number };
type CashboxItem = { id: number; name: string; warehouse_id?: number | null; warehouse_name?: string | null };
type WarehouseItem = { id: number; name: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function MobilePOS() {
  const ts = useTranslations("barcode.scan");
  const tSale = useTranslations("sale.contract");
  const { can } = usePermissions();
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [scanOpen, setScanOpen] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [boxes, setBoxes] = useState<CashboxItem[]>([]);
  const [whs, setWhs] = useState<WarehouseItem[]>([]);
  const [cashboxId, setCashboxId] = useState<number | null>(null);
  const [whId, setWhId] = useState<number | null>(null);
  const [whOverridden, setWhOverridden] = useState(false);
  const [showWhOverride, setShowWhOverride] = useState(false);
  const [paying, setPaying] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);

  const canChangeWarehouse = can("sale.change_warehouse");

  function selectCashbox(cid: number) {
    setCashboxId(cid);
    const cb = boxes.find((c) => c.id === cid);
    if (cb?.warehouse_id) {
      setWhId(cb.warehouse_id);
      setWhOverridden(false);
    }
  }

  useEffect(() => {
    api.get<CashboxItem[]>("/finance/cashboxes").then((r) => {
      const data = r.data || [];
      setBoxes(data);
      if (data[0]) {
        setCashboxId(data[0].id);
        if (data[0].warehouse_id) {
          setWhId(data[0].warehouse_id);
        }
      }
    }).catch(() => {});
    api.get<WarehouseItem[]>("/warehouse/warehouses").then((r) => {
      setWhs(r.data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (cashboxId) {
      api.get<any>(`/cashbox-sessions/active?cashbox_id=${cashboxId}`)
        .then((r) => setActiveSession(r.data))
        .catch(() => setActiveSession(null));
    }
  }, [cashboxId]);

  useEffect(() => {
    if (!q.trim()) { loadDefault(); return; }
    const tm = setTimeout(async () => {
      const r = await api.get<Product[]>(`/warehouse/products?q=${encodeURIComponent(q)}&limit=20`);
      setProducts(r.data || []);
    }, 250);
    return () => clearTimeout(tm);
  }, [q]);

  async function loadDefault() {
    const r = await api.get<Product[]>("/warehouse/products?limit=30");
    setProducts(r.data || []);
  }
  useEffect(() => { loadDefault(); }, []);

  function addToCart(p: Product) {
    setCart((c) => {
      const ex = c.find((it) => it.product.id === p.id);
      if (ex) return c.map((it) => it.product.id === p.id ? { ...it, quantity: it.quantity + 1 } : it);
      return [...c, { product: p, quantity: 1, price: Number(p.sale_price) || 0 }];
    });
    if (navigator.vibrate) navigator.vibrate(20);
  }

  function changeQty(pid: string, delta: number) {
    setCart((c) =>
      c.map((it) => it.product.id === pid ? { ...it, quantity: Math.max(0, it.quantity + delta) } : it)
       .filter((it) => it.quantity > 0)
    );
  }

  const onScan = useCallback(async (code: string) => {
    setScanOpen(false);
    try {
      const r = await api.get<Product[]>(`/warehouse/products?barcode=${encodeURIComponent(code)}&limit=1`);
      if (r.data?.[0]) {
        addToCart(r.data[0]);
        navigator.vibrate?.(50);
        toast.success(r.data[0].name);
      } else {
        toast.error(ts("product_not_found"));
      }
    } catch (e) {
      toast.error(getErrorMessage(e, ts("product_not_found")));
    }
  }, [ts]);

  const total = cart.reduce((s, it) => s + it.quantity * it.price, 0);
  const itemCount = cart.reduce((s, it) => s + it.quantity, 0);

  async function checkout(paymentMethod: "cash" | "card") {
    if (cart.length === 0 || !cashboxId) return;
    setPaying(true);
    try {
      const payload: Record<string, unknown> = {
        cashbox_id: cashboxId,
        cashbox_session_id: activeSession?.id || null,
        items: cart.map((it) => ({
          product_id: it.product.id, quantity: it.quantity, price: it.price,
        })),
        payments: [{ method: paymentMethod, amount: total }],
      };
      if (whOverridden && whId) {
        payload.warehouse_id = whId;
      }
      await api.post<{ id: string }>("/sale/sales", payload);
      toast.success("Sotuv ro'yxatga olindi!");
      setCart([]);
      setShowCart(false);
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top: search + scan */}
      <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Qidirish..."
            className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-slate-900 rounded-md text-sm" />
        </div>
        <button onClick={() => setScanOpen(true)}
          aria-label={ts("open_scanner")}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-brand-600 text-white rounded-md">
          <ScanLine size={20} />
        </button>
      </div>

      {/* Cashbox + warehouse selector */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400 w-16 shrink-0">Kassa</label>
          <select
            className="flex-1 text-xs bg-slate-100 dark:bg-slate-900 rounded px-2 py-1.5 border-0 focus:ring-1 focus:ring-brand-500"
            value={cashboxId || ""}
            onChange={(e) => {
              const cid = e.target.value ? Number(e.target.value) : null;
              if (cid) selectCashbox(cid);
            }}
          >
            <option value="">— tanlang —</option>
            {boxes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400 w-16 shrink-0">Sklad</label>
          {showWhOverride && canChangeWarehouse ? (
            <select
              className="flex-1 text-xs bg-slate-100 dark:bg-slate-900 rounded px-2 py-1.5 border-0 focus:ring-1 focus:ring-brand-500"
              value={whId || ""}
              onChange={(e) => {
                const wid = e.target.value ? Number(e.target.value) : null;
                setWhId(wid);
                setWhOverridden(true);
              }}
            >
              <option value="">— tanlang —</option>
              {whs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          ) : (
            <div className="flex-1 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-700 dark:text-slate-300 truncate">
                {cashboxId
                  ? (boxes.find((b) => b.id === cashboxId)?.warehouse_name || whs.find((w) => w.id === whId)?.name || "—")
                  : "—"}
              </span>
              {canChangeWarehouse && cashboxId && (
                <button
                  onClick={() => setShowWhOverride(true)}
                  className="text-xs text-brand-600 dark:text-brand-400 underline shrink-0"
                >
                  {tSale("warehouse_change_btn")}
                </button>
              )}
              {!canChangeWarehouse && cashboxId && (
                <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 italic">
                  {tSale("warehouse_auto_hint")}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cashbox status */}
      {!activeSession && cashboxId && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
          <span>Kassa smenasi yopiq</span>
          <a href="/m/cashbox" className="font-medium underline">Ochish</a>
        </div>
      )}

      {/* Product list */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
        {products.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">Mahsulot yo'q</div>
        ) : products.map((p) => {
          const inCart = cart.find((c) => c.product.id === p.id);
          return (
            <div key={p.id} className="px-3 py-2.5 flex items-center gap-2">
              <div className="flex-1 min-w-0" onClick={() => addToCart(p)}>
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs text-slate-500 font-mono">{fmt(p.sale_price)} so'm</div>
              </div>
              {inCart ? (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => changeQty(p.id, -1)}
                    aria-label="Kamayтirish"
                    className="w-11 h-11 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <Minus size={14} />
                  </button>
                  <span className="font-mono font-semibold w-7 text-center">{inCart.quantity}</span>
                  <button onClick={() => changeQty(p.id, 1)}
                    aria-label="Ko'paytirish"
                    className="w-11 h-11 rounded bg-brand-600 text-white flex items-center justify-center">
                    <Plus size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => addToCart(p)}
                  aria-label="Savatga qo'shish"
                  className="w-11 h-11 rounded bg-brand-600 text-white flex items-center justify-center">
                  <Plus size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating cart button */}
      {cart.length > 0 && !showCart && (
        <button onClick={() => setShowCart(true)}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-5 py-3 bg-brand-600 text-white rounded-full shadow-lg">
          <ShoppingCart size={18} />
          <span className="font-semibold">{itemCount} ta • {fmt(total)}</span>
        </button>
      )}

      {/* Cart drawer */}
      {showCart && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end" onClick={() => setShowCart(false)}>
          <div className="bg-white dark:bg-slate-800 w-full rounded-t-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="font-semibold">Savat ({cart.length})</span>
              <button onClick={() => setShowCart(false)} aria-label="Savatni yopish" className="min-h-[44px] min-w-[44px] flex items-center justify-center"><X size={20} /></button>
            </div>
            <div className="p-3 space-y-2">
              {cart.map((it) => (
                <div key={it.product.id} className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{it.product.name}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {it.quantity} x {fmt(it.price)} = {fmt(it.quantity * it.price)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => changeQty(it.product.id, -1)}
                      aria-label="Kamayтirish"
                      className="w-11 h-11 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-sm font-mono">{it.quantity}</span>
                    <button onClick={() => changeQty(it.product.id, 1)}
                      aria-label="Ko'paytirish"
                      className="w-11 h-11 rounded bg-brand-600 text-white flex items-center justify-center">
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-slate-800 p-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex justify-between font-semibold">
                <span>Jami:</span>
                <span className="font-mono text-lg">{fmt(total)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => checkout("cash")} disabled={paying || !activeSession || !cashboxId}
                  className="min-h-[44px] py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium">
                  Naqd
                </button>
                <button onClick={() => checkout("card")} disabled={paying || !activeSession || !cashboxId}
                  className="min-h-[44px] py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg font-medium">
                  Karta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {scanOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end">
          <div className="w-full bg-slate-900 rounded-t-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <span className="text-white font-medium text-sm">{ts("open_scanner")}</span>
              <button
                onClick={() => setScanOpen(false)}
                aria-label={ts("close_scanner")}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-300"
              >
                <X size={20} />
              </button>
            </div>
            <BarcodeScanner
              onScan={onScan}
              onError={() => setScanOpen(false)}
              className="w-full h-64"
            />
          </div>
        </div>
      )}
    </div>
  );
}
