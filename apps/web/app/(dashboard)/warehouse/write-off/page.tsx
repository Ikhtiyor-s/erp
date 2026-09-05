"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type WO = {
  id: string; doc_number?: string; write_off_date: string;
  total_amount: string; warehouse_name?: string; reason_name?: string;
};
type Wh = { id: number; name: string };
type Reason = { id: number; name: string };
type Product = { id: string; name: string; sku?: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

export default function WriteOffPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<WO[]>([]);
  const [warehouses, setWarehouses] = useState<Wh[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<any | null>(null);

  const [whId, setWhId] = useState<number | "">("");
  const [reasonId, setReasonId] = useState<number | "">("");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ product_id: string; product_name: string; quantity: string }[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<Product[]>([]);

  async function load() {
    setLoading(true);
    try { setRows((await api.get<WO[]>("/warehouse/write-offs")).data); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    Promise.all([
      api.get<Wh[]>("/warehouse/warehouses").then((r) => setWarehouses(r.data)),
      api.get<Reason[]>("/warehouse/write-off-reasons").then((r) => setReasons(r.data)),
    ]).catch(() => {});
    load();
  }, []);

  useEffect(() => {
    if (productSearch.length < 2) { setProductOptions([]); return; }
    const t = setTimeout(() => {
      api.get<Product[]>(`/warehouse/products?q=${encodeURIComponent(productSearch)}`)
        .then((r) => setProductOptions(r.data.slice(0, 10))).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [productSearch]);

  function addItem(p: Product) {
    if (items.some((i) => i.product_id === p.id)) return;
    setItems([...items, { product_id: p.id, product_name: p.name, quantity: "1" }]);
    setProductSearch(""); setProductOptions([]);
  }

  async function create() {
    if (!whId || items.length === 0) { toast.error(t("ui__заполните_склад_и_товары_8cd8f90a")); return; }
    try {
      const payload = {
        warehouse_id: Number(whId),
        reason_id: reasonId || null,
        write_off_date: date,
        notes,
        items: items.map((i) => ({ product_id: i.product_id, quantity: Number(i.quantity) || 0 }))
          .filter((i) => i.quantity > 0),
      };
      const { data } = await api.post("/warehouse/write-offs", payload);
      toast.success(`${fmt(data.total_amount)} summasiga hisobdan chiqarildi`);
      setOpen(false); setItems([]); setWhId(""); setReasonId(""); setNotes(""); load();
    } catch (e: any) { toast.error(getErrorMessage(e, "Xato")); }
  }

  async function openView(r: WO) {
    const { data } = await api.get(`/warehouse/write-offs/${r.id}`);
    setView(data);
  }

  const columns: Column<WO>[] = [
    { key: "doc_number", header: "���", render: (r) => r.doc_number || r.id.slice(0, 8), width: "100px" },
    { key: "write_off_date", header: t("ui__дата_8cdd8bb7"), width: "120px" },
    { key: "warehouse_name", header: t("ui__склад_e8bf999f") },
    { key: "reason_name", header: t("ui__причина_d88300c7"), render: (r) => r.reason_name || "���" },
    { key: "total_amount", header: t("ui__сумма_cf59ebf9"), align: "right", width: "150px",
      render: (r) => <span className="font-mono">{fmt(r.total_amount)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__списания_bb8d994e")} description={t("ui__документы_списания_товаров_199109f1")}
        onCreate={() => setOpen(true)} createLabel={t("ui__новое_списание_01c31308")} />
      <DataTable columns={columns} rows={rows} loading={loading} onEdit={openView} />

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={t("ui__новое_списание_01c31308")}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <Field label={t("ui__склад_e8bf999f")} required>
              <select className={input} value={whId} onChange={(e) => setWhId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">{t("ui__выберите_edab92dd")}</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            <Field label={t("ui__причина_d88300c7")}>
              <select className={input} value={reasonId} onChange={(e) => setReasonId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">{t("ui__нет_7b07413e")}</option>
                {reasons.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            <Field label={t("ui__дата_8cdd8bb7")} required>
              <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label={t("ui__примечание_686eb72b")}>
            <input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <Field label={t("ui__добавить_товары_db2bb4a6")}>
            <div className="relative">
              <input className={input} placeholder={t("ui__поиск_товара_b493d1bc")}
                value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
              {productOptions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border rounded-md shadow-lg max-h-48 overflow-auto">
                  {productOptions.map((p) => (
                    <button key={p.id} onClick={() => addItem(p)}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:bg-slate-900/40">
                      {p.name}{p.sku && <span className="text-slate-400"> ({p.sku})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          {items.length > 0 && (
            <div className="border rounded-md max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/40">
                  <tr>
                    <th className="px-3 py-2 text-left">{t("ui__товар_8b35db64")}</th>
                    <th className="px-3 py-2 text-right w-32">{t("ui__количество_cb8bfd4d")}</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={it.product_id} className="border-t">
                      <td className="px-3 py-2">{it.product_name}</td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" step="0.001" value={it.quantity}
                          onChange={(e) => { const n = [...items]; n[idx].quantity = e.target.value; setItems(n); }}
                          className="w-24 border rounded px-2 py-1 text-right text-sm" />
                      </td>
                      <td className="text-center">
                        <button onClick={() => setItems(items.filter((_, i) => i !== idx))}
                          className="text-red-600 hover:bg-red-50 p-1 rounded"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-md border hover:bg-slate-50 dark:bg-slate-900/40">{t("ui__отмена_987b33c6")}</button>
            <button onClick={create} className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700">{t("ui__списать_f8b7fd55")}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} size="lg"
        title={view ? `Hisobdan chiqarish ��� ${view.head.warehouse_name}` : ""}>
        {view && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500 dark:text-slate-400">{t("ui__дата_5c790abe")}</span> {view.head.write_off_date}</div>
              <div><span className="text-slate-500 dark:text-slate-400">{t("ui__причина_ce28b881")}</span> {view.head.reason_name || "���"}</div>
            </div>
            <div className="border rounded-md max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/40">
                  <tr>
                    <th className="px-3 py-2 text-left">{t("ui__товар_8b35db64")}</th>
                    <th className="px-3 py-2 text-right">{t("ui__кол_во_302e2bd6")}</th>
                    <th className="px-3 py-2 text-right">{t("ui__себест_1f8eb5d4")}</th>
                    <th className="px-3 py-2 text-right">{t("ui__сумма_cf59ebf9")}</th>
                  </tr>
                </thead>
                <tbody>
                  {view.items.map((i: any) => (
                    <tr key={i.product_id} className="border-t">
                      <td className="px-3 py-2">{i.name}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(i.quantity)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(i.cost)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(i.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-right text-lg font-semibold">
              {t("ui__итого_eab79dbd")} <span className="font-mono">{fmt(view.head.total_amount)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
