"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Plus, Minus, Trash2, ScanLine, Scale, Printer, PackageOpen, Percent, LogOut, RotateCcw, ChevronUp, ChevronDown, Pencil, X, MoreVertical } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { newIdempotencyKey, postIdempotent } from "@/lib/idempotency";
import { Modal, input } from "@/components/ui/modal";
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
  wholesale_price?: string | null;
  currency_code?: string;
  is_service: boolean;
  total_stock?: string;
};
type Cart = { product: Product; qty: number };
type Customer = { id: string; name: string };
type Warehouse = { id: number; name: string };
type Cashbox = { id: number; name: string; currency_id?: number };
type PaymentTypeItem = { id: number; code: string; name: string; is_cash: boolean; is_active: boolean };
type CommittedLine = {
  label: string;
  amount: number;
  isBonus?: boolean;
  movementId?: number | null;
  voided?: boolean;
};
type MethodTap = { kind: "type"; pt: PaymentTypeItem } | { kind: "bonus" };
type DiscountKind = "percent" | "amount";
type KeypadTarget = "payment" | "discount";
type HeldSale = {
  id: string;
  uuid_label: string;
  total_amount: number;
  paid_amount: number;
  sale_date: string;
  customer_name?: string | null;
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

// PosPoint-parity ulgurji (wholesale) narx — docs/pospoint-pos/operations/
// wholesale-prices.md. Falls back to sale_price when the product has no
// wholesale_price set, even while wholesale mode is on.
function linePrice(p: Product, wholesaleMode: boolean): number {
  if (wholesaleMode && p.wholesale_price) return Number(p.wholesale_price);
  return Number(p.sale_price);
}

// Stub action — the REGOS button exists for visual/muscle-memory parity, but
// the underlying Aniq ERP feature isn't built yet (see
// project_erp_regos_pos_workflow.md for the full gap list). Never silently
// no-op: always say so.
function notBuiltYet(label: string) {
  toast(`${label} — hali ERP'da yo'q (REGOS parity bo'yicha reja)`, { icon: "🚧" });
}

export default function PosPage() {
  const t = useTranslations("ui");
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [cart, setCart] = useState<Cart[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [cashboxId, setCashboxId] = useState<number | "">("");
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [wholesaleEnabled, setWholesaleEnabled] = useState(false);
  const [wholesaleMode, setWholesaleMode] = useState(false);
  const [negativeStockPolicy, setNegativeStockPolicy] = useState<string | null>(null);
  // PosPoint-parity multivalyuta — docs/pospoint-pos/operations/
  // multicurrency.md. Display-only (user's explicit choice): shows a
  // secondary currency-equivalent next to so'm amounts, payment stays
  // single-currency. null = disabled or no rate available.
  const [extraCurrencyCode, setExtraCurrencyCode] = useState<string | null>(null);
  const [extraCurrencyRate, setExtraCurrencyRate] = useState<number | null>(null);
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

  // Whole-document discount (REGOS Ctrl+Shift+O/P) — % or so'm, editable only
  // before a sale is created. Distributed pro-rata into each line's
  // sale_items.discount on create (backend already supports the column).
  const [discountKind, setDiscountKind] = useState<DiscountKind | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [discountValue, setDiscountValue] = useState(0);
  const [keypadTarget, setKeypadTarget] = useState<KeypadTarget>("payment");
  // Starts null (not `new Date()`) so server-render and the client's first
  // render before hydration produce the same empty text — a clock value
  // computed at module/render time differs between server and client by
  // definition and was causing a React hydration-mismatch crash (#418) that
  // made buttons below it stop responding to clicks.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  async function loadProducts(search: string) {
    const p = new URLSearchParams();
    p.set("limit", "30");
    if (search) p.set("q", search);
    const data = (await api.get<Product[]>(`/warehouse/products?${p}`)).data;
    setProducts(
      negativeStockPolicy === "hide"
        ? data.filter((pr) => pr.is_service || Number(pr.total_stock || 0) > 0)
        : data
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
  }, [debouncedQ, negativeStockPolicy]);

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
    api
      .get<{ value?: { enabled?: boolean } }>("/settings/key/wholesale_prices")
      .then((r) => setWholesaleEnabled(!!r.data?.value?.enabled))
      .catch(() => {});
    api
      .get<{ value?: { negative_stock_policy?: string } }>("/settings/key/warehouse")
      .then((r) => setNegativeStockPolicy(r.data?.value?.negative_stock_policy || null))
      .catch(() => {});
    api
      .get<{ value?: { enabled?: boolean; currency_code?: string } }>("/settings/key/multicurrency")
      .then(async (r) => {
        const cfg = r.data?.value;
        if (!cfg?.enabled || !cfg.currency_code) return;
        const rates = (await api.get<{ code: string; rate: number | null }[]>(
          "/reference/currencies/rates/latest"
        )).data;
        const match = rates.find((x) => x.code === cfg.currency_code);
        if (match?.rate) {
          setExtraCurrencyCode(cfg.currency_code);
          setExtraCurrencyRate(Number(match.rate));
        }
      })
      .catch(() => {});
  }, []);

  function fmtExtra(somAmount: number): string | null {
    if (!extraCurrencyRate) return null;
    return `≈ ${(somAmount / extraCurrencyRate).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ${extraCurrencyCode}`;
  }

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

  // REGOS-style numeric keypad. Writes into amountInput (payment) or
  // discountInput (whole-doc discount entry), depending on keypadTarget.
  function keypadDigit(d: string) {
    const setter = keypadTarget === "discount" ? setDiscountInput : setAmountInput;
    if (keypadTarget === "payment" && (fullyPaid || committing)) return;
    setter((v) => {
      if (d === "." && v.includes(".")) return v;
      if (d === "00") return v === "" ? "0" : v + "00";
      return v + d;
    });
  }
  function keypadClear() {
    if (keypadTarget === "discount") setDiscountInput("");
    else setAmountInput("");
  }
  function keypadBackspace() {
    if (keypadTarget === "discount") setDiscountInput((v) => v.slice(0, -1));
    else setAmountInput((v) => v.slice(0, -1));
  }
  function keypadEnter() {
    if (keypadTarget === "discount") {
      applyDiscountEntry();
      return;
    }
    if (!fullyPaid && !committing && cart.length > 0 && paymentTypes[0]) {
      tapPayment({ kind: "type", pt: paymentTypes[0] });
    }
  }

  // Whole-document discount — REGOS Ctrl+Shift+O (%) / Ctrl+Shift+P (so'm).
  // Only editable before ensureSale() runs (cart still "Открыт", not yet
  // posted) — matches REGOS, where discount belongs to the editing stage.
  function startDiscountEntry(kind: DiscountKind) {
    if (saleId) {
      toast.error("Sotuv allaqachon yaratilgan — chegirma faqat tahrirlash bosqichida");
      return;
    }
    setDiscountKind(kind);
    setDiscountInput(discountValue > 0 ? String(discountValue) : "");
    setKeypadTarget("discount");
  }
  function applyDiscountEntry() {
    const v = Math.max(0, Number(discountInput) || 0);
    setDiscountValue(v);
    setKeypadTarget("payment");
    if (v === 0) setDiscountKind(null);
  }
  function clearDiscount() {
    setDiscountKind(null);
    setDiscountValue(0);
    setDiscountInput("");
    setKeypadTarget("payment");
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

  // REGOS shows the currently-selected row's detail above the table; Aniq ERP
  // has no "selected row" concept, so the last-added line is the closest honest
  // equivalent (what a cashier just scanned/tapped).
  const lastAddedLine = cart.length > 0 ? cart[cart.length - 1] : null;

  const subtotal = cart.reduce(
    (s, c) => s + linePrice(c.product, wholesaleMode) * c.qty,
    0
  );
  const wholesaleSavings = wholesaleMode
    ? cart.reduce(
        (s, c) => s + (Number(c.product.sale_price) - linePrice(c.product, wholesaleMode)) * c.qty,
        0
      )
    : 0;
  const discountAmount =
    discountKind === "percent"
      ? Math.min(subtotal, subtotal * (discountValue / 100))
      : discountKind === "amount"
      ? Math.min(subtotal, discountValue)
      : 0;
  const total = Math.max(0, subtotal - discountAmount);

  // Before the sale exists, the cart total (after discount) is the live
  // figure. Once created, the backend-confirmed total_amount is authoritative
  // for the rest of this transaction's incremental payment taps.
  const effectiveTotal = saleId ? saleTotalFrozen : total;
  const remainingDue = Math.max(0, effectiveTotal - paidSoFar);
  const fullyPaid = cart.length > 0 && remainingDue <= 0.01;

  function resetPaymentPanel() {
    setSaleId(null);
    setSaleTotalFrozen(0);
    setPaidSoFar(0);
    setCommittedLines([]);
    setAmountInput("");
    setLastChange(0);
    setLoyaltyEarned(0);
    setLoyaltyRedeemedTotal(0);
    setWholesaleMode(false);
    clearDiscount();
  }

  // F9 (REGOS "Аннулировать" — cancel whole doc). This session only has a
  // pre-payment cart to clear; REGOS's real cancel can also void an
  // in-payment document, which Aniq ERP doesn't model yet (no parked/
  // in-payment status — see project_erp_regos_pos_workflow.md).
  function cancelWholeSale() {
    if (cart.length === 0 && !saleId) return;
    if (!window.confirm("Butun chek bekor qilinsinmi?")) return;
    setCart([]);
    setCustomerId("");
    resetPaymentPanel();
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
      // Whole-doc discount is distributed pro-rata across lines (sale_items.discount
      // is a per-line absolute amount — see apps/api/app/modules/sale/router.py
      // SaleItemIn.discount). Rounding remainder is accepted (a few tiyin at most);
      // not worth exact penny-distribution for this session's scope.
      const items = cart.map((c) => {
        const linePrc = linePrice(c.product, wholesaleMode);
        const lineSubtotal = linePrc * c.qty;
        const lineDiscount =
          discountAmount > 0 && subtotal > 0
            ? Math.round(((discountAmount * lineSubtotal) / subtotal) * 100) / 100
            : 0;
        return {
          product_id: c.product.id,
          quantity: c.qty,
          price: linePrc,
          discount: lineDiscount,
        };
      });
      const data = await postIdempotent(api, "/sale/sales", {
        warehouse_id: warehouseId,
        cashbox_id: cashboxId,
        currency_id: selectedCashbox?.currency_id,
        customer_id: customerId || null,
        items,
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
        setCommittedLines((lines) => [
          ...lines,
          { label: pt.name, amount: clamped, movementId: data?.movement_id ?? null },
        ]);
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

  // REGOS-parity payment-line storno — docs/regos-pos/operations/
  // sales-registration/payment-by-document.md. Only cash-backed lines
  // (movementId set) can be voided; bonus lines have no cash_movements row
  // yet. Backend blocks this once the sale has reached 'paid' (loyalty
  // earn-on-pay guard) — surfaced here via the normal error toast.
  async function voidPayment(index: number) {
    const line = committedLines[index];
    if (!saleId || !line || line.voided || !line.movementId) return;
    try {
      const data = await api.post(`/sale/sales/${saleId}/pay/${line.movementId}/void`);
      setPaidSoFar(Number(data.data?.paid_amount) || 0);
      setCommittedLines((lines) => lines.map((l, i) => (i === index ? { ...l, voided: true } : l)));
      toast.success("To'lov bekor qilindi");
    } catch (e) {
      toast.error(getErrorMessage(e, "To'lovni bekor qilib bo'lmadi"));
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
          price: linePrice(c.product, wholesaleMode),
          total: linePrice(c.product, wholesaleMode) * c.qty,
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

  // REGOS hotkeys — F3/F5/F8/F9/F12/Delete/Esc (the subset docs.regos.uz
  // flags as covering most cashier muscle memory). Guarded so typing in a
  // text field still works normally (Delete/Esc) or isn't hijacked at all
  // (F-keys are safe globally — browsers don't use them for text editing).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");

      if (e.key === "F3") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === "F5") {
        e.preventDefault();
        router.push("/sale/return");
        return;
      }
      if (e.key === "F8") {
        e.preventDefault();
        keypadEnter();
        if (fullyPaid && saleId) finalize();
        return;
      }
      if (e.key === "F9") {
        e.preventDefault();
        cancelWholeSale();
        return;
      }
      if (e.ctrlKey && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        holdCurrentSale();
        return;
      }
      if (e.ctrlKey && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        openHeldModal();
        return;
      }
      if (e.key === "F12") {
        e.preventDefault();
        cancelWholeSale();
        return;
      }
      if (e.key === "Delete" && !typing && !saleId && cart.length > 0) {
        e.preventDefault();
        // Storno-lite: removes the last line. REGOS strikes the line through
        // and keeps a negative counter-line for audit instead of deleting —
        // not replicated yet (see project_erp_regos_pos_workflow.md gap #3).
        removeCart(cart[cart.length - 1].product.id);
        return;
      }
      if (e.key === "Escape") {
        if (keypadTarget === "discount") {
          e.preventDefault();
          setKeypadTarget("payment");
          setDiscountInput("");
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId, cart, fullyPaid, keypadTarget, amountInput, discountInput]);

  // REGOS "Касса → Внесение/Изъятие" (Ctrl+I/Ctrl+O) — cash in/out independent
  // of any sale. The generic POST /finance/movements endpoint already covers
  // this (cash_movements with sale_id=NULL); this is just the POS-screen entry
  // point REGOS exposes directly on the cashier till. docs/regos-pos/
  // operations/additional-functions.md.
  const [cashMoveOpen, setCashMoveOpen] = useState(false);
  const [cashMoveDirection, setCashMoveDirection] = useState<"in" | "out">("in");
  const [cashMoveAmount, setCashMoveAmount] = useState("");
  const [cashMoveDesc, setCashMoveDesc] = useState("");
  const [cashMoveSubmitting, setCashMoveSubmitting] = useState(false);

  // REGOS "Отложить чек" (park/defer) — docs/regos-pos/operations/
  // sales-registration/general-information.md. Only the mid-payment half
  // (Отложена оплата): a sale already created server-side can be held and
  // resumed later. The pre-payment "editing" half (Отложен) has no Aniq ERP
  // equivalent — the cart is frontend-only until the first payment tap.
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [heldModalOpen, setHeldModalOpen] = useState(false);
  const [holding, setHolding] = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);

  // Secondary REGOS actions (Chegirma/Sotuvchi/Kutish rejimi/...) collapsed
  // into a top-right ⋮ menu instead of a permanently-visible grid — 2026-10-13
  // user request.
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!actionMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [actionMenuOpen]);

  async function submitCashMovement() {
    const amt = Number(cashMoveAmount) || 0;
    if (amt <= 0) {
      toast.error("Summani kiriting");
      return;
    }
    if (!cashboxId) {
      toast.error(t("ui__выберите_склад_и_кассу_6445f691"));
      return;
    }
    const cb = cashboxes.find((c) => c.id === cashboxId);
    setCashMoveSubmitting(true);
    try {
      await api.post("/finance/movements", {
        cashbox_id: cashboxId,
        direction: cashMoveDirection,
        amount: amt,
        currency_id: cb?.currency_id,
        description:
          cashMoveDesc ||
          (cashMoveDirection === "in" ? "Kassaga naqd kiritish (POS)" : "Kassadan naqd chiqarish (POS)"),
      });
      toast.success(cashMoveDirection === "in" ? "Naqd kiritildi" : "Naqd chiqarildi");
      setCashMoveOpen(false);
      setCashMoveAmount("");
      setCashMoveDesc("");
    } catch (e) {
      toast.error(getErrorMessage(e, "Kassa harakati amalga oshmadi"));
    } finally {
      setCashMoveSubmitting(false);
    }
  }

  async function holdCurrentSale() {
    if (!saleId || fullyPaid) return;
    setHolding(true);
    try {
      await api.post(`/sale/sales/${saleId}/hold`);
      toast.success("Chek kutish rejimiga qo'yildi");
      setCart([]);
      setCustomerId("");
      resetPaymentPanel();
    } catch (e) {
      toast.error(getErrorMessage(e, "Kutish rejimiga qo'yib bo'lmadi"));
    } finally {
      setHolding(false);
    }
  }

  async function openHeldModal() {
    setHeldModalOpen(true);
    try {
      const { data } = await api.get<HeldSale[]>("/sale/sales", {
        params: { status: "on_hold", limit: 50 },
      });
      setHeldSales(data);
    } catch (e) {
      toast.error(getErrorMessage(e, "Kutayotgan cheklarni yuklab bo'lmadi"));
    }
  }

  async function resumeHeldSale(id: string) {
    if (saleId) {
      toast.error("Avval joriy chekni yakunlang yoki kutish rejimiga qo'ying");
      return;
    }
    setResumingId(id);
    try {
      const resumeResp = await api.post(`/sale/sales/${id}/resume`);
      const { data: detail } = await api.get(`/sale/sales/${id}`);
      const items = (detail.items || []) as any[];
      const reconstructed: Cart[] = items.map((it) => ({
        product: {
          id: it.product_id,
          name: it.product_name || "—",
          sale_price: String(it.price),
          is_service: false,
        },
        qty: Number(it.quantity),
      }));
      setCart(reconstructed);
      setCustomerId(detail.head?.customer_id || "");
      setSaleId(id);
      setSaleTotalFrozen(Number(detail.head?.total_amount) || 0);
      const paid = Number(detail.head?.paid_amount) || 0;
      setPaidSoFar(paid);
      setCommittedLines(
        paid > 0 ? [{ label: "Oldingi to'lov(lar)", amount: paid }] : []
      );
      setAmountInput("");
      setLastChange(0);
      setHeldModalOpen(false);
      toast.success(`Chek davom ettirildi — ${resumeResp.data?.status || ""}`);
    } catch (e) {
      toast.error(getErrorMessage(e, "Chekni davom ettirib bo'lmadi"));
    } finally {
      setResumingId(null);
    }
  }

  return (
    <div className="space-y-3 max-w-[1700px] mx-auto">
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

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
        {/* Sale ticket — REGOS-style: logo/clock strip + totals + line-item table + quick-add */}
        <Card padding="none" className="overflow-hidden border-2 border-ink-200 dark:border-ink-800">
          <div className="bg-ink-50 dark:bg-ink-900 border-b border-ink-200 dark:border-ink-800 px-4 py-2">
            <div className="text-xs font-bold text-ink-600 dark:text-ink-300 uppercase tracking-wide">
              {saleId ? `SOTUV (OCHIQ)  ДОК. №${saleId.slice(0, 8)}` : "YANGI SOTUV"}{" "}
              {wholesaleEnabled ? (
                <button
                  type="button"
                  disabled={!!saleId}
                  onClick={() => setWholesaleMode((v) => !v)}
                  className={`px-1.5 py-0.5 rounded font-bold normal-case tracking-normal disabled:opacity-50 ${
                    wholesaleMode
                      ? "bg-success-600 text-white"
                      : "bg-danger-600 text-white"
                  }`}
                  title="Chakana/ulgurji narx rejimini almashtirish"
                >
                  {wholesaleMode ? "ULGURJI NARX" : "CHAKANA NARX"}
                </button>
              ) : (
                "(CHAKANA NARX)"
              )}
              {extraCurrencyRate && (
                <span className="font-normal normal-case text-ink-400 float-right mr-3">
                  1 {extraCurrencyCode} = {fmt(extraCurrencyRate)} so'm
                </span>
              )}
              {now && (
                <span className="font-normal normal-case text-ink-400 float-right">
                  {now.toLocaleDateString("uz-UZ")} {now.toLocaleTimeString("uz-UZ")}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-stretch justify-between gap-3 bg-ink-50 dark:bg-ink-900 border-b border-ink-200 dark:border-ink-800 px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="font-extrabold text-xl tracking-tight text-danger-600 dark:text-danger-500">
                ANIQ <span className="text-ink-900 dark:text-ink-100">POS</span>
              </div>
              <div className="flex items-center gap-5 text-right">
                <div>
                  <div className="text-[11px] text-ink-400">Jami</div>
                  <div className="font-mono font-bold text-lg text-ink-900 dark:text-ink-100">
                    {fmt(subtotal)}
                  </div>
                </div>
                {wholesaleSavings > 0 && (
                  <div>
                    <div className="text-[11px] text-ink-400">Tejov</div>
                    <div className="font-mono font-bold text-lg text-success-600 dark:text-success-500">
                      −{fmt(wholesaleSavings)}
                    </div>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div>
                    <div className="text-[11px] text-ink-400 flex items-center gap-1 justify-end">
                      Chegirma
                      <button type="button" onClick={clearDiscount} className="text-danger-500 hover:underline">
                        ✕
                      </button>
                    </div>
                    <div className="font-mono font-bold text-lg text-warning-600 dark:text-warning-500">
                      −{fmt(discountAmount)}
                    </div>
                  </div>
                )}
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
                  {fmtExtra(remainingDue) && (
                    <div className="text-[11px] text-ink-400 font-mono">{fmtExtra(remainingDue)}</div>
                  )}
                </div>
              </div>
            </div>

            {/* REGOS "Карта" mini-panel — customer loyalty snapshot, same top-right
                slot as the reference. Only discount%/markup% exist in REGOS, not
                Aniq ERP; shown honestly as just the loyalty balance we actually have. */}
            {customerId && (
              <div className="border border-ink-200 dark:border-ink-800 rounded-md px-3 py-1.5 text-xs min-w-[140px]">
                <div className="font-semibold text-ink-500 dark:text-ink-400 mb-0.5">
                  {customers.find((c) => c.id === customerId)?.name || "Mijoz"}
                </div>
                <div className="flex justify-between text-ink-600 dark:text-ink-300">
                  <span>Bonus</span>
                  <span className="font-mono">{fmt(loyaltyBalance ?? 0)}</span>
                </div>
              </div>
            )}

            <div className="relative" ref={actionMenuRef}>
              <button
                type="button"
                onClick={() => setActionMenuOpen((v) => !v)}
                title="Qo'shimcha amallar"
                className="w-9 h-9 rounded-md border border-ink-300 dark:border-ink-700 flex items-center justify-center text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800"
              >
                <MoreVertical size={18} />
              </button>
              {actionMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-md shadow-lg z-20 py-1 text-sm">
                  <button
                    type="button"
                    disabled={!!saleId}
                    onClick={() => {
                      startDiscountEntry("percent");
                      setActionMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-40"
                  >
                    <Percent size={14} /> Chegirma
                  </button>
                  <button
                    type="button"
                    disabled
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-ink-400 dark:text-ink-600 cursor-not-allowed"
                  >
                    Sotuvchi
                  </button>
                  <button
                    type="button"
                    disabled={!saleId || fullyPaid || holding}
                    onClick={() => {
                      holdCurrentSale();
                      setActionMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-40"
                  >
                    Kutish rejimi <span className="text-[11px] text-ink-400">Ctrl+G</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openHeldModal();
                      setActionMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
                  >
                    Kutayotganlar <span className="text-[11px] text-ink-400">Ctrl+J</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCashMoveOpen(true);
                      setActionMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
                  >
                    Kassa harakati
                  </button>
                  <button
                    type="button"
                    disabled
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-ink-400 dark:text-ink-600 cursor-not-allowed"
                  >
                    Bloklash
                  </button>
                  <div className="my-1 border-t border-ink-100 dark:border-ink-800" />
                  <button
                    type="button"
                    onClick={() => router.push("/sale/contract")}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
                  >
                    Cheklar
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/sale/return")}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-danger-600 dark:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/15"
                  >
                    <RotateCcw size={14} /> Qaytarish <span className="ml-auto text-[11px] text-ink-400">F5</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      cancelWholeSale();
                      setActionMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-danger-600 dark:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/15"
                  >
                    <LogOut size={14} /> Chiqish <span className="ml-auto text-[11px] text-ink-400">F9/F12</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {lastAddedLine && (
            <div className="px-4 py-2 border-b border-ink-100 dark:border-ink-800 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink-900 dark:text-ink-100 line-clamp-1">
                  {lastAddedLine.product.name}
                </span>
                <span className="font-mono text-ink-500 dark:text-ink-400 text-xs shrink-0 ml-2">
                  {lastAddedLine.qty} x {fmt(linePrice(lastAddedLine.product, wholesaleMode))} ={" "}
                  {fmt(linePrice(lastAddedLine.product, wholesaleMode) * lastAddedLine.qty)}
                </span>
              </div>
              <div className="text-[11px] text-ink-400 mt-0.5 flex items-center justify-between">
                <span>Kod: {lastAddedLine.product.sku || "—"}</span>
                {fmtExtra(linePrice(lastAddedLine.product, wholesaleMode) * lastAddedLine.qty) && (
                  <span className="font-mono">
                    {fmtExtra(linePrice(lastAddedLine.product, wholesaleMode) * lastAddedLine.qty)}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex">
            <div className="overflow-auto max-h-[42vh] flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 text-[11px] uppercase">
                  <tr>
                    <th className="px-2 py-2 text-left w-8">#</th>
                    <th className="px-2 py-2 text-left w-20">Kod</th>
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
                      <td className="px-2 py-2 font-mono text-xs text-ink-500 dark:text-ink-400">
                        {c.product.sku || "—"}
                      </td>
                      <td className="px-2 py-2">
                        <div className="font-medium text-ink-900 dark:text-ink-100 line-clamp-1">
                          {c.product.name}
                        </div>
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
                        {fmt(linePrice(c.product, wholesaleMode))}
                      </td>
                      <td className="px-2 py-2 text-right font-mono font-semibold text-ink-900 dark:text-ink-100">
                        {fmt(linePrice(c.product, wholesaleMode) * c.qty)}
                        {fmtExtra(linePrice(c.product, wholesaleMode) * c.qty) && (
                          <div className="text-[10px] font-normal text-ink-400">
                            {fmtExtra(linePrice(c.product, wholesaleMode) * c.qty)}
                          </div>
                        )}
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
                      <td colSpan={7} className="text-center text-ink-400 dark:text-ink-600 py-16">
                        {t("ui__пусто_e5b328b4")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* REGOS row-navigation icon column. Only "o'chirish" (last row) has a
                real Aniq ERP equivalent — the rest (move selection cursor, inline
                edit) have no concept of a "selected row" in this UI yet, so they're
                shown REGOS-style but disabled rather than faked. */}
            <div className="flex flex-col border-l border-ink-200 dark:border-ink-800 w-9 shrink-0">
              {[
                { icon: ChevronUp, title: "Yuqoriga (tez orada)" },
                { icon: ChevronDown, title: "Pastga (tez orada)" },
                { icon: Pencil, title: "Tahrirlash (tez orada)" },
                { icon: X, title: "Bekor qilish (tez orada)" },
              ].map(({ icon: Icon, title }, i) => (
                <button
                  key={i}
                  type="button"
                  disabled
                  title={title}
                  className="flex-1 flex items-center justify-center border-b border-ink-100 dark:border-ink-800 text-ink-300 dark:text-ink-700 cursor-not-allowed"
                >
                  <Icon size={14} />
                </button>
              ))}
              <button
                type="button"
                disabled={!!saleId || cart.length === 0}
                title="Oxirgi qatorni o'chirish (Delete)"
                onClick={() => cart.length > 0 && removeCart(cart[cart.length - 1].product.id)}
                className="flex-1 flex items-center justify-center text-danger-500 dark:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/15 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 size={14} />
              </button>
            </div>
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
                ref={searchInputRef}
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

        {/* Payment panel — keypad + tender buttons + action grid, REGOS-style */}
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
                <li
                  key={i}
                  className={`flex items-center justify-between px-2 py-1 ${l.voided ? "opacity-50" : ""}`}
                >
                  <span className={`text-ink-600 dark:text-ink-300 ${l.voided ? "line-through" : ""}`}>
                    {l.label}
                  </span>
                  <span
                    className={`font-mono text-ink-900 dark:text-ink-100 ${l.voided ? "line-through" : ""}`}
                  >
                    {fmt(l.amount)}
                  </span>
                  {!l.voided && l.movementId != null && !fullyPaid && (
                    <button
                      type="button"
                      onClick={() => voidPayment(i)}
                      title="Bekor qilish (сторно)"
                      className="ml-2 text-danger-500 hover:text-danger-700 dark:hover:text-danger-400"
                    >
                      ✕
                    </button>
                  )}
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

          <div
            className={`border rounded-md px-3 py-2 text-right font-mono text-2xl font-bold ${
              keypadTarget === "discount"
                ? "border-warning-400 dark:border-warning-600 bg-warning-50 dark:bg-warning-500/10 text-warning-700 dark:text-warning-500"
                : "border-ink-300 dark:border-ink-700 bg-ink-50 dark:bg-ink-900 text-ink-900 dark:text-ink-100"
            }`}
          >
            {keypadTarget === "discount"
              ? `Chegirma${discountKind === "percent" ? " %" : " so'm"}: ${discountInput || "0"}`
              : amountInput || fmt(remainingDue)}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ".", "00"].map((k) => (
              <button
                key={k}
                type="button"
                disabled={keypadTarget === "payment" && (committing || cart.length === 0)}
                onClick={() => keypadDigit(k)}
                className="h-11 rounded-md border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 text-lg font-semibold hover:bg-ink-50 dark:hover:bg-ink-700 disabled:opacity-50"
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              onClick={keypadClear}
              className="h-11 rounded-md border border-danger-300 dark:border-danger-700 text-danger-600 dark:text-danger-500 font-semibold hover:bg-danger-50 dark:hover:bg-danger-500/15"
            >
              C
            </button>
            <button
              type="button"
              onClick={keypadBackspace}
              className="h-11 rounded-md border border-ink-300 dark:border-ink-700 text-ink-700 dark:text-ink-300 font-semibold hover:bg-ink-50 dark:hover:bg-ink-700"
            >
              ⌫
            </button>
            <button
              type="button"
              onClick={keypadEnter}
              disabled={keypadTarget === "payment" && (fullyPaid || committing || cart.length === 0)}
              className="h-11 rounded-md border border-brand-400 dark:border-brand-600 text-brand-700 dark:text-brand-400 font-semibold hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50"
            >
              Enter
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {paymentTypes.map((pt) => (
              <Button
                key={pt.id}
                type="button"
                variant="outline"
                size="lg"
                disabled={fullyPaid || committing || cart.length === 0}
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
                disabled={fullyPaid || committing || cart.length === 0}
                onClick={() => tapPayment({ kind: "bonus" })}
              >
                Bonus
              </Button>
            )}
          </div>

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

      <Modal open={cashMoveOpen} onClose={() => setCashMoveOpen(false)} title="Kassa harakati" size="sm">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCashMoveDirection("in")}
              className={`h-10 rounded-md border font-medium text-sm ${
                cashMoveDirection === "in"
                  ? "border-success-500 bg-success-50 dark:bg-success-500/15 text-success-700 dark:text-success-500"
                  : "border-ink-300 dark:border-ink-700 text-ink-600 dark:text-ink-300"
              }`}
            >
              Kiritish
            </button>
            <button
              type="button"
              onClick={() => setCashMoveDirection("out")}
              className={`h-10 rounded-md border font-medium text-sm ${
                cashMoveDirection === "out"
                  ? "border-danger-500 bg-danger-50 dark:bg-danger-500/15 text-danger-700 dark:text-danger-500"
                  : "border-ink-300 dark:border-ink-700 text-ink-600 dark:text-ink-300"
              }`}
            >
              Chiqarish
            </button>
          </div>
          <div>
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">Summa</label>
            <input
              className={input}
              type="number"
              min={0}
              value={cashMoveAmount}
              onChange={(e) => setCashMoveAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">Sabab (ixtiyoriy)</label>
            <input
              className={input}
              value={cashMoveDesc}
              onChange={(e) => setCashMoveDesc(e.target.value)}
              placeholder={cashMoveDirection === "in" ? "Masalan: smena uchun qoldiq" : "Masalan: menejer oldi"}
            />
          </div>
          <Button
            variant={cashMoveDirection === "in" ? "success" : "danger"}
            fullWidth
            loading={cashMoveSubmitting}
            onClick={submitCashMovement}
          >
            {cashMoveDirection === "in" ? "Kassaga kiritish" : "Kassadan chiqarish"}
          </Button>
        </div>
      </Modal>

      <Modal open={heldModalOpen} onClose={() => setHeldModalOpen(false)} title="Kutayotgan cheklar" size="md">
        {heldSales.length === 0 ? (
          <div className="text-center text-ink-400 dark:text-ink-600 py-8 text-sm">
            Kutish rejimidagi chek yo'q
          </div>
        ) : (
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {heldSales.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium text-sm text-ink-900 dark:text-ink-100">{s.uuid_label}</div>
                  <div className="text-xs text-ink-400">
                    {s.customer_name || "Chakana"} · {fmt(s.paid_amount)}/{fmt(s.total_amount)}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={resumingId === s.id}
                  disabled={!!saleId}
                  onClick={() => resumeHeldSale(s.id)}
                >
                  Davom ettirish
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
