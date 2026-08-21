"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Cat = {
  id: number;
  name: string;
  discount_pct: string;
  customer_count?: number;
};
const empty = { name: "", discount_pct: 0 };

export default function CustomerCategoryPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try { setRows((await api.get<Cat[]>("/customer/categories")).data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    try {
      const payload = { name: form.name, discount_pct: Number(form.discount_pct) || 0 };
      if (editId) await api.put(`/customer/categories/${editId}`, payload);
      else await api.post("/customer/categories", payload);
      toast.success(t("ui__сохранено_54a59b19")); setOpen(false); load();
    } catch (e) { toast.error(getErrorMessage(e, "Xato")); }
  }
  async function del(r: Cat) {
    if (!confirm(`«${r.name}» o'chirilsinmi?`)) return;
    await api.delete(`/customer/categories/${r.id}`);
    toast.success(t("ui__удалено_0c450c40")); load();
  }

  const columns: Column<Cat>[] = [
    { key: "name", header: t("ui__название_602680ed") },
    {
      key: "customer_count",
      header: t("ui__клиентов_a8c15ba0"),
      align: "right",
      width: "120px",
      render: (r) => (
        <span className="font-mono text-brand-700 dark:text-brand-400">
          {r.customer_count || 0}
        </span>
      ),
    },
    {
      key: "discount_pct",
      header: t("ui__скидка_066aeb59"),
      align: "right",
      width: "120px",
      render: (r) => (
        <span className="font-mono">
          {Number(r.discount_pct).toFixed(2)}%
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__категории_клиентов_b5cbefa0")} description={t("ui__сегментация_клиентов_и_скидки_205a98a6")}
        onCreate={() => { setForm(empty); setEditId(null); setOpen(true); }} />
      <DataTable columns={columns} rows={rows} loading={loading}
        onEdit={(r) => { setForm({ name: r.name, discount_pct: Number(r.discount_pct) }); setEditId(r.id); setOpen(true); }}
        onDelete={del} />

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Tahrirlash" : "Yangi kategoriya"}>
        <div className="space-y-3">
          <Field label={t("ui__название_602680ed")} required>
            <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label={t("ui__скидка_по_умолчанию_214fec74")}>
            <input type="number" step="0.01" className={input} value={form.discount_pct}
              onChange={(e) => setForm({ ...form, discount_pct: e.target.value })} />
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
