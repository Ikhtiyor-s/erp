"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

type Supply = {
  id: string; doc_number: string; supply_date: string;
  total_amount: string; status: string;
  supplier_name?: string; warehouse_name?: string;
};
type Supplier = { id: string; name: string };
type Warehouse = { id: number; name: string };
type Product = { id: string; name: string; purchase_price: string };

type Line = { product_id: string; quantity: number; price: number };

const today = () => new Date().toISOString().slice(0, 10);
const empty = () => ({
  supplier_id: "", warehouse_id: null as number | null,
  supply_date: today(), notes: "", mode: "immediate" as "immediate" | "draft",
  items: [{ product_id: "", quantity: 1, price: 0 }] as Line[],
});

export default function PurchasesPage() {
  const t = useTranslations("ui");
  const router = useRouter();
  const [rows, setRows] = useState<Supply[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ReturnType<typeof empty>>(empty());

  async function load() {
    setLoading(true);
    try { setRows((await api.get<Supply[]>("/supplier/supplies")).data); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    Promise.all([
      api.get<Supplier[]>("/supplier/suppliers").then((r) => setSuppliers(r.data)).catch(() => {}),
      api.get<Warehouse[]>("/warehouse/warehouses").then((r) => setWarehouses(r.data)).catch(() => {}),
      api.get<Product[]>("/warehouse/products?limit=200").then((r) => setProducts(r.data)).catch(() => {}),
    ]);
    load();
  }, []);

  function addLine() {
    setForm({ ...form, items: [...form.items, { product_id: "", quantity: 1, price: 0 }] });
  }
  function removeLine(idx: number) {
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  }
  function setLine(idx: number, k: keyof Line, v: any) {
    const items = [...form.items];
    (items[idx] as any)[k] = v;
    if (k === "product_id") {
      const p = products.find((x) => x.id === v);
      if (p) items[idx].price = Number(p.purchase_price) || 0;
    }
    setForm({ ...form, items });
  }

  const total = form.items.reduce((s, i) => s + (i.quantity * i.price), 0);

  async function save() {
    if (!form.supplier_id) return toast.error(t("ui__выберите_поставщика_56de5b3b"));
    if (!form.warehouse_id) return toast.error(t("ui__выберите_склад_b9bc3ffe"));
    if (form.items.some((i) => !i.product_id)) return toast.error(t("ui__выберите_товар_во_всех_строках_c53b1724"));

    try {
      await api.post("/supplier/supplies", {
        supplier_id: form.supplier_id,
        warehouse_id: form.warehouse_id,
        supply_date: form.supply_date,
        notes: form.notes,
        mode: form.mode,
        items: form.items.map((i) => ({
          product_id: i.product_id,
          quantity: Number(i.quantity),
          price: Number(i.price),
        })),
      });
      toast.success(t("ui__поступление_создано_0bd13714"));
      setOpen(false); setForm(empty()); load();
    } catch (e: any) { toast.error(getErrorMessage(e, "Xato")); }
  }

  const columns: Column<Supply>[] = [
    {
      key: "doc_number",
      header: "№",
      width: "120px",
      render: (r) => r.doc_number || r.id.slice(0, 8),
    },
    {
      key: "supply_date",
      header: t("ui__дата_8cdd8bb7"),
      width: "120px",
      render: (r) => new Date(r.supply_date).toLocaleDateString("ru-RU"),
    },
    {
      key: "supplier_name",
      header: t("ui__поставщик_b8fbf748"),
      render: (r) => r.supplier_name || "—",
    },
    {
      key: "warehouse_name",
      header: t("ui__склад_e8bf999f"),
      width: "180px",
      render: (r) => r.warehouse_name || "—",
    },
    {
      key: "total_amount",
      header: t("ui__сумма_cf59ebf9"),
      align: "right",
      width: "160px",
      render: (r) => (
        <span className="font-mono text-ink-900 dark:text-ink-100">
          {Number(r.total_amount).toLocaleString("ru-RU", {
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: "status",
      header: t("ui__статус_7203f7a4"),
      align: "center",
      width: "140px",
      render: (r) =>
        r.status === "received" ? (
          <Badge tone="success">{t("ui__принято_713e9366")}</Badge>
        ) : r.status === "cancelled" ? (
          <Badge tone="danger">{t("ui__отменено_81a04dab")}</Badge>
        ) : r.status === "partially_received" ? (
          <Badge tone="warning">Qisman qabul qilindi</Badge>
        ) : r.status === "draft" ? (
          <Badge tone="neutral">Qoralama</Badge>
        ) : (
          <Badge tone="neutral">{r.status}</Badge>
        ),
    },
    {
      key: "id" as any,
      header: "",
      align: "center",
      width: "50px",
      render: (r) => (
        <button
          onClick={() => router.push(`/supply/purchases/${r.id}`)}
          className="text-brand-600 hover:text-brand-700 dark:text-brand-400"
          title="Ko'rish"
          aria-label="Xaridni ko'rish"
        >
          <Eye size={14} aria-hidden="true" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__покупки_поступления_837aa685")} description={t("ui__прием_товаров_от_поставщиков_a3a7f235")}
        onCreate={() => { setForm(empty()); setOpen(true); }} createLabel={t("ui__новое_поступление_02990846")} />
      <DataTable columns={columns} rows={rows} loading={loading} />

      <Modal open={open} onClose={() => setOpen(false)} title={t("ui__новое_поступление_02990846")} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <Field label={t("ui__поставщик_b8fbf748")} required>
              <select className={input} value={form.supplier_id}
                onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">{t("ui__выбрать_fbbc1d13")}</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label={t("ui__склад_e8bf999f")} required>
              <select className={input} value={form.warehouse_id || ""}
                onChange={(e) => setForm({ ...form, warehouse_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">{t("ui__выбрать_fbbc1d13")}</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            <Field label={t("ui__дата_8cdd8bb7")}>
              <input type="date" className={input} value={form.supply_date}
                onChange={(e) => setForm({ ...form, supply_date: e.target.value })} />
            </Field>
            <Field label="Qabul rejimi">
              <select className={input} value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value as "immediate" | "draft" })}>
                <option value="immediate">To'liq qabul (darhol)</option>
                <option value="draft">Bosqichma-bosqich (keyin qabul qilinadi)</option>
              </select>
            </Field>
          </div>

          <div className="border border-ink-200 dark:border-ink-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-900/40 text-ink-700 dark:text-ink-300">
                <tr>
                  <th className="text-left px-3 py-2">{t("ui__товар_8b35db64")}</th>
                  <th className="text-right px-3 py-2 w-28">{t("ui__количество_cb8bfd4d")}</th>
                  <th className="text-right px-3 py-2 w-32">{t("ui__цена_682fa8db")}</th>
                  <th className="text-right px-3 py-2 w-32">{t("ui__сумма_cf59ebf9")}</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((it, idx) => (
                  <tr key={idx} className="border-t border-ink-200 dark:border-ink-800">
                    <td className="px-3 py-2">
                      <select className={input} value={it.product_id}
                        onChange={(e) => setLine(idx, "product_id", e.target.value)}>
                        <option value="">{t("ui__товар_8c2c36d6")}</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.001" className={`${input} text-right`}
                        value={it.quantity} onChange={(e) => setLine(idx, "quantity", Number(e.target.value))} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" className={`${input} text-right`}
                        value={it.price} onChange={(e) => setLine(idx, "price", Number(e.target.value))} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(it.quantity * it.price).toLocaleString("ru")}
                    </td>
                    <td className="text-center">
                      <button onClick={() => removeLine(idx)} className="text-danger-600 dark:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/15 p-1 rounded">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-ink-50 dark:bg-ink-900/40 font-semibold">
                  <td className="px-3 py-2" colSpan={3}>{t("ui__итого_edcf3920")}</td>
                  <td className="px-3 py-2 text-right">{total.toLocaleString("ru")}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <button onClick={addLine} className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300">
            <Plus size={14} /> {t("ui__добавить_строку_d70236f2")}
          </button>

          <Field label={t("ui__заметки_c8866295")}>
            <textarea className={input} rows={2} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-ink-200 dark:border-ink-800">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("ui__отмена_987b33c6")}</Button>
            <Button type="button" onClick={save}>{t("ui__принять_5dc5ad80")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
