"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Cat = { id: number; name: string; parent_id: number | null; path?: string };
const empty = { name: "", parent_id: null as number | null };

export default function CategoryPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try { setRows((await api.get<Cat[]>("/warehouse/categories")).data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    try {
      const payload = { name: form.name, parent_id: form.parent_id || null };
      if (editId) await api.put(`/warehouse/categories/${editId}`, payload);
      else await api.post("/warehouse/categories", payload);
      toast.success(t("ui__сохранено_54a59b19")); setOpen(false); load();
    } catch (e) { toast.error(getErrorMessage(e, "Xato")); }
  }
  async function del(r: Cat) {
    if (!confirm(`«${r.name}» o'chirilsinmi?`)) return;
    await api.delete(`/warehouse/categories/${r.id}`);
    toast.success(t("ui__удалено_0c450c40")); load();
  }

  const parentName = (id: number | null) => id ? rows.find((r) => r.id === id)?.name || "—" : "—";
  const columns: Column<Cat>[] = [
    { key: "name", header: t("ui__название_602680ed") },
    { key: "parent_id", header: t("ui__родитель_988b91de"), render: (r) => parentName(r.parent_id), width: "200px" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__категории_товаров_84c03b71")} description={t("ui__иерархия_категорий_8feaf9d0")}
        onCreate={() => { setForm(empty); setEditId(null); setOpen(true); }} />
      {/* Desktop table */}
      <div className="hidden md:block">
        <DataTable columns={columns} rows={rows} loading={loading}
          onEdit={(r) => { setForm({ name: r.name, parent_id: r.parent_id }); setEditId(r.id); setOpen(true); }}
          onDelete={del} />
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden space-y-3">
        {loading && <li className="text-center text-sm text-slate-400 py-8">{t("ui__загрузка_43e40d49")}</li>}
        {!loading && rows.length === 0 && <li className="text-center text-sm text-slate-400 py-8">{t("ui__нет_данных_dee9a2d8")}</li>}
        {rows.map((r) => (
          <li key={r.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900 dark:text-slate-100">{r.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("ui__родитель_988b91de")}: {parentName(r.parent_id)}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  aria-label="Tahrirlash"
                  onClick={() => { setForm({ name: r.name, parent_id: r.parent_id }); setEditId(r.id); setOpen(true); }}
                  className="text-xs text-brand-600 hover:text-brand-700 px-2 py-1 rounded border border-brand-200"
                >
                  Tahrir
                </button>
                <button
                  aria-label="O'chirish"
                  onClick={() => del(r)}
                  className="text-xs text-rose-600 hover:text-rose-700 px-2 py-1 rounded border border-rose-200"
                >
                  O&apos;chir
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Kategoriyani tahrirlash" : "Yangi kategoriya"}>
        <div className="space-y-3">
          <Field label={t("ui__название_602680ed")} required>
            <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label={t("ui__родительская_категория_df47dbf5")}>
            <select className={input} value={form.parent_id || ""} onChange={(e) => setForm({ ...form, parent_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t("ui__нет_7b07413e")}</option>
              {rows.filter((r) => r.id !== editId).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-md border hover:bg-slate-50 dark:bg-slate-900/40">{t("ui__отмена_987b33c6")}</button>
            <button onClick={save} className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700">{t("ui__сохранить_74ea58b6")}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
