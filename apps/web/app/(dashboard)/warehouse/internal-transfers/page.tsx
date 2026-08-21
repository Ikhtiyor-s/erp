"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Tr = {
  id: string; doc_number?: string; transfer_date: string; status: string;
  from_name?: string; to_name?: string;
};
type Wh = { id: number; name: string };
type Product = { id: string; name: string; sku?: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });
const today = () => new Date().toISOString().slice(0, 10);

export default function TransferPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Tr[]>([]);
  const [warehouses, setWarehouses] = useState<Wh[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<any | null>(null);

  const [fromId, setFromId] = useState<number | "">("");
  const [toId, setToId] = useState<number | "">("");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ product_id: string; product_name: string; quantity: string }[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<Product[]>([]);

  async function load() {
    setLoading(true);
    try { setRows((await api.get<Tr[]>("/warehouse/transfers")).data); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    api.get<Wh[]>("/warehouse/warehouses").then((r) => setWarehouses(r.data)).catch(() => {});
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
    if (!fromId || !toId || items.length === 0) { toast.error(t("ui__������������������_������������_��_������������_de29f019")); return; }
    if (fromId === toId) { toast.error(t("ui__������������_������������_��������_������������_916b5497")); return; }
    try {
      await api.post("/warehouse/transfers", {
        from_warehouse_id: Number(fromId), to_warehouse_id: Number(toId),
        transfer_date: date, notes,
        items: items.map((i) => ({ product_id: i.product_id, quantity: Number(i.quantity) || 0 }))
          .filter((i) => i.quantity > 0),
      });
      toast.success(t("ui__��������������_����������������_86f6af27"));
      setOpen(false); setItems([]); setFromId(""); setToId(""); setNotes(""); load();
    } catch (e: any) { toast.error(getErrorMessage(e, "Xato")); }
  }

  async function openView(r: Tr) {
    const { data } = await api.get(`/warehouse/transfers/${r.id}`);
    setView(data);
  }

  const columns: Column<Tr>[] = [
    { key: "doc_number", header: "���", render: (r) => r.doc_number || r.id.slice(0, 8), width: "100px" },
    { key: "transfer_date", header: t("ui__��������_8cdd8bb7"), width: "120px" },
    {
      key: "from_name", header: t("ui__������������_��������_9518dfba"),
      render: (r) => (
        <span className="inline-flex items-center gap-1 text-sm">
          {r.from_name || "���"} <ArrowRight size={14} className="text-slate-400" /> {r.to_name || "���"}
        </span>
      ),
    },
    { key: "status", header: t("ui__������������_7203f7a4"), width: "120px",
      render: (r) => <span className="text-green-600">{r.status === "received" ? "Olindi" : r.status}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__��������������������_����������������_41b90803")} description={t("ui__����������������������_��������������_����������_��������_932e70ec")}
        onCreate={() => setOpen(true)} createLabel={t("ui__����������_��������������_964c5514")} />
      <DataTable columns={columns} rows={rows} loading={loading} onEdit={openView} />

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={t("ui__����������_��������������_964c5514")}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <Field label={t("ui__������������_2043c6e6")} required>
              <select className={input} value={fromId} onChange={(e) => setFromId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">{t("ui__����������_c435037c")}</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            <Field label={t("ui__��������_b60bd4b1")} required>
              <select className={input} value={toId} onChange={(e) => setToId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">{t("ui__����������_c435037c")}</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            <Field label={t("ui__��������_8cdd8bb7")} required>
              <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label={t("ui__��������������������_686eb72b")}>
            <input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <Field label={t("ui__����������������_������������_db2bb4a6")}>
            <div className="relative">
              <input className={input} placeholder={t("ui__����������_������������_b493d1bc")}
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
                    <th className="px-3 py-2 text-left">{t("ui__����������_8b35db64")}</th>
                    <th className="px-3 py-2 text-right w-32">{t("ui__��������������������_cb8bfd4d")}</th>
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
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-md border hover:bg-slate-50 dark:bg-slate-900/40">{t("ui__������������_987b33c6")}</button>
            <button onClick={create} className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700">{t("ui__������������������_bdf82a2a")}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} size="lg"
        title={view ? `Ko'chirish: ${view.head.from_name} ��� ${view.head.to_name}` : ""}>
        {view && (
          <div className="space-y-3">
            <div className="text-sm text-slate-500 dark:text-slate-400">��������: {view.head.transfer_date}</div>
            <div className="border rounded-md max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/40">
                  <tr>
                    <th className="px-3 py-2 text-left">{t("ui__����������_8b35db64")}</th>
                    <th className="px-3 py-2 text-right">{t("ui__������_����_302e2bd6")}</th>
                    <th className="px-3 py-2 text-right">{t("ui__������������_1f8eb5d4")}</th>
                  </tr>
                </thead>
                <tbody>
                  {view.items.map((i: any) => (
                    <tr key={i.product_id} className="border-t">
                      <td className="px-3 py-2">{i.name}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(i.quantity)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(i.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
