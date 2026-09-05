"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Modal, Field, input } from "@/components/ui/modal";

type Warehouse = { id: number; name: string };
type Reason = { id: number; name: string; code: string | null; is_active: boolean };
type Product = { id: string; name: string; sku?: string };

type LineItem = {
  product_id: string;
  product_name: string;
  quantity: string;
  unit_cost: string;
};

export default function StockInNewPage() {
  const t = useTranslations("warehouse.stock_in");
  const router = useRouter();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [reasonId, setReasonId] = useState<number | "">("");
  const [reasonText, setReasonText] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Warehouse[]>("/warehouse/warehouses").then((r) => setWarehouses(r.data)).catch(() => {});
    api.get<Reason[]>("/warehouse/stock-in-reasons").then((r) => setReasons(r.data.filter((r) => r.is_active))).catch(() => {});
  }, []);

  useEffect(() => {
    if (productSearch.length < 2) { setProductOptions([]); return; }
    const timer = setTimeout(() => {
      api.get<Product[]>(`/warehouse/products?q=${encodeURIComponent(productSearch)}`)
        .then((r) => setProductOptions(Array.isArray(r.data) ? r.data.slice(0, 10) : []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [productSearch]);

  function addItem(p: Product) {
    if (items.some((i) => i.product_id === p.id)) return;
    setItems((prev) => [...prev, { product_id: p.id, product_name: p.name, quantity: "1", unit_cost: "" }]);
    setProductSearch("");
    setProductOptions([]);
  }

  function updateItem(idx: number, field: keyof LineItem, value: string) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!warehouseId) { toast.error(t("validation_warehouse")); return; }
    if (!reasonId) { toast.error(t("validation_reason")); return; }
    if (items.length === 0) { toast.error(t("validation_items")); return; }

    setSaving(true);
    try {
      const payload = {
        warehouse_id: Number(warehouseId),
        reason_id: Number(reasonId),
        reason_text: reasonText || null,
        notes: notes || null,
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: Number(i.quantity) || 0,
          unit_cost: i.unit_cost ? Number(i.unit_cost) : null,
        })).filter((i) => i.quantity > 0),
      };
      const { data } = await api.post<{ id: string; doc_number: string }>("/warehouse/stock-ins", payload);
      toast.success(t("saved"));
      router.push(`/warehouse/stock-in/${data.id}`);
    } catch (e) {
      toast.error(getErrorMessage(e, t("error_load")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title={t("create")} />

      <div className="bg-white dark:bg-ink-950 rounded-md border border-ink-200/60 dark:border-ink-800/60 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("warehouse_label")} required>
            <select
              className={input}
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">{t("warehouse_placeholder")}</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>

          <Field label={t("reason_label")} required>
            <select
              className={input}
              value={reasonId}
              onChange={(e) => setReasonId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">{t("reason_placeholder")}</option>
              {reasons.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
        </div>

        <Field label={t("reason_text_label")}>
          <input
            className={input}
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder={t("notes_placeholder")}
          />
        </Field>

        <Field label={t("notes_label")}>
          <textarea
            className={`${input} resize-none`}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("notes_placeholder")}
          />
        </Field>
      </div>

      <div className="bg-white dark:bg-ink-950 rounded-md border border-ink-200/60 dark:border-ink-800/60 p-5 space-y-4">
        <h2 className="text-[14px] font-semibold text-ink-800 dark:text-ink-100">{t("items")}</h2>

        <div className="relative">
          <input
            className={input}
            placeholder={t("product_search")}
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
          />
          {productOptions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-md shadow-lg max-h-48 overflow-auto">
              {productOptions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addItem(p)}
                  className="block w-full text-left px-3 py-2 text-[13px] hover:bg-ink-50 dark:hover:bg-ink-800"
                >
                  {p.name}
                  {p.sku && <span className="text-ink-400 ml-1">({p.sku})</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border border-ink-200 dark:border-ink-700 rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-ink-50 dark:bg-ink-900">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-ink-600 dark:text-ink-400">{t("col_product")}</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-600 dark:text-ink-400 w-32">{t("qty")}</th>
                    <th className="px-3 py-2 text-right font-medium text-ink-600 dark:text-ink-400 w-36">{t("col_unit_cost")}</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.product_id} className="border-t border-ink-100 dark:border-ink-800">
                      <td className="px-3 py-2">{item.product_name}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                          className="w-28 border border-ink-200 dark:border-ink-700 rounded px-2 py-1 text-right text-[13px] focus:outline-none focus:border-brand-500 bg-white dark:bg-ink-950"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_cost}
                          onChange={(e) => updateItem(idx, "unit_cost", e.target.value)}
                          placeholder="—"
                          className="w-32 border border-ink-200 dark:border-ink-700 rounded px-2 py-1 text-right text-[13px] focus:outline-none focus:border-brand-500 bg-white dark:bg-ink-950"
                        />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {items.length === 0 && (
          <p className="text-[13px] text-ink-400 dark:text-ink-600">{t("validation_items")}</p>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => router.push("/warehouse/stock-in")}
          className="px-4 py-2 text-[13px] rounded-md border border-ink-300 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800"
        >
          {t("cancel_label")}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 text-[13px] rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? t("loading") : t("btn_save_draft")}
        </button>
      </div>
    </div>
  );
}
