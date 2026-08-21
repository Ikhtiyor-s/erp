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

type Bom = { id: string; product_id: string; product_name: string; name?: string; output_qty: string };
type Product = { id: string; name: string; sku?: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });

export default function IngredientPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Bom[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<any | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [name, setName] = useState("");
  const [outputQty, setOutputQty] = useState("1");
  const [items, setItems] = useState<{ product_id: string; product_name: string; quantity: string }[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<Product[]>([]);

  const [ingSearch, setIngSearch] = useState("");
  const [ingOptions, setIngOptions] = useState<Product[]>([]);

  async function load() {
    setLoading(true);
    try { setRows((await api.get<Bom[]>("/manufacturing/bom")).data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (productSearch.length < 2) { setProductOptions([]); return; }
    const t = setTimeout(() => {
      api.get<Product[]>(`/warehouse/products?q=${encodeURIComponent(productSearch)}`)
        .then((r) => setProductOptions(r.data.slice(0, 10))).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [productSearch]);

  useEffect(() => {
    if (ingSearch.length < 2) { setIngOptions([]); return; }
    const t = setTimeout(() => {
      api.get<Product[]>(`/warehouse/products?q=${encodeURIComponent(ingSearch)}`)
        .then((r) => setIngOptions(r.data.slice(0, 10))).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [ingSearch]);

  function reset() {
    setProductId(""); setProductName(""); setName("");
    setOutputQty("1"); setItems([]); setEditId(null);
  }

  function addIng(p: Product) {
    if (items.some((i) => i.product_id === p.id)) return;
    setItems([...items, { product_id: p.id, product_name: p.name, quantity: "1" }]);
    setIngSearch(""); setIngOptions([]);
  }

  async function openEdit(b: Bom) {
    const { data } = await api.get(`/manufacturing/bom/${b.id}`);
    setEditId(b.id);
    setProductId(data.head.product_id); setProductName(data.head.product_name);
    setName(data.head.name || ""); setOutputQty(String(data.head.output_qty));
    setItems(data.items.map((i: any) => ({
      product_id: i.product_id, product_name: i.product_name, quantity: String(i.quantity),
    })));
    setOpen(true);
  }

  async function save() {
    if (!productId) { toast.error(t("ui__выберите_продукт_ea7606a2")); return; }
    if (items.length === 0) { toast.error(t("ui__добавьте_ингредиенты_5a400f72")); return; }
    try {
      const payload = {
        product_id: productId, name: name || null,
        output_qty: Number(outputQty) || 1,
        items: items.map((i) => ({ product_id: i.product_id, quantity: Number(i.quantity) || 0 }))
          .filter((i) => i.quantity > 0),
      };
      if (editId) await api.put(`/manufacturing/bom/${editId}`, payload);
      else await api.post("/manufacturing/bom", payload);
      toast.success(t("ui__сохранено_54a59b19")); setOpen(false); reset(); load();
    } catch (e) { toast.error(getErrorMessage(e, "Xato")); }
  }

  async function del(b: Bom) {
    if (!confirm(`«${b.product_name}» retsepti o'chirilsinmi?`)) return;
    await api.delete(`/manufacturing/bom/${b.id}`);
    toast.success(t("ui__удалено_0c450c40")); load();
  }

  const cols: Column<Bom>[] = [
    { key: "product_name", header: t("ui__готовая_продукция_5d5498a6") },
    { key: "name", header: t("ui__название_рецепта_cd73e95e"), render: (r) => r.name || "—" },
    { key: "output_qty", header: t("ui__выход_8ef2d61a"), align: "right", width: "120px",
      render: (r) => <span className="font-mono">{fmt(r.output_qty)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__ингредиенты_bom_3ad66554")} description={t("ui__рецепты_производства_94721058")}
        onCreate={() => { reset(); setOpen(true); }} createLabel={t("ui__новый_рецепт_1e04f735")} />
      <DataTable columns={cols} rows={rows} loading={loading} onEdit={openEdit} onDelete={del} />

      <Modal open={open} onClose={() => { setOpen(false); reset(); }} size="lg"
        title={editId ? "Retseptni tahrirlash" : "Yangi retsept"}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Field label={t("ui__готовая_продукция_5d5498a6")} required>
                <div className="relative">
                  <input className={input} placeholder={productName || "Qidirish..."}
                    value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
                  {productOptions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border rounded-md shadow-lg max-h-48 overflow-auto">
                      {productOptions.map((p) => (
                        <button key={p.id}
                          onClick={() => { setProductId(p.id); setProductName(p.name); setProductSearch(p.name); setProductOptions([]); }}
                          className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:bg-slate-900/40">
                          {p.name}{p.sku && <span className="text-slate-400"> ({p.sku})</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
            </div>
            <Field label={t("ui__выход_кол_во_0102e269")} required>
              <input type="number" step="0.001" className={input} value={outputQty}
                onChange={(e) => setOutputQty(e.target.value)} />
            </Field>
          </div>
          <Field label={t("ui__название_рецепта_cd73e95e")}>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <Field label={t("ui__добавить_ингредиент_296f3870")}>
            <div className="relative">
              <input className={input} placeholder={t("ui__поиск_ингредиента_f0396c8f")}
                value={ingSearch} onChange={(e) => setIngSearch(e.target.value)} />
              {ingOptions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border rounded-md shadow-lg max-h-48 overflow-auto">
                  {ingOptions.map((p) => (
                    <button key={p.id} onClick={() => addIng(p)}
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
                    <th className="px-3 py-2 text-left">{t("ui__ингредиент_3ab4d4ca")}</th>
                    <th className="px-3 py-2 text-right w-32">{t("ui__кол_во_на_1_ед_выхода_ad8117be")}</th>
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
            <button onClick={() => { setOpen(false); reset(); }}
              className="px-4 py-2 text-sm rounded-md border hover:bg-slate-50 dark:bg-slate-900/40">{t("ui__отмена_987b33c6")}</button>
            <button onClick={save} className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700">{t("ui__сохранить_74ea58b6")}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
