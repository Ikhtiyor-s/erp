"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, Minus, Trash2, ScanLine, Scale, Printer, PackageOpen } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { newIdempotencyKey, postIdempotent } from "@/lib/idempotency";
import { input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import {
  useBarcodeScanner,
  isWebSerialSupported,
  openSerialScale,
  type WeightReading,
} from "@/lib/scanner";
import {
  printReceipt,
  connectPrinter,
  disconnectPrinter,
  isPrinterConnected,
  isWebBluetoothSupported,
  openCashDrawer,
} from "@/lib/bt-printer";
import { renderReceiptText, type ReceiptData } from "@/lib/receipt-render";

type Product = {
  id: string;
  name: string;
  sku?: string;
  sale_price: string;
  currency_code?: string;
  is_service: boolean;
  total_stock?: string;
};
type Cart = { product: Product; qty: number };
type Customer = { id: string; name: string };
type Warehouse = { id: number; name: string };
type Cashbox = { id: number; name: string; currency_id?: number };
type PaymentTypeItem = { id: number; code: string; name: string; is_cash: boolean; is_active: boolean };
type CommittedLine = { label: string; amount: number; isBonus?: boolean };
type MethodTap = { kind: "type"; pt: PaymentTypeItem } | { kind: "bonus" };

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function PosPage() {
  const t = useTranslations("ui");
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cart, setCart] = useState<Cart[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [cashboxId, setCashboxId] = useState<number | "">("");
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeItem[]>([]);
  const [loyaltyBalance, setLoyaltyBalance] = useState<number | null>(null);
  // REGOS-style incremental payment panel state — see RG-7.
  const [saleId, setSaleId] = useState<string | null>(null);
  const [saleTotalFrozen, setSaleTotalFrozen] = useState(0);
  const [paidSoFar, setPaidSoFar] = useState(0);
  const [committedLines, setCommittedLines] = useState<CommittedLine[]>([]);
  const [amountInput, setAmountInput] = useState("");
  const [lastChange, setLastChange] = useState(0);
  const [loyaltyEarned, setLoyaltyEarned] = useState(0);
  const [loyaltyRedeemedTotal, setLoyaltyRedeemedTotal] = useState(0);
  const [committing, setCommitting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  // POS-6: ref-based re-entrancy guard, checked synchronously before any
  // await. React state (`committing`) only drives the disabled UI; it can't
  // block a second real click fired before the first render commits.
  const payBusyRef = useRef(false);
  const createSaleKeyRef = useRef<string | null>(null);
  const [scaleConnected, setScaleConnected] = useState(false);
  const [scaleWeight, setScaleWeight] = useState<number | null>(null);
  const [disconnectScale, setDisconnectScale] = useState<(() => void) | null>(null);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [receiptSettings, setReceiptSettings] = useState<{
    width_mm?: string;
    auto_print?: boolean;
    footer?: string;
  }>({});
  const [receiptTemplate, setReceiptTemplate] = useState<string | null>(null);
  const [orgInfo, setOrgInfo] = useState<{ name?: string; address?: string; phone?: string }>({});

  async function loadProducts(search: string) {
    const p = new URLSearchParams();
    p.set("limit", "30");
    if (search) p.set("q", search);
    setProducts(
      (await api.get<Product[]>(`/warehouse/products?${p}`)).data
    );
  }

  // Debounce the search-driven product fetch so a fast HID barcode scan
  // (which types into this same input) doesn't fire one request per keystroke.
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedQ(q), 250);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [q]);

  useEffect(() => {
    loadProducts(debouncedQ);
  }, [debouncedQ]);

  useEffect(() => {
    api
      .get<Customer[]>("/customer/customers?limit=200")
      .then((r) => setCustomers(r.data))
      .catch(() => {});
    api
      .get<Warehouse[]>("/warehouse/warehouses")
      .then((r) => {
        setWarehouses(r.data);
        if (r.data[0]) setWarehouseId(r.data[0].id);
      })
      .catch(() => {});
    api
      .get<Cashbox[]>("/finance/cashboxes")
      .then((r) => {
        setCashboxes(r.data);
        if (r.data[0]) setCashboxId(r.data[0].id);
      })
      .catch(() => {});
    api
      .get<PaymentTypeItem[]>("/reference/payment-types")
      .then((r) => {
        setPaymentTypes((r.data || []).filter((pt) => pt.is_active));
      })
      .catch(() => {});
  }, []);

  // RG-6 fold-in: loyalty balance is only relevant once a customer is attached
  // to the sale via the existing customer select below — no new selection
  // mechanism is introduced here.
  useEffect(() => {
    if (!customerId) {
      setLoyaltyBalance(null);
      return;
    }
    api
      .get(`/customer/customers/${customerId}/loyalty`)
      .then((r) => setLoyaltyBalance(Number(r.data?.balance || 0)))
      .catch(() => setLoyaltyBalance(null));
  }, [customerId]);

  // Receipt printing config — organization info, /settings/receipt, default
  // receipt template. Loaded once; any fetch failure just falls back to the
  // built-in default (see lib/receipt-render.ts), never blocks the POS screen.
  useEffect(() => {
    api
      .get("/settings/organization")
      .then((r) => setOrgInfo(r.data || {}))
      .catch(() => {});
    api
      .get("/settings/key/receipt")
      .then((r) => setReceiptSettings(r.data?.value || {}))
      .catch(() => {});
    api
      .get<{ id: number; kind: string; is_default: boolean }[]>("/settings/print-templates")
      .then(async (r) => {
        const def = r.data.find((tpl) => tpl.kind === "receipt" && tpl.is_default);
        if (!def) return;
        const { data } = await api.get(`/settings/print-templates/${def.id}`);
        setReceiptTemplate(data?.body || null);
      })
      .catch(() => {});
  }, []);

  function addToCart(p: Product, qty: number = 1) {
    if (saleId) return;
    setCart((c) => {
      const ex = c.find((x) => x.product.id === p.id);
      if (ex) {
        return c.map((x) =>
          x.product.id === p.id ? { ...x, qty: x.qty + qty } : x
        );
      }
      return [...c, { product: p, qty }];
    });
  }

  // Barcode scanner — HID keyboard-wedge style.
  // POS-1 fix: chose option (a) over (b). Backend /warehouse/products?q= (legacy,
  // no warehouse_id) does match p.barcode exactly, so (b)/ignoreInInputs could filter
  // the grid to the scanned product — but it would NOT auto-add to cart or clear the
  // input without reimplementing Enter-flush logic inside the input anyway. Keeping
  // the global listener active reuses the already-correct onScan cart-add path; we
  // only need to cancel the pending debounced search + clear the input on flush so no
  // stale text/per-keystroke request remains.
  useBarcodeScanner(async (barcode) => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    setQ("");
    try {
      // Search by SKU/barcode
      const { data } = await api.get<Product[]>(
        `/warehouse/products?q=${encodeURIComponent(barcode)}&limit=5`
      );
      const exact = data.find(
        (p) => p.sku === barcode || (p as any).barcode === barcode
      ) || data[0];
      if (exact) {
        addToCart(exact);
        toast.success(`📦 ${exact.name}`);
      } else {
        toast.error(`Barcode "${barcode}" topilmadi`);
      }
    } catch {
      toast.error("Mahsulot qidirishda xato");
    }
  }, { enabled: scannerEnabled });

  // Scale connection
  async function connectScale() {
    if (!isWebSerialSupported()) {
      toast.error("Brauzer WebSerial qo'llab-quvvatlamaydi (Chrome/Edge kerak)");
      return;
    }
    try {
      const disc = await openSerialScale((reading: WeightReading) => {
        setScaleWeight(reading.weight);
      });
      setDisconnectScale(() => disc);
      setScaleConnected(true);
      toast.success("Tarozi ulandi");
    } catch (e: any) {
      toast.error(e?.message || "Ulanmadi");
    }
  }

  function disconnectScaleNow() {
    if (disconnectScale) disconnectScale();
    setDisconnectScale(null);
    setScaleConnected(false);
    setScaleWeight(null);
  }

  // Receipt printer connection (Web Bluetooth ESC/POS)
  async function connectPrinterNow() {
    if (!isWebBluetoothSupported()) {
      toast.error("Brauzer Web Bluetooth'ni qo'llamaydi (Android Chrome kerak)");
      return;
    }
    try {
      await connectPrinter();
      setPrinterConnected(true);
      toast.success("Printer ulandi");
    } catch (e: any) {
      toast.error(e?.message || "Printer ulanmadi");
    }
  }

  function disconnectPrinterNow() {
    disconnectPrinter();
    setPrinterConnected(false);
  }

  async function openCashDrawerNow() {
    try {
      await openCashDrawer();
    } catch (e: any) {
      toast.error(e?.message || "Kassa qutisini ochib bo'lmadi");
    }
  }

  function openHtmlReceipt(receipt: ReceiptData) {
    const text = renderReceiptText(receipt, receiptTemplate);
    const widthMm = receiptSettings.width_mm || "80";
    const isA4 = widthMm === "A4";
    const pageSize = isA4 ? "A4 portrait" : `${widthMm}mm auto`;
    const win = window.open("", "_blank", "width=420,height=640");
    if (!win) {
      toast.error("Chop etish oynasi ochilmadi (brauzer popup bloklagan bo'lishi mumkin)");
      return;
    }
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    win.document.write(`
      <html>
        <head>
          <title>Chek</title>
          <style>
            body { margin: 0; padding: 0; background: #fff; }
            pre {
              font-family: "Courier New", monospace;
              font-size: ${isA4 ? "12px" : "11px"};
              white-space: pre-wrap;
              word-break: break-word;
              padding: ${isA4 ? "10mm" : "2mm"};
              margin: 0;
              color: #000;
            }
            @media print {
              @page {
                size: ${pageSize};
                margin: ${isA4 ? "10mm" : "0"};
              }
            }
          </style>
        </head>
        <body><pre>${escaped}</pre></body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.onload = () => {
      win.print();
      win.close();
    };
  }

  async function printNow(receipt: ReceiptData) {
    setPrinting(true);
    try {
      if (isWebBluetoothSupported() && isPrinterConnected()) {
        const text = renderReceiptText(receipt, receiptTemplate);
        await printReceipt(text);
        toast.success("Chek chop etildi");
      } else {
        openHtmlReceipt(receipt);
      }
    } catch (e: any) {
      toast.error(e?.message || "Chek chop etilmadi. Printerni tekshirib, qayta urining.");
    } finally {
      setPrinting(false);
    }
  }

  // REGOS-style numeric keypad — writes straight into the same amountInput
  // used by tapPayment, so Naqd/Karta behave exactly as before.
  function appendDigit(d: string) {
    if (fullyPaid || committing) return;
    setAmountInput((v) => {
      if (d === "." && v.includes(".")) return v;
      if (d === "00") return v === "" ? "0" : v + "00";
      return v + d;
    });
  }
  function clearAmount() {
    setAmountInput("");
  }
  function backspaceAmount() {
    setAmountInput((v) => v.slice(0, -1));
  }

  function chgQty(id: string, delta: number) {
    if (saleId) return;
    setCart((c) =>
      c
        .map((x) =>
          x.product.id === id ? { ...x, qty: Math.max(0, x.qty + delta) } : x
        )
        .filter((x) => x.qty > 0)
    );
  }
  function removeCart(id: string) {
    if (saleId) return;
    setCart((c) => c.filter((x) => x.product.id !== id));
  }

  const total = cart.reduce(
    (s, c) => s + Number(c.product.sale_price) * c.qty,
    0
  );

  // Before the sale exists, the cart total is the live figure. Once created,
  // the backend-confirmed total_amount is authoritative for the rest of this
  // transaction's incremental payment taps.
  const effectiveTotal = saleId ? saleTotalFrozen : total;
  const remainingDue = Math.max(0, effectiveTotal - paidSoFar);
  const fullyPaid = remainingDue <= 0.01;

  function resetPaymentPanel() {
    setSaleId(null);
    setSaleTotalFrozen(0);
    setPaidSoFar(0);
    setCommittedLines([]);
    setAmountInput("");
    setLastChange(0);
    setLoyaltyEarned(0);
    setLoyaltyRedeemedTotal(0);
  }

  async function ensureSale(): Promise<{ id: string; total: number } | null> {
    if (saleId) return { id: saleId, total: saleTotalFrozen };
    if (cart.length === 0) {
      toast.error(t("ui__корзина_пуста_bf65d9bd"));
      return null;
    }
    if (!warehouseId || !cashboxId) {
      toast.error(t("ui__выберите_склад_и_кассу_6445f691"));
      return null;
    }
    // One key per creation attempt — reused across the automatic retry below,
    // cleared on success/final failure so the next conscious click gets a
    // fresh one (POS-6 — see DESIGN-pos-offline.md section 4).
    if (!createSaleKeyRef.current) createSaleKeyRef.current = newIdempotencyKey();
    try {
      const selectedCashbox = cashboxes.find((c) => c.id === cashboxId);
      const data = await postIdempotent(api, "/sale/sales", {
        warehouse_id: warehouseId,
        cashbox_id: cashboxId,
        currency_id: selectedCashbox?.currency_id,
        customer_id: customerId || null,
        items: cart.map((c) => ({
          product_id: c.product.id,
          quantity: c.qty,
          price: Number(c.product.sale_price),
        })),
      }, createSaleKeyRef.current);
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
  // empty/0 means "apply the full remaining balance" (same as a real POS
  // keypad left at 0). Cash overpay is shown as change but never sent to the
  // backend — the actual /pay call is always clamped to what's still owed.
  //
  // payBusyRef is checked/set synchronously before anything else runs, so a
  // rapid double-click can't fire two real requests while waiting for the
  // `committing` state update to re-render the disabled buttons.
  async function tapPayment(tap: MethodTap) {
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
      const payKey = newIdempotencyKey();

      if (tap.kind === "bonus") {
        const cap = Math.min(requested, loyaltyBalance || 0, remaining);
        if (cap <= 0) {
          toast.error("Ball mavjud emas");
          return;
        }
        const data = await postIdempotent(api, `/sale/sales/${sale.id}/pay`, {
          amount: 0,
          redeem_points: cap,
        }, payKey);
        const redeemed = Number(data?.loyalty_redeemed || 0);
        setPaidSoFar(Number(data?.paid_amount) || 0);
        setLoyaltyEarned((v) => v + Number(data?.loyalty_earned || 0));
        setLoyaltyRedeemedTotal((v) => v + redeemed);
        setLoyaltyBalance((v) => (v !== null ? Math.max(0, v - redeemed) : v));
        setCommittedLines((lines) => [...lines, { label: "Bonus", amount: redeemed, isBonus: true }]);
        setLastChange(0);
      } else {
        const pt = tap.pt;
        const clamped = Math.min(requested, remaining);
        const change = pt.is_cash && requested > remaining ? requested - remaining : 0;
        const data = await postIdempotent(api, `/sale/sales/${sale.id}/pay`, {
          amount: clamped,
          cashbox_id: cashboxId,
          payment_type_id: pt.id,
        }, payKey);
        setPaidSoFar(Number(data?.paid_amount) || 0);
        setLoyaltyEarned((v) => v + Number(data?.loyalty_earned || 0));
        setCommittedLines((lines) => [...lines, { label: pt.name, amount: clamped }]);
        setLastChange(change);
      }
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
      let docNumber: string = String(saleId).slice(0, 8);
      try {
        const { data: full } = await api.get(`/sale/sales/${saleId}`);
        docNumber = full?.head?.doc_number || docNumber;
      } catch {
        // Printing is best-effort — a failed detail lookup falls back to the short id.
      }
      toast.success(`Sotuv №${docNumber}`);

      const tenderLines = committedLines.filter((l) => !l.isBonus);
      const receipt: ReceiptData = {
        org_name: orgInfo.name,
        org_address: orgInfo.address,
        org_phone: orgInfo.phone,
        doc_number: docNumber,
        sale_date: new Date().toLocaleString("ru-RU"),
        items: cart.map((c) => ({
          name: c.product.name,
          qty: c.qty,
          price: Number(c.product.sale_price),
          total: Number(c.product.sale_price) * c.qty,
        })),
        total: effectiveTotal,
        paid: effectiveTotal,
        currency: cart[0]?.product.currency_code || "UZS",
        footer: receiptSettings.footer,
        payments: tenderLines.length > 1 ? tenderLines.map((l) => ({ label: l.label, amount: l.amount })) : undefined,
        loyaltyRedeemed: loyaltyRedeemedTotal > 0 ? loyaltyRedeemedTotal : undefined,
        loyaltyEarned: loyaltyEarned > 0 ? loyaltyEarned : undefined,
      };
      setLastReceipt(receipt);
      setCart([]);
      setCustomerId("");
      resetPaymentPanel();

      if (receiptSettings.auto_print && isWebBluetoothSupported() && isPrinterConnected()) {
        printNow(receipt);
      }
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <div className="space-y-3">
      <PageHeader title={t("ui__pos_касса_a8ec6dab")} description={t("ui__быстрая_продажа_8922faf4")} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__склад_e8bf999f")}
          </label>
          <select
            className={input}
            value={warehouseId}
            disabled={!!saleId}
            onChange={(e) =>
              setWarehouseId(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">{t("ui__выбрать_fbbc1d13")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__касса_c85fd621")}
          </label>
          <select
            className={input}
            value={cashboxId}
            disabled={!!saleId}
            onChange={(e) =>
              setCashboxId(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">{t("ui__выбрать_fbbc1d13")}</option>
            {cashboxes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__клиент_опционально_016355ed")}
          </label>
          <select
            className={input}
            value={customerId}
            disabled={!!saleId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">{t("ui__розничный_db755a2a")}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3">
        {/* Sale ticket — REGOS-style: totals strip + line-item table + quick-add below */}
        <Card padding="none" className="overflow-hidden border-2 border-ink-200 dark:border-ink-800">
          <div className="flex flex-wrap items-stretch justify-between gap-3 bg-ink-50 dark:bg-ink-900 border-b border-ink-200 dark:border-ink-800 px-4 py-3">
            <div>
              <div className="text-xs font-bold text-ink-600 dark:text-ink-300 uppercase tracking-wide">
                {saleId ? `SOTUV (OCHIQ) · №${saleId.slice(0, 8)}` : "YANGI SOTUV"}
              </div>
              <div className="text-[11px] text-ink-400 mt-0.5">CHAKANA NARX</div>
            </div>
            <div className="flex items-center gap-5 text-right">
              <div>
                <div className="text-[11px] text-ink-400">Jami</div>
                <div className="font-mono font-bold text-lg text-ink-900 dark:text-ink-100">
                  {fmt(effectiveTotal)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-ink-400">To'langan</div>
                <div className="font-mono font-bold text-lg text-info-600 dark:text-info-500">
                  {fmt(paidSoFar)}
                </div>
              </div>
              <div className="pl-5 border-l border-ink-300 dark:border-ink-700">
                <div className="text-[11px] text-ink-400">TO'LOVGA</div>
                <div
                  className={`font-mono font-extrabold text-2xl ${
                    fullyPaid ? "text-success-600 dark:text-success-500" : "text-brand-700 dark:text-brand-400"
                  }`}
                >
                  {fmt(remainingDue)}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-auto max-h-[42vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 text-[11px] uppercase">
                <tr>
                  <th className="px-2 py-2 text-left w-8">#</th>
                  <th className="px-2 py-2 text-left">Nomi</th>
                  <th className="px-2 py-2 text-center w-28">Soni</th>
                  <th className="px-2 py-2 text-right w-24">Narx</th>
                  <th className="px-2 py-2 text-right w-28">Summa</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {cart.map((c, i) => (
                  <tr
                    key={c.product.id}
                    className="border-b border-ink-100 dark:border-ink-800 hover:bg-brand-50/60 dark:hover:bg-brand-900/10"
                  >
                    <td className="px-2 py-2 text-ink-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-2 py-2">
                      <div className="font-medium text-ink-900 dark:text-ink-100 line-clamp-1">
                        {c.product.name}
                      </div>
                      <div className="text-[11px] text-ink-400">{c.product.sku || "—"}</div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          icon={Minus}
                          disabled={!!saleId}
                          onClick={() => chgQty(c.product.id, -1)}
                        />
                        <span className="font-mono w-8 text-center text-ink-900 dark:text-ink-100">
                          {c.qty}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          icon={Plus}
                          disabled={!!saleId}
                          onClick={() => chgQty(c.product.id, +1)}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-ink-700 dark:text-ink-300">
                      {fmt(c.product.sale_price)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-semibold text-ink-900 dark:text-ink-100">
                      {fmt(Number(c.product.sale_price) * c.qty)}
                    </td>
                    <td className="px-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        icon={Trash2}
                        disabled={!!saleId}
                        onClick={() => removeCart(c.product.id)}
                        className="text-danger-600 dark:text-danger-500"
                      />
                    </td>
                  </tr>
                ))}
                {cart.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-ink-400 dark:text-ink-600 py-16">
                      {t("ui__пусто_e5b328b4")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-ink-200 dark:border-ink-800 p-3">
            <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
              <Button
                type="button"
                variant={scannerEnabled ? "success" : "outline"}
                size="xs"
                icon={ScanLine}
                onClick={() => setScannerEnabled((v) => !v)}
                title="HID barcode skaner avtomatik aniqlanadi"
              >
                Skaner {scannerEnabled ? "yoqilgan" : "o'chirilgan"}
              </Button>
              {scaleConnected ? (
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-info-50 dark:bg-info-500/15 border border-info-500/30 text-info-700 dark:text-info-500">
                  <Scale size={12} />
                  <span className="font-mono font-bold">
                    {scaleWeight !== null ? `${scaleWeight.toFixed(3)} kg` : "0.000 kg"}
                  </span>
                  <button type="button" onClick={disconnectScaleNow} className="ml-1 hover:underline">
                    uzish
                  </button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="xs" icon={Scale} onClick={connectScale}>
                  Tarozini ulash
                </Button>
              )}
              {printerConnected ? (
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-info-50 dark:bg-info-500/15 border border-info-500/30 text-info-700 dark:text-info-500">
                  <Printer size={12} />
                  Printer
                  <button type="button" onClick={disconnectPrinterNow} className="ml-1 hover:underline">
                    uzish
                  </button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="xs" icon={Printer} onClick={connectPrinterNow}>
                  Printerni ulash
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="xs"
                icon={PackageOpen}
                onClick={openCashDrawerNow}
                disabled={!printerConnected}
                title={printerConnected ? "Kassa qutisini ochish" : "Avval printerni ulang"}
              >
                Qutini ochish
              </Button>
            </div>

            <div className="relative mb-2">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                className={`${input} pl-9`}
                placeholder={`${t("ui__поиск_товара_название_штрих_ко_8537959b")} (F3)`}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-[22vh] overflow-auto">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={!!saleId}
                  onClick={() => addToCart(p)}
                  className="text-left p-2 border border-ink-200 dark:border-ink-800 rounded-md hover:border-brand-400 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="text-[11px] text-ink-500 dark:text-ink-400">{p.sku || "—"}</div>
                  <div className="font-medium text-xs text-ink-900 dark:text-ink-100 line-clamp-2">
                    {p.name}
                  </div>
                  <div className="font-mono font-semibold text-xs text-brand-700 dark:text-brand-400 mt-1">
                    {fmt(p.sale_price)} {p.currency_code || ""}
                  </div>
                </button>
              ))}
              {products.length === 0 && (
                <div className="col-span-full text-center text-ink-400 dark:text-ink-600 py-6 text-sm">
                  {t("ui__товары_не_найдены_42190736")}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Payment panel — keypad + tender buttons, REGOS-style */}
        <Card padding="md" className="flex flex-col gap-3 h-fit sticky top-4 border-2 border-ink-200 dark:border-ink-800">
          <Button
            variant="success"
            size="lg"
            fullWidth
            className="h-14 text-base"
            loading={finalizing}
            disabled={!saleId || !fullyPaid}
            onClick={finalize}
          >
            To'lov (F8)
          </Button>

          {loyaltyBalance !== null && loyaltyBalance > 0 && (
            <div className="flex justify-between text-xs text-ink-500 dark:text-ink-400 px-1">
              <span>Mijoz ball balansi</span>
              <span className="font-mono">{fmt(loyaltyBalance)}</span>
            </div>
          )}

          {committedLines.length > 0 && (
            <ul className="text-xs border border-ink-200 dark:border-ink-800 rounded-md divide-y divide-ink-100 dark:divide-ink-800">
              {committedLines.map((l, i) => (
                <li key={i} className="flex justify-between px-2 py-1">
                  <span className="text-ink-600 dark:text-ink-300">{l.label}</span>
                  <span className="font-mono text-ink-900 dark:text-ink-100">{fmt(l.amount)}</span>
                </li>
              ))}
            </ul>
          )}

          {lastChange > 0 && (
            <div className="flex justify-between text-sm text-info-700 dark:text-info-500 px-1">
              <span>Qaytim (naqd)</span>
              <span className="font-mono">{fmt(lastChange)}</span>
            </div>
          )}

          {!fullyPaid && (
            <>
              <div className="border border-ink-300 dark:border-ink-700 rounded-md px-3 py-2 text-right font-mono text-2xl font-bold bg-ink-50 dark:bg-ink-900 text-ink-900 dark:text-ink-100">
                {amountInput || fmt(remainingDue)}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ".", "00"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    disabled={committing || cart.length === 0}
                    onClick={() => appendDigit(k)}
                    className="h-11 rounded-md border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 text-lg font-semibold hover:bg-ink-50 dark:hover:bg-ink-700 disabled:opacity-50"
                  >
                    {k}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={committing || cart.length === 0}
                  onClick={clearAmount}
                  className="h-11 rounded-md border border-danger-300 dark:border-danger-700 text-danger-600 dark:text-danger-500 font-semibold hover:bg-danger-50 dark:hover:bg-danger-500/15 disabled:opacity-50"
                >
                  C
                </button>
                <button
                  type="button"
                  disabled={committing || cart.length === 0}
                  onClick={backspaceAmount}
                  className="h-11 rounded-md border border-ink-300 dark:border-ink-700 text-ink-700 dark:text-ink-300 font-semibold hover:bg-ink-50 dark:hover:bg-ink-700 disabled:opacity-50"
                >
                  ⌫
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {paymentTypes.map((pt) => (
                  <Button
                    key={pt.id}
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled={committing || cart.length === 0}
                    onClick={() => tapPayment({ kind: "type", pt })}
                  >
                    {pt.name}
                  </Button>
                ))}
                {customerId && loyaltyBalance !== null && loyaltyBalance > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled={committing || cart.length === 0}
                    onClick={() => tapPayment({ kind: "bonus" })}
                  >
                    Bonus
                  </Button>
                )}
              </div>
            </>
          )}

          {lastReceipt && (
            <div className="border-t border-ink-200 dark:border-ink-800 pt-3">
              <Button
                type="button"
                variant="outline"
                size="md"
                fullWidth
                icon={Printer}
                loading={printing}
                onClick={() => printNow(lastReceipt)}
              >
                Chekni chop etish
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
