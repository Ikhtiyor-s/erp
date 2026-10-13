"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Search, Plus, Minus, ShoppingCart, ScanLine, X, Scale } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { newIdempotencyKey, postIdempotent } from "@/lib/idempotency";
import { BarcodeScanner } from "@/components/barcode/scanner";
import { usePermissions } from "@/lib/permissions";
import { readScale, isWebBluetoothSupported } from "@/lib/bt-printer";

type Product = { id: string; name: string; sku?: string; barcode?: string; sale_price: string; unit_name?: string; total_stock?: string };
type CartItem = { product: Product; quantity: number; price: number };
type CashboxItem = { id: number; name: string; warehouse_id?: number | null; warehouse_name?: string | null; currency_id?: number };
type WarehouseItem = { id: number; name: string };
type PaymentTypeItem = { id: number; code: string; name: string; is_cash: boolean; is_active: boolean };
type CommittedLine = { label: string; amount: number };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

function isWeightUnit(p: Product): boolean {
  const u = (p.unit_name || "").trim().toLowerCase();
  return u === "kg" || u === "g";
}

function weightToUnitQuantity(unitName: string | undefined, weightKg: number): number {
  const u = (unitName || "").trim().toLowerCase();
  return u === "g" ? weightKg * 1000 : weightKg;
}

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
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeItem[]>([]);
  const [cashboxId, setCashboxId] = useState<number | null>(null);
  const [whId, setWhId] = useState<number | null>(null);
  const [whOverridden, setWhOverridden] = useState(false);
  const [showWhOverride, setShowWhOverride] = useState(false);
  // REGOS-style incremental payment panel state — see RG-7.
  const [saleId, setSaleId] = useState<string | null>(null);
  const [saleTotalFrozen, setSaleTotalFrozen] = useState(0);
  const [paidSoFar, setPaidSoFar] = useState(0);
  const [committedLines, setCommittedLines] = useState<CommittedLine[]>([]);
  const [amountInput, setAmountInput] = useState("");
  const [lastChange, setLastChange] = useState(0);
  const [committing, setCommitting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  // POS-6: ref-based re-entrancy guard, checked synchronously before any
  // await. React state (`committing`) only drives the disabled UI; it can't
  // block a second real tap fired before the first render commits.
  const payBusyRef = useRef(false);
  const createSaleKeyRef = useRef<string | null>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [scaleConnecting, setScaleConnecting] = useState(false);
  const [scaleConnected, setScaleConnected] = useState(false);
  const [scaleWeight, setScaleWeight] = useState<number | null>(null);
  const disconnectScaleRef = useRef<(() => void) | null>(null);

  const canChangeWarehouse = can("sale.change_warehouse");

  async function connectScale() {
    if (!isWebBluetoothSupported()) {
      toast.error("Brauzer Web Bluetooth qo'llab-quvvatlamaydi (Android Chrome kerak)");
      return;
    }
    setScaleConnecting(true);
    try {
      const disc = await readScale((kg) => setScaleWeight(kg));
      disconnectScaleRef.current = disc;
      setScaleConnected(true);
      toast.success("Tarozi ulandi");
    } catch (e: any) {
      toast.error(e?.message || "Ulanmadi");
    } finally {
      setScaleConnecting(false);
    }
  }

  function disconnectScaleNow() {
    disconnectScaleRef.current?.();
    disconnectScaleRef.current = null;
    setScaleConnected(false);
    setScaleWeight(null);
  }

  useEffect(() => {
    return () => { disconnectScaleRef.current?.(); };
  }, []);

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
    api.get<PaymentTypeItem[]>("/reference/payment-types").then((r) => {
      setPaymentTypes(r.data || []);
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
    if (saleId) return;
    let qty = 1;
    if (isWeightUnit(p)) {
      if (!scaleConnected || !scaleWeight || scaleWeight <= 0) {
        toast.error("Avval tarozini ulang va mahsulotni tarozi ustiga qo'ying");
        return;
      }
      qty = weightToUnitQuantity(p.unit_name, scaleWeight);
    }
    setCart((c) => {
      const ex = c.find((it) => it.product.id === p.id);
      if (ex) return c.map((it) => it.product.id === p.id ? { ...it, quantity: it.quantity + qty } : it);
      return [...c, { product: p, quantity: qty, price: Number(p.sale_price) || 0 }];
    });
    if (navigator.vibrate) navigator.vibrate(20);
  }

  function changeQty(pid: string, delta: number) {
    if (saleId) return;
    setCart((c) =>
      c.map((it) => it.product.id === pid ? { ...it, quantity: Math.max(0, it.quantity + delta) } : it)
       .filter((it) => it.quantity > 0)
    );
  }

  function removeFromCart(pid: string) {
    if (saleId) return;
    setCart((c) => c.filter((it) => it.product.id !== pid));
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
  const activePaymentTypes = paymentTypes.filter((pt) => pt.is_active);

  // Before the sale exists, the cart total is the live figure. Once created,
  // the backend-confirmed total_amount is authoritative for the rest of this
  // transaction's incremental payment taps.
  const effectiveTotal = saleId ? saleTotalFrozen : total;
  const remainingDue = Math.max(0, effectiveTotal - paidSoFar);
  const fullyPaid = remainingDue <= 0.01;

  function basePayload() {
    const selectedCashbox = boxes.find((b) => b.id === cashboxId);
    const payload: Record<string, unknown> = {
      cashbox_id: cashboxId,
      cashbox_session_id: activeSession?.id || null,
      currency_id: selectedCashbox?.currency_id,
      items: cart.map((it) => ({
        product_id: it.product.id, quantity: it.quantity, price: it.price,
      })),
    };
    if (whOverridden && whId) {
      payload.warehouse_id = whId;
    }
    return payload;
  }

  function resetPaymentPanel() {
    setSaleId(null);
    setSaleTotalFrozen(0);
    setPaidSoFar(0);
    setCommittedLines([]);
    setAmountInput("");
    setLastChange(0);
  }

  async function ensureSale(): Promise<{ id: string; total: number } | null> {
    if (saleId) return { id: saleId, total: saleTotalFrozen };
    if (cart.length === 0 || !cashboxId) return null;
    // One key per creation attempt — reused across the automatic retry below,
    // cleared on success/final failure so the next conscious tap gets a
    // fresh one (POS-6 — see DESIGN-pos-offline.md section 4).
    if (!createSaleKeyRef.current) createSaleKeyRef.current = newIdempotencyKey();
    try {
      const data = await postIdempotent<{ id: string; total_amount?: number }>(
        api, "/sale/sales", basePayload(), createSaleKeyRef.current,
      );
      const totalAmount = Number(data.total_amount ?? total);
      setSaleId(data.id);
      setSaleTotalFrozen(totalAmount);
      createSaleKeyRef.current = null;
      return { id: data.id, total: totalAmount };
    } catch (e) {
      createSaleKeyRef.current = null;
      toast.error(getErrorMessage(e, "Sotuv yaratilmadi"));
      return null;
    }
  }

  // REGOS incremental model: one tap = one committed /pay line. amountInput
  // empty/0 means "apply the full remaining balance". Cash overpay is shown
  // as change but never sent to the backend — the /pay call is always
  // clamped to what's still owed.
  //
  // payBusyRef is checked/set synchronously before anything else runs, so a
  // rapid double-tap can't fire two real requests while waiting for the
  // `committing` state update to re-render the disabled buttons.
  async function tapPayment(pt: PaymentTypeItem) {
    if (payBusyRef.current) return;
    payBusyRef.current = true;
    setCommitting(true);
    try {
      const sale = await ensureSale();
      if (!sale) return;
      const remaining = Math.max(0, sale.total - paidSoFar);
      if (remaining <= 0.01) return;
      const entered = Number(amountInput) || 0;
      const requested = entered > 0 ? entered : remaining;
      const clamped = Math.min(requested, remaining);
      const change = pt.is_cash && requested > remaining ? requested - remaining : 0;
      const payKey = newIdempotencyKey();

      const data = await postIdempotent(api, `/sale/sales/${sale.id}/pay`, {
        amount: clamped,
        cashbox_id: cashboxId,
        payment_type_id: pt.id,
      }, payKey);
      setPaidSoFar(Number(data?.paid_amount) || 0);
      setCommittedLines((lines) => [...lines, { label: pt.name, amount: clamped }]);
      setLastChange(change);
      setAmountInput("");
    } catch (e) {
      toast.error(getErrorMessage(e, "To'lov amalga oshmadi"));
    } finally {
      setCommitting(false);
      payBusyRef.current = false;
    }
  }

  async function finalize() {
    if (!saleId || !fullyPaid) return;
    setFinalizing(true);
    try {
      toast.success("Sotuv ro'yxatga olindi!");
      setCart([]);
      setShowCart(false);
      resetPaymentPanel();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setFinalizing(false);
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

      {/* Scale (tarozi) toolbar */}
      <div className="px-3 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs">
        {scaleConnected ? (
          <div className="flex items-center justify-between gap-2 flex-1 px-2.5 py-1.5 rounded-md bg-info-50 dark:bg-info-500/15 border border-info-500/30 text-info-700 dark:text-info-500">
            <span className="flex items-center gap-1.5">
              <Scale size={14} />
              Tarozi:{" "}
              <span className="font-mono font-bold">
                {scaleWeight !== null ? `${scaleWeight.toFixed(3)} kg` : "0.000 kg"}
              </span>
            </span>
            <button type="button" onClick={disconnectScaleNow}
              aria-label="Tarozini uzish"
              className="min-h-[32px] px-2 underline shrink-0">
              uzish
            </button>
          </div>
        ) : (
          <button type="button" onClick={connectScale} disabled={scaleConnecting}
            aria-label="Tarozini ulash"
            className="min-h-[36px] px-3 flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50">
            <Scale size={14} />
            {scaleConnecting ? "Ulanmoqda..." : "Tarozini ulash"}
          </button>
        )}
      </div>

      {/* Cashbox + warehouse selector */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400 w-16 shrink-0">Kassa</label>
          <select
            className="flex-1 text-xs bg-slate-100 dark:bg-slate-900 rounded px-2 py-1.5 border-0 focus:ring-1 focus:ring-brand-500"
            value={cashboxId || ""}
            disabled={!!saleId}
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
              disabled={!!saleId}
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
          const weightItem = isWeightUnit(p);
          return (
            <div key={p.id} className="px-3 py-2.5 flex items-center gap-2">
              <div className="flex-1 min-w-0" onClick={() => addToCart(p)}>
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {fmt(p.sale_price)} so'm{weightItem ? `/${p.unit_name}` : ""}
                </div>
              </div>
              {inCart ? (
                weightItem ? (
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 w-16 text-right">
                      {inCart.quantity.toFixed(3)} {p.unit_name}
                    </span>
                    <button onClick={() => addToCart(p)} disabled={!!saleId}
                      aria-label="Yana qo'shish"
                      className="w-11 h-11 rounded bg-brand-600 text-white flex items-center justify-center disabled:opacity-50">
                      <Plus size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => changeQty(p.id, -1)} disabled={!!saleId}
                      aria-label="Kamayтirish"
                      className="w-11 h-11 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center disabled:opacity-50">
                      <Minus size={14} />
                    </button>
                    <span className="font-mono font-semibold w-7 text-center">{inCart.quantity}</span>
                    <button onClick={() => changeQty(p.id, 1)} disabled={!!saleId}
                      aria-label="Ko'paytirish"
                      className="w-11 h-11 rounded bg-brand-600 text-white flex items-center justify-center disabled:opacity-50">
                      <Plus size={14} />
                    </button>
                  </div>
                )
              ) : (
                <button onClick={() => addToCart(p)} disabled={!!saleId}
                  aria-label="Savatga qo'shish"
                  className="w-11 h-11 rounded bg-brand-600 text-white flex items-center justify-center disabled:opacity-50">
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
              {cart.map((it) => {
                const weightItem = isWeightUnit(it.product);
                return (
                  <div key={it.product.id} className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{it.product.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {weightItem ? `${it.quantity.toFixed(3)} ${it.product.unit_name}` : it.quantity} x {fmt(it.price)} = {fmt(it.quantity * it.price)}
                      </div>
                    </div>
                    {weightItem ? (
                      <button onClick={() => removeFromCart(it.product.id)} disabled={!!saleId}
                        aria-label="O'chirish"
                        className="w-11 h-11 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-danger-600 dark:text-danger-500 disabled:opacity-50">
                        <X size={16} />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => changeQty(it.product.id, -1)} disabled={!!saleId}
                          aria-label="Kamayтirish"
                          className="w-11 h-11 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center disabled:opacity-50">
                          <Minus size={12} />
                        </button>
                        <span className="w-6 text-center text-sm font-mono">{it.quantity}</span>
                        <button onClick={() => changeQty(it.product.id, 1)} disabled={!!saleId}
                          aria-label="Ko'paytirish"
                          className="w-11 h-11 rounded bg-brand-600 text-white flex items-center justify-center disabled:opacity-50">
                          <Plus size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-slate-800 p-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex justify-between font-semibold">
                <span>Jami:</span>
                <span className="font-mono text-lg">{fmt(effectiveTotal)}</span>
              </div>

              {committedLines.length > 0 && (
                <ul className="text-xs border border-slate-200 dark:border-slate-700 rounded-md divide-y divide-slate-100 dark:divide-slate-700">
                  {committedLines.map((l, i) => (
                    <li key={i} className="flex justify-between px-2 py-1">
                      <span className="text-slate-600 dark:text-slate-300">{l.label}</span>
                      <span className="font-mono">{fmt(l.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">To'lanishi kerak</span>
                <span className={`font-mono font-semibold ${fullyPaid ? "text-emerald-600" : ""}`}>
                  {fmt(remainingDue)}
                </span>
              </div>

              {lastChange > 0 && (
                <div className="flex justify-between text-sm text-info-700 dark:text-info-500">
                  <span>Qaytim (naqd)</span>
                  <span className="font-mono">{fmt(lastChange)}</span>
                </div>
              )}

              {!fullyPaid && (
                <>
                  <input
                    type="number"
                    min={0}
                    aria-label="To'lov summasi"
                    placeholder={`Summa (bo'sh = to'liq ${fmt(remainingDue)})`}
                    value={amountInput}
                    disabled={committing || cart.length === 0}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full text-sm bg-slate-100 dark:bg-slate-900 rounded px-3 py-2.5 border-0 focus:ring-1 focus:ring-brand-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {activePaymentTypes.map((pt) => (
                      <button key={pt.id} onClick={() => tapPayment(pt)}
                        disabled={committing || !activeSession || !cashboxId}
                        className="min-h-[44px] py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 disabled:opacity-50 text-slate-900 dark:text-white rounded-lg font-medium">
                        {pt.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <button
                onClick={finalize}
                disabled={finalizing || !saleId || !fullyPaid}
                className="w-full min-h-[44px] py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg font-medium"
              >
                Tasdiqlash
              </button>
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
