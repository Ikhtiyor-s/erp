"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type PO = {
  id: string;
  doc_number: number;
  order_date: string;
  expected_date?: string;
  status: string;
  total_amount: string;
  notes?: string;
  supplier_id: string;
  supplier_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
};
type Supplier = { id: string; name: string };
type Warehouse = { id: number; name: string };
type Product = { id: string; name: string; purchase_price: string };

type Line = { product_id: string; quantity: number; price: number };

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

const statusLabel = (s: string) =>
  ({ new: "Yangi", sent: "Yuborildi", received: "Olindi", cancelled: "Bekor qilindi" }[s] || s);
const statusColor = (s: string) =>
  ({
    new: "text-slate-700 dark:text-slate-300",
    sent: "text-yellow-700 dark:text-yellow-400",
    received: "text-green-700 dark:text-green-400",
    cancelled: "text-red-700 dark:text-red-400",
  }[s] || "");

export default function PurchaseOrderPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: "", status: "" });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    supplier_id: "",
    warehouse_id: "" as number | "",
    expected_date: "",
    notes: "",
    items: [{ product_id: "", quantity: 1, price: 0 }] as Line[],
  });

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.q) p.set("q", filters.q);
      if (filters.status) p.set("status", filters.status);
      const qs = p.toString();
      setRows(
        (await api.get<PO[]>(`/supplier/purchase-orders${qs ? "?" + qs : ""}`)).data
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([
      api.get<Supplier[]>("/supplier/suppliers").then((r) => setSuppliers(r.data)),
      api.get<Warehouse[]>("/warehouse/warehouses").then((r) => setWarehouses(r.data)),
      api.get<Product[]>("/warehouse/products?limit=500").then((r) => setProducts(r.data)),
    ]).catch(() => {});
    load();
  }, []);

  function setLine(idx: number, k: keyof Line, v: any) {
    const n = [...form.items];
    (n[idx] as any)[k] = v;
    if (k === "product_id") {
      const p = products.find((x) => x.id === v);
      if (p) n[idx].price = Number(p.purchase_price) || 0;
    }
    setForm({ ...form, items: n });
  }

  async function save() {
    if (!form.supplier_id) {
      toast.error(t("ui__����������������_��������������������_56de5b3b"));
      return;
    }
    const items = form.items
      .filter((i) => i.product_id && Number(i.quantity) > 0)
      .map((i) => ({
        product_id: i.product_id,
        quantity: Number(i.quantity),
        price: Number(i.price) || 0,
      }));
    if (items.length === 0) {
      toast.error(t("ui__����������������_������������_959fc936"));
      return;
    }
    try {
      await api.post("/supplier/purchase-orders", {
        supplier_id: form.supplier_id,
        warehouse_id: form.warehouse_id || null,
        expected_date: form.expected_date || null,
        notes: form.notes || null,
        items,
      });
      toast.success(t("ui__����������_������������_4dc0ec43"));
      setOpen(false);
      setForm({
        supplier_id: "",
        warehouse_id: "",
        expected_date: "",
        notes: "",
        items: [{ product_id: "", quantity: 1, price: 0 }],
      });
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  async function setStatus(r: PO, status: string) {
    try {
      await api.put(`/supplier/purchase-orders/${r.id}/status?status=${status}`);
      toast.success(t("ui__������������_����������������_60431b86"));
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  async function del(r: PO) {
    if (!confirm(`Ariza ���${r.doc_number} o'chirilsinmi?`)) return;
    await api.delete(`/supplier/purchase-orders/${r.id}`);
    toast.success(t("ui__��������������_0c450c40"));
    load();
  }

  const cols: Column<PO>[] = [
    { key: "doc_number", header: "���", width: "90px" },
    {
      key: "order_date",
      header: t("ui__��������_8cdd8bb7"),
      width: "130px",
      render: (r) => new Date(r.order_date).toLocaleDateString("ru-RU"),
    },
    { key: "supplier_name", header: t("ui__������������������_b8fbf748"), render: (r) => r.supplier_name || "���" },
    {
      key: "warehouse_name",
      header: t("ui__����������_e8bf999f"),
      width: "180px",
      render: (r) => r.warehouse_name || "���",
    },
    {
      key: "expected_date",
      header: t("ui__������������������_ddd06519"),
      width: "130px",
      render: (r) =>
        r.expected_date ? new Date(r.expected_date).toLocaleDateString("ru-RU") : "���",
    },
    {
      key: "total_amount",
      header: t("ui__����������_cf59ebf9"),
      align: "right",
      width: "150px",
      render: (r) => (
        <span className="font-mono text-slate-900 dark:text-slate-100">
          {fmt(r.total_amount)}
        </span>
      ),
    },
    {
      key: "status",
      header: t("ui__������������_7203f7a4"),
      width: "150px",
      render: (r) => (
        <select
          value={r.status}
          onChange={(e) => setStatus(r, e.target.value)}
          className={`${statusColor(r.status)} bg-transparent border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs`}
        >
          <option value="new">{statusLabel("new")}</option>
          <option value="sent">{statusLabel("sent")}</option>
          <option value="received">{statusLabel("received")}</option>
          <option value="cancelled">{statusLabel("cancelled")}</option>
        </select>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__����������_����_����������_47afbc85")}
        description={t("ui__������������_����_����������_��_����������������������_7c3a0b4e")}
        onCreate={() => setOpen(true)}
        createLabel={t("ui__����������_������������_3527f981")}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__����������_������_������������������_c853540d")}
          </label>
          <Search size={14} className="absolute left-2.5 top-[34px] text-slate-400" />
          <input
            className={`${input} pl-8`}
            placeholder={t("ui__����������_b84a8f87")}
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__������������_7203f7a4")}
          </label>
          <select
            className={input}
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">{t("ui__������_a07b234e")}</option>
            <option value="new">{t("ui__����������_97ae6e0b")}</option>
            <option value="sent">{t("ui__������������������_8496c7e8")}</option>
            <option value="received">{t("ui__��������������_47fb375d")}</option>
            <option value="cancelled">{t("ui__��������������_79dcd7ca")}</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={load}
            className="w-full px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700 whitespace-nowrap"
          >
            {t("ui__������������_2f884b41")}
          </button>
        </div>
      </div>

      <DataTable columns={cols} rows={rows} loading={loading} onDelete={del} />

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={t("ui__����������_������������_����_����������_05f9d30d")}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label={t("ui__������������������_b8fbf748")} required>
              <select
                className={input}
                value={form.supplier_id}
                onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
              >
                <option value="">{t("ui__��������������_fbbc1d13")}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("ui__����������_e8bf999f")}>
              <select
                className={input}
                value={form.warehouse_id || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    warehouse_id: e.target.value ? Number(e.target.value) : "",
                  })
                }
              >
                <option value="">{t("ui__������_7b07413e")}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("ui__������������������_��������_985a37d2")}>
              <input
                type="date"
                className={input}
                value={form.expected_date}
                onChange={(e) => setForm({ ...form, expected_date: e.target.value })}
              />
            </Field>
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2">{t("ui__����������_8b35db64")}</th>
                  <th className="text-right px-3 py-2 w-28">{t("ui__������_����_302e2bd6")}</th>
                  <th className="text-right px-3 py-2 w-32">{t("ui__��������_������������_9ae1384c")}</th>
                  <th className="text-right px-3 py-2 w-32">{t("ui__����������_cf59ebf9")}</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((it, idx) => (
                  <tr key={idx} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-3 py-2">
                      <select
                        className={input}
                        value={it.product_id}
                        onChange={(e) => setLine(idx, "product_id", e.target.value)}
                      >
                        <option value="">{t("ui__����������_8c2c36d6")}</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.001"
                        value={it.quantity}
                        onChange={(e) => setLine(idx, "quantity", e.target.value)}
                        className="w-24 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={it.price}
                        onChange={(e) => setLine(idx, "price", e.target.value)}
                        className="w-28 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-slate-100">
                      {fmt(Number(it.quantity) * Number(it.price))}
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() =>
                          setForm({
                            ...form,
                            items: form.items.filter((_, i) => i !== idx),
                          })
                        }
                        className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() =>
                setForm({
                  ...form,
                  items: [...form.items, { product_id: "", quantity: 1, price: 0 }],
                })
              }
              className="text-xs text-brand-600 dark:text-brand-400 px-3 py-2 inline-flex items-center gap-1"
            >
              <Plus size={12} /> {t("ui__����������������_������������_d70236f2")}
            </button>
          </div>

          <Field label={t("ui__��������������_c8866295")}>
            <textarea
              className={input}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              {t("ui__������������_987b33c6")}
            </button>
            <button
              onClick={save}
              className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700"
            >
              {t("ui__������������������_74ea58b6")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
