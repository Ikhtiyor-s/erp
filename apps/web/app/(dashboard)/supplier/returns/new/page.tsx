"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { Field, input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";

type Supplier = { id: string; name: string };
type Warehouse = { id: number; name: string };
type Purchase = { id: string; doc_number: string };
type Product = { id: string; name: string; purchase_price: string };

type Item = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
};

type RefundMethod = "cash_refund" | "supplier_balance" | "replacement";

function emptyForm() {
  return {
    supplier_id: "",
    warehouse_id: null as number | null,
    original_purchase_id: null as string | null,
    reason: "",
    refund_method: "supplier_balance" as RefundMethod,
    items: [] as Item[],
  };
}

export default function NewSupplierReturnPage() {
  const t = useTranslations("supplier.returns");
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Supplier[]>("/supplier/suppliers").then((r) => setSuppliers(r.data)).catch(() => {});
    api.get<Warehouse[]>("/warehouse/warehouses").then((r) => setWarehouses(r.data)).catch(() => {});
    api.get<Product[]>("/warehouse/products?limit=500").then((r) => setProducts(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.supplier_id) { setPurchases([]); return; }
    api.get<Purchase[]>(`/supplier/supplies?supplier_id=${form.supplier_id}&limit=100`)
      .then((r) => {
        const data = Array.isArray(r.data) ? r.data : (r.data as any)?.items ?? [];
        setPurchases(data);
      })
      .catch(() => setPurchases([]));
  }, [form.supplier_id]);

  const totalAmount = form.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);

  function addItem() {
    setForm((f) => ({
      ...f,
      items: [...f.items, { product_id: "", product_name: "", quantity: 1, unit_cost: 0 }],
    }));
  }

  function removeItem(idx: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  function setItemField(idx: number, key: keyof Item, value: string | number) {
    setForm((f) => {
      const items = [...f.items];
      if (key === "product_id") {
        const p = products.find((x) => x.id === value);
        items[idx] = {
          ...items[idx],
          product_id: value as string,
          product_name: p?.name ?? "",
          unit_cost: p ? Number(p.purchase_price) || 0 : items[idx].unit_cost,
        };
      } else {
        (items[idx] as any)[key] = value;
      }
      return { ...f, items };
    });
  }

  async function save() {
    if (!form.supplier_id) return toast.error(t("validation_supplier"));
    if (!form.warehouse_id) return toast.error(t("validation_warehouse"));
    if (form.items.length === 0) return toast.error(t("validation_items"));
    if (form.items.some((i) => !i.product_id || i.quantity <= 0))
      return toast.error(t("validation_item_fields"));

    setSaving(true);
    try {
      const payload = {
        supplier_id: form.supplier_id,
        warehouse_id: form.warehouse_id,
        original_purchase_id: form.original_purchase_id || null,
        reason: form.reason,
        refund_method: form.refund_method,
        items: form.items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
        })),
      };
      const res = await api.post<{ id: string }>("/warehouse/supplier-returns", payload);
      toast.success(t("saved"));
      router.push(`/supplier/returns/${res.data.id}`);
    } catch (e) {
      toast.error(getErrorMessage(e, t("error_save")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/supplier/returns")}
          className="p-1.5 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-600 dark:text-ink-400 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-ink-900 dark:text-ink-100">{t("create")}</h1>
          <p className="text-[13px] text-ink-500">{t("description")}</p>
        </div>
      </div>

      {/* Main fields */}
      <div className="rounded-lg border border-ink-200 dark:border-ink-800 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("col_supplier")} required>
            <select
              className={input}
              value={form.supplier_id}
              onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value, original_purchase_id: null }))}
            >
              <option value="">— {t("select_placeholder")} —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>

          <Field label={t("col_warehouse")} required>
            <select
              className={input}
              value={form.warehouse_id ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value ? Number(e.target.value) : null }))}
            >
              <option value="">— {t("select_placeholder")} —</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>

          <Field label={t("original_purchase")}>
            <select
              className={input}
              value={form.original_purchase_id ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, original_purchase_id: e.target.value || null }))}
              disabled={!form.supplier_id}
            >
              <option value="">— {t("optional")} —</option>
              {purchases.map((p) => <option key={p.id} value={p.id}>{p.doc_number || p.id.slice(0, 8)}</option>)}
            </select>
          </Field>

          <Field label={t("refund_method")} required>
            <select
              className={input}
              value={form.refund_method}
              onChange={(e) => setForm((f) => ({ ...f, refund_method: e.target.value as RefundMethod }))}
            >
              <option value="cash_refund">{t("refund_cash")}</option>
              <option value="supplier_balance">{t("refund_balance")}</option>
              <option value="replacement">{t("refund_replacement")}</option>
            </select>
          </Field>
        </div>

        <Field label={t("reason")}>
          <textarea
            className={input}
            rows={3}
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder={t("reason_placeholder")}
          />
        </Field>
      </div>

      {/* Items table */}
      <div className="rounded-lg border border-ink-200 dark:border-ink-800 overflow-hidden">
        <div className="px-4 py-3 bg-ink-50 dark:bg-ink-900/40 border-b border-ink-200 dark:border-ink-800">
          <h3 className="text-[14px] font-semibold text-ink-900 dark:text-ink-100">{t("items")}</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-ink-50/60 dark:bg-ink-900/20">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-ink-600 dark:text-ink-400">{t("col_product")}</th>
                <th className="text-right px-4 py-2.5 font-medium text-ink-600 dark:text-ink-400 w-32">{t("col_qty")}</th>
                <th className="text-right px-4 py-2.5 font-medium text-ink-600 dark:text-ink-400 w-36">{t("col_unit_cost")}</th>
                <th className="text-right px-4 py-2.5 font-medium text-ink-600 dark:text-ink-400 w-36">{t("col_total")}</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200/60 dark:divide-ink-800/60">
              {form.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-400 text-[13px]">
                    {t("items_empty_hint")}
                  </td>
                </tr>
              )}
              {form.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2">
                    <select
                      className={input}
                      value={item.product_id}
                      onChange={(e) => setItemField(idx, "product_id", e.target.value)}
                    >
                      <option value="">— {t("select_placeholder")} —</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      className={`${input} text-right`}
                      value={item.quantity}
                      onChange={(e) => setItemField(idx, "quantity", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={`${input} text-right`}
                      value={item.unit_cost}
                      onChange={(e) => setItemField(idx, "unit_cost", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-ink-900 dark:text-ink-100">
                    {(item.quantity * item.unit_cost).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => removeItem(idx)}
                      className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 p-1 rounded transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-ink-50 dark:bg-ink-900/40 font-semibold">
                <td className="px-4 py-3" colSpan={3}>{t("total_refund")}</td>
                <td className="px-4 py-3 text-right font-mono text-ink-900 dark:text-ink-100">
                  {totalAmount.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-ink-200 dark:border-ink-800">
          <button
            onClick={addItem}
            className="inline-flex items-center gap-1.5 text-[13px] text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
          >
            <Plus size={14} /> {t("add_item")}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.push("/supplier/returns")}
          className="px-4 py-2 text-sm rounded-md border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"
        >
          {t("btn_cancel")}
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60 transition-colors"
        >
          {saving ? t("saving") : t("btn_save_draft")}
        </button>
      </div>
    </div>
  );
}
