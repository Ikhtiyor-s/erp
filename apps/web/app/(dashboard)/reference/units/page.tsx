"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Unit = { id: number; code: string; name: string; short_name?: string };
const empty = { code: "", name: "", short_name: "" };

export default function UnitsPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try { setRows((await api.get<Unit[]>("/reference/units")).data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    try {
      const payload = {
        code: form.code,
        name: form.name,
        short_name: form.short_name || null,
      };
      if (editId) await api.put(`/reference/units/${editId}`, payload);
      else await api.post("/reference/units", payload);
      toast.success(editId ? "Saqlandi" : "Yaratildi"); setOpen(false); load();
    } catch (e: any) { toast.error(getErrorMessage(e, "Xato")); }
  }
  async function del(r: Unit) {
    if (!confirm(`��${r.name}�� o'chirilsinmi?`)) return;
    try {
      await api.delete(`/reference/units/${r.id}`);
      toast.success(t("ui__удалено_0c450c40")); load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "O'chirib bo'lmaydi (ishlatilmoqda)"));
    }
  }

  const columns: Column<Unit>[] = [
    { key: "code", header: t("ui__код_3f34a617"), width: "120px" },
    { key: "name", header: t("ui__название_602680ed") },
    { key: "short_name", header: t("ui__сокр_9f480467"), width: "120px", render: (r) => r.short_name || "���" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__единицы_измерения_ecf1ed91")} description={t("ui__справочник_единиц_шт_кг_литр_и_53afcf57")}
        onCreate={() => { setForm(empty); setEditId(null); setOpen(true); }} />
      <DataTable columns={columns} rows={rows} loading={loading}
        onEdit={(r) => {
          setForm({ code: r.code, name: r.name, short_name: r.short_name || "" });
          setEditId(r.id); setOpen(true);
        }}
        onDelete={del} />

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Birlikni tahrirlash" : "Yangi birlik"}>
        <div className="space-y-3">
          <Field label={t("ui__код_3f34a617")} required>
            <input className={input} maxLength={20} value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label={t("ui__название_602680ed")} required>
            <input className={input} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label={t("ui__сокращение_f3ee7b07")}>
            <input className={input} maxLength={10} value={form.short_name}
              onChange={(e) => setForm({ ...form, short_name: e.target.value })} />
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
