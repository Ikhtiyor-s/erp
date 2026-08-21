"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Inv = {
  id: string; doc_number?: string; status: string;
  started_at?: string; finished_at?: string; warehouse_name?: string;
};
type Wh = { id: number; name: string };
type Product = { id: string; name: string; sku?: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });

export default function RevisionPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Inv[]>([]);
  const [warehouses, setWarehouses] = useState<Wh[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<any | null>(null);

  const [whId, setWhId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ product_id: string; product_name: string; actual_qty: string }[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<Product[]>([]);

  async function load() {
    setLoading(true);
    try { setRows((await api.get<Inv[]>("/warehouse/inventories")).data); }
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
    setItems([...items, { product_id: p.id, product_name: p.name, actual_qty: "0" }]);
    setProductSearch(""); setProductOptions([]);
  }

  async function create() {
    if (!whId || items.length === 0) { toast.error(t("ui__����������������_����������_��_��������_����_��������__30cb8822")); return; }
    try {
      const payload = {
        warehouse_id: Number(whId), notes,
        items: items.map((i) => ({ product_id: i.product_id, actual_qty: Number(i.actual_qty) || 0 })),
      };
      await api.post("/warehouse/inventories", payload);
      toast.success(t("ui__����������������������������_��������������_3ddabe63"));
      setOpen(false); setItems([]); setWhId(""); setNotes(""); load();
    } catch (e: any) { toast.error(getErrorMessage(e, "Xato")); }
  }

  async function openInv(r: Inv) {
    const { data } = await api.get(`/warehouse/inventories/${r.id}`);
    setView(data);
  }

  async function finish(id: string) {
    if (!confirm("Inventarizatsiya yakunlansinmi? Qoldiqlar tuzatiladi.")) return;
    try {
      await api.post(`/warehouse/inventories/${id}/finish`);
      toast.success(t("ui__������������������_��������������_������������������_df82ddbe"));
      setView(null); load();
    } catch (e: any) { toast.error(getErrorMessage(e, "Xato")); }
  }

  const columns: Column<Inv>[] = [
    { key: "doc_number", header: "���", render: (r) => r.doc_number || r.id.slice(0, 8), width: "100px" },
    { key: "warehouse_name", header: t("ui__����������_e8bf999f") },
    {
      key: "status", header: t("ui__������������_7203f7a4"), width: "140px", render: (r) => (
        <span className={r.status === "completed" ? "text-green-600" : "text-yellow-600"}>
          {r.status === "completed" ? "Yakunlandi" : "Jarayonda"}
        </span>
      ),
    },
    { key: "started_at", header: t("ui__������������_bc2e48ae"), width: "160px",
      render: (r) => r.started_at ? new Date(r.started_at).toLocaleString("ru-RU") : "���" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__����������������������������_8a20523f")} description={t("ui__������������_����������������������_����������������_e9822c6d")}
        onCreate={() => setOpen(true)} createLabel={t("ui__����������_����������������������������_e78e9c5b")} />
      <DataTable columns={columns} rows={rows} loading={loading}
        onEdit={openInv} />

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={t("ui__����������_����������������������������_e78e9c5b")}>
        <div className="space-y-3">
          <Field label={t("ui__����������_e8bf999f")} required>
            <select className={input} value={whId}
              onChange={(e) => setWhId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">{t("ui__����������������_edab92dd")}</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
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
                      {p.name} {p.sku && <span className="text-slate-400">({p.sku})</span>}
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
                    <th className="px-3 py-2 text-right w-32">{t("ui__��������_0a982a27")}</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={it.product_id} className="border-t">
                      <td className="px-3 py-2">{it.product_name}</td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" step="0.001" value={it.actual_qty}
                          onChange={(e) => {
                            const next = [...items]; next[idx].actual_qty = e.target.value; setItems(next);
                          }}
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
            <button onClick={create} className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700">{t("ui__��������������_b059f7e1")}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} size="lg"
        title={view ? `Inventarizatsiya ��� ${view.head.warehouse_name}` : ""}>
        {view && (
          <div className="space-y-4">
            <div className="text-sm">
              <span className="text-slate-500 dark:text-slate-400">{t("ui__������������_9fa7ff8e")} </span>
              <span className={view.head.status === "completed" ? "text-green-600 font-semibold" : "text-yellow-600 font-semibold"}>
                {view.head.status === "completed" ? "Yakunlandi" : "Jarayonda"}
              </span>
            </div>
            <div className="border rounded-md max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/40">
                  <tr>
                    <th className="px-3 py-2 text-left">{t("ui__����������_8b35db64")}</th>
                    <th className="px-3 py-2 text-right">{t("ui__��������_210bf841")}</th>
                    <th className="px-3 py-2 text-right">{t("ui__��������_0a982a27")}</th>
                    <th className="px-3 py-2 text-right">{t("ui__��������������_fdb76087")}</th>
                  </tr>
                </thead>
                <tbody>
                  {view.items.map((i: any) => (
                    <tr key={i.product_id} className="border-t">
                      <td className="px-3 py-2">{i.name}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(i.expected_qty)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(i.actual_qty)}</td>
                      <td className={`px-3 py-2 text-right font-mono ${Number(i.diff_qty) < 0 ? "text-red-600" : Number(i.diff_qty) > 0 ? "text-green-600" : ""}`}>
                        {fmt(i.diff_qty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {view.head.status !== "completed" && (
              <div className="flex justify-end">
                <button onClick={() => finish(view.head.id)}
                  className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700">
                  {t("ui__������������������_��_������������������_510732e2")}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
