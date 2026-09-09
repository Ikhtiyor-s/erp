"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

type Row = {
  id: number; warehouse_id: number; product_id: string;
  warehouse_name: string; product_name: string;
  min_qty: string; max_qty?: string; current_qty: string; below_min: boolean;
  supplier_id?: string | null; supplier_name?: string | null;
  last_purchase_price?: string | null;
};
type Wh = { id: number; name: string };
type Product = { id: string; name: string; sku?: string };
type Supplier = { id: string; name: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });

export default function RecommendedStockPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Row[]>([]);
  const [warehouses, setWarehouses] = useState<Wh[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [whFilter, setWhFilter] = useState<number | "">("");
  const [supplierFilter, setSupplierFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [confirmItem, setConfirmItem] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [creatingPo, setCreatingPo] = useState(false);

  const [whId, setWhId] = useState<number | "">("");
  const [productId, setProductId] = useState<string>("");
  const [productName, setProductName] = useState<string>("");
  const [minQty, setMinQty] = useState("0");
  const [maxQty, setMaxQty] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<Product[]>([]);

  async function load(wh?: number | "", supplierId?: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (wh) params.set("warehouse_id", String(wh));
      if (supplierId) params.set("supplier_id", supplierId);
      const qs = params.toString();
      setRows((await api.get<Row[]>(`/warehouse/recommended-stock${qs ? "?" + qs : ""}`)).data);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    api.get<Wh[]>("/warehouse/warehouses").then((r) => setWarehouses(r.data)).catch(() => {});
    api.get<Supplier[]>("/supplier/suppliers").then((r) => setSuppliers(r.data)).catch(() => {});
    load();
  }, []);

  async function createDraftPurchaseOrders() {
    const candidates = rows.filter((r) => r.below_min && r.supplier_id);
    if (candidates.length === 0) {
      toast.error("Ta'minotchisi belgilangan, minimumdan past tovar topilmadi");
      return;
    }
    const grouped = new Map<string, { supplierId: string; warehouseId: number; items: Row[] }>();
    for (const r of candidates) {
      const qty = Number(r.min_qty) - Number(r.current_qty);
      if (qty <= 0) continue;
      const key = `${r.supplier_id}:${r.warehouse_id}`;
      const g = grouped.get(key) || { supplierId: r.supplier_id!, warehouseId: r.warehouse_id, items: [] };
      g.items.push(r);
      grouped.set(key, g);
    }
    setCreatingPo(true);
    try {
      let created = 0;
      for (const { supplierId, warehouseId, items } of grouped.values()) {
        await api.post("/supplier/purchase-orders", {
          supplier_id: supplierId,
          warehouse_id: warehouseId,
          items: items.map((r) => ({
            product_id: r.product_id,
            quantity: Number(r.min_qty) - Number(r.current_qty),
            price: Number(r.last_purchase_price) || 0,
          })),
        });
        created += 1;
      }
      toast.success(`${created} ta zakupka arizasi (draft) yaratildi`);
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setCreatingPo(false);
    }
  }

  useEffect(() => {
    if (productSearch.length < 2) { setProductOptions([]); return; }
    const t = setTimeout(() => {
      api.get<Product[]>(`/warehouse/products?q=${encodeURIComponent(productSearch)}`)
        .then((r) => setProductOptions(r.data.slice(0, 10))).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [productSearch]);

  async function save() {
    if (!whId || !productId) { toast.error(t("ui__выберите_склад_и_товар_f979c12b")); return; }
    try {
      await api.post("/warehouse/recommended-stock", {
        warehouse_id: Number(whId), product_id: productId,
        min_qty: Number(minQty) || 0,
        max_qty: maxQty ? Number(maxQty) : null,
      });
      toast.success(t("ui__сохранено_54a59b19"));
      setOpen(false); setProductId(""); setProductName(""); setMinQty("0"); setMaxQty("");
      load(whFilter);
    } catch (e: any) { toast.error(getErrorMessage(e, "Xato")); }
  }

  async function del(r: Row) {
    setDeleting(true);
    try {
      await api.delete(`/warehouse/recommended-stock/${r.id}`);
      toast.success(t("ui__удалено_0c450c40"));
      setConfirmItem(null);
      load(whFilter);
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setDeleting(false);
    }
  }

  const belowMinCount = rows.filter((r) => r.below_min).length;

  const columns: Column<Row>[] = [
    { key: "warehouse_name", header: t("ui__склад_e8bf999f"), width: "180px" },
    { key: "product_name", header: t("ui__товар_8b35db64") },
    { key: "current_qty", header: t("ui__сейчас_2c2777ef"), align: "right", width: "120px",
      render: (r) => (
        <span className={`font-mono ${r.below_min ? "text-danger-600 dark:text-danger-500 font-semibold" : ""}`}>
          {fmt(r.current_qty)}
          {r.below_min && <AlertTriangle size={12} className="inline ml-1" />}
        </span>
      ),
    },
    { key: "min_qty", header: t("ui__минимум_96111129"), align: "right", width: "120px",
      render: (r) => <span className="font-mono">{fmt(r.min_qty)}</span> },
    { key: "max_qty", header: t("ui__максимум_81e223a9"), align: "right", width: "120px",
      render: (r) => r.max_qty ? <span className="font-mono">{fmt(r.max_qty)}</span> : "—" },
    { key: "supplier_name", header: "Ta'minotchi", width: "180px",
      render: (r) => r.supplier_name || "—" },
    { key: "last_purchase_price", header: "Oxirgi narx", align: "right", width: "120px",
      render: (r) => r.last_purchase_price ? <span className="font-mono">{fmt(r.last_purchase_price)}</span> : "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__рекомендуемые_остатки_0de7b400")} description={t("ui__минимальный_максимальный_запас_4d1024e5")}
        onCreate={() => setOpen(true)} createLabel={t("ui__добавить_5eba283b")} />

      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-ink-600 dark:text-ink-300">{t("ui__склад_2cd219ec")}</label>
        <select className={`${input} max-w-xs`} value={whFilter}
          onChange={(e) => {
            const v = e.target.value ? Number(e.target.value) : "";
            setWhFilter(v); load(v, supplierFilter);
          }}>
          <option value="">{t("ui__все_склады_ce2fe5e2")}</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>

        <label className="text-sm text-ink-600 dark:text-ink-300">Ta'minotchi</label>
        <select className={`${input} max-w-xs`} value={supplierFilter}
          onChange={(e) => {
            const v = e.target.value;
            setSupplierFilter(v); load(whFilter, v);
          }}>
          <option value="">Barcha ta'minotchilar</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <Button variant="outline" size="sm" onClick={createDraftPurchaseOrders} disabled={creatingPo}>
          Zakupka yaratish
        </Button>

        {belowMinCount > 0 && (
          <Badge tone="danger" dot className="ml-auto">
            {t("ui__ниже_минимума_75ad865a")} {belowMinCount}
          </Badge>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onDelete={(r) => setConfirmItem(r)} />

      <Modal open={open} onClose={() => setOpen(false)} title={t("ui__добавить_рекомендацию_88a580b0")}>
        <div className="space-y-3">
          <Field label={t("ui__склад_e8bf999f")} required>
            <select className={input} value={whId} onChange={(e) => setWhId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">{t("ui__выберите_edab92dd")}</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
          <Field label={t("ui__товар_8b35db64")} required>
            <div className="relative">
              <input className={input} placeholder={productName || "Tovar qidirish..."}
                value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
              {productOptions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-md shadow-lg max-h-48 overflow-auto">
                  {productOptions.map((p) => (
                    <button key={p.id}
                      onClick={() => { setProductId(p.id); setProductName(p.name); setProductSearch(p.name); setProductOptions([]); }}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-ink-50 dark:bg-ink-900/40">
                      {p.name}{p.sku && <span className="text-ink-400"> ({p.sku})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("ui__минимум_96111129")} required>
              <input type="number" step="0.001" className={input} value={minQty}
                onChange={(e) => setMinQty(e.target.value)} />
            </Field>
            <Field label={t("ui__максимум_81e223a9")}>
              <input type="number" step="0.001" className={input} value={maxQty}
                onChange={(e) => setMaxQty(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>{t("ui__отмена_987b33c6")}</Button>
            <Button onClick={save}>{t("ui__сохранить_74ea58b6")}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmItem !== null}
        onClose={() => setConfirmItem(null)}
        onConfirm={() => { if (confirmItem) del(confirmItem); }}
        title={t("ui__удалить_запись_12469355")}
        message={`«${confirmItem?.product_name}» tavsiyasi o'chirilsinmi?`}
        confirmLabel={t("ui__удалить_ed2bbfbc")}
        loading={deleting}
      />
    </div>
  );
}
