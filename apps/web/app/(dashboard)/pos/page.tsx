"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, Minus, Trash2, ShoppingCart, ScanLine, Scale } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
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
type Cashbox = { id: number; name: string };

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function PosPage() {
  const t = useTranslations("ui");
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Cart[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [cashboxId, setCashboxId] = useState<number | "">("");
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [scaleConnected, setScaleConnected] = useState(false);
  const [scaleWeight, setScaleWeight] = useState<number | null>(null);
  const [disconnectScale, setDisconnectScale] = useState<(() => void) | null>(null);

  async function loadProducts(search: string) {
    const p = new URLSearchParams();
    p.set("limit", "30");
    if (search) p.set("q", search);
    setProducts(
      (await api.get<Product[]>(`/warehouse/products?${p}`)).data
    );
  }

  useEffect(() => {
    loadProducts("");
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
  }, []);

  function addToCart(p: Product, qty: number = 1) {
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

  // Barcode scanner — HID keyboard-wedge style
  useBarcodeScanner(async (barcode) => {
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
  function chgQty(id: string, delta: number) {
    setCart((c) =>
      c
        .map((x) =>
          x.product.id === id ? { ...x, qty: Math.max(0, x.qty + delta) } : x
        )
        .filter((x) => x.qty > 0)
    );
  }
  function removeCart(id: string) {
    setCart((c) => c.filter((x) => x.product.id !== id));
  }

  const total = cart.reduce(
    (s, c) => s + Number(c.product.sale_price) * c.qty,
    0
  );

  async function checkout() {
    if (cart.length === 0) {
      toast.error(t("ui__корзина_пуста_bf65d9bd"));
      return;
    }
    if (!warehouseId || !cashboxId) {
      toast.error(t("ui__выберите_склад_и_кассу_6445f691"));
      return;
    }
    try {
      const payload = {
        sale_date: new Date().toISOString().slice(0, 10),
        warehouse_id: warehouseId,
        cashbox_id: cashboxId,
        customer_id: customerId || null,
        status: "completed",
        items: cart.map((c) => ({
          product_id: c.product.id,
          quantity: c.qty,
          price: Number(c.product.sale_price),
        })),
      };
      const { data } = await api.post("/sale/sales", payload);
      toast.success(`Sotuv №${data.doc_number || data.id.slice(0, 8)}`);
      setCart([]);
      setCustomerId("");
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__pos_касса_a8ec6dab")} description={t("ui__быстрая_продажа_8922faf4")} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__склад_e8bf999f")}
          </label>
          <select
            className={input}
            value={warehouseId}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md" className="md:col-span-2">
          {/* Device toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
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
                Tarozi:{" "}
                <span className="font-mono font-bold">
                  {scaleWeight !== null ? `${scaleWeight.toFixed(3)} kg` : "0.000 kg"}
                </span>
                <button type="button" onClick={disconnectScaleNow} className="ml-1 hover:underline">
                  uzish
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="xs"
                icon={Scale}
                onClick={connectScale}
                title="Elektron tarozini USB-Serial orqali ulash"
              >
                Tarozini ulash
              </Button>
            )}
          </div>

          <div className="relative mb-3">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <input
              className={`${input} pl-9`}
              placeholder={t("ui__поиск_товара_название_штрих_ко_8537959b")}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                loadProducts(e.target.value);
              }}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[60vh] overflow-auto">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addToCart(p)}
                className="text-left p-3 border border-ink-200 dark:border-ink-800 rounded-md hover:border-brand-400 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20"
              >
                <div className="text-xs text-ink-500 dark:text-ink-400">
                  {p.sku || "—"}
                </div>
                <div className="font-medium text-sm text-ink-900 dark:text-ink-100 line-clamp-2">
                  {p.name}
                </div>
                <div className="font-mono font-semibold text-brand-700 dark:text-brand-400 mt-1">
                  {fmt(p.sale_price)} {p.currency_code || ""}
                </div>
                {!p.is_service && (
                  <div className="text-xs text-ink-500 dark:text-ink-400 mt-1">
                    Ост: {fmt(p.total_stock)}
                  </div>
                )}
              </button>
            ))}
            {products.length === 0 && (
              <div className="col-span-full text-center text-ink-400 dark:text-ink-600 py-12">
                {t("ui__товары_не_найдены_42190736")}
              </div>
            )}
          </div>
        </Card>

        <Card padding="md" className="h-fit sticky top-4">
          <div className="flex items-center gap-2 mb-3 text-ink-900 dark:text-ink-100">
            <ShoppingCart size={18} />
            <h3 className="font-semibold">Корзина ({cart.length})</h3>
          </div>
          {cart.length === 0 ? (
            <div className="text-center text-ink-400 dark:text-ink-600 py-12">
              {t("ui__пусто_e5b328b4")}
            </div>
          ) : (
            <>
              <ul className="space-y-2 max-h-[40vh] overflow-auto">
                {cart.map((c) => (
                  <li
                    key={c.product.id}
                    className="border border-ink-200 dark:border-ink-800 rounded-md p-2"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="text-sm font-medium text-ink-900 dark:text-ink-100 flex-1 line-clamp-2">
                        {c.product.name}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        icon={Trash2}
                        onClick={() => removeCart(c.product.id)}
                        className="text-danger-600 dark:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/15"
                      />
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          icon={Minus}
                          onClick={() => chgQty(c.product.id, -1)}
                        />
                        <span className="font-mono px-2 text-sm text-ink-900 dark:text-ink-100">
                          {c.qty}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          icon={Plus}
                          onClick={() => chgQty(c.product.id, +1)}
                        />
                      </div>
                      <span className="font-mono font-semibold text-sm text-ink-900 dark:text-ink-100">
                        {fmt(Number(c.product.sale_price) * c.qty)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-ink-200 dark:border-ink-800 pt-3 mt-3 space-y-2">
                <div className="flex justify-between text-lg font-bold text-ink-900 dark:text-ink-100">
                  <span>{t("ui__итого_edcf3920")}</span>
                  <span className="font-mono">{fmt(total)}</span>
                </div>
                <Button variant="success" size="lg" fullWidth onClick={checkout}>
                  {t("ui__оплатить_4caffb2a")}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
