"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Tmpl = {
  id: number; kind: string; name: string;
  is_default: boolean; updated_at: string; body?: string;
};

const kindLabel = (k: string) => ({
  receipt: "Chek", label: "Yorliq", invoice: "Hisob-faktura",
}[k] || k);

const DEFAULT_BODY = `���������������������������������������������������������������������������������
{org_name}
{org_address}
������: {org_phone}
���������������������������������������������������������������������������������
������ ��� {doc_number}
{sale_date}
���������������������������������������������������������������������������������
{items}
���������������������������������������������������������������������������������
����������: {total} {currency}
����������������: {paid}
���������������������������������������������������������������������������������
{footer}
`;

export default function TemplatesPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Tmpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const empty = { kind: "receipt", name: "", body: DEFAULT_BODY, is_default: false };
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try { setRows((await api.get<Tmpl[]>("/settings/print-templates")).data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function openEdit(r: Tmpl) {
    const { data } = await api.get(`/settings/print-templates/${r.id}`);
    setForm({
      kind: data.kind, name: data.name, body: data.body, is_default: data.is_default,
    });
    setEditId(r.id); setOpen(true);
  }

  async function save() {
    if (!form.name || !form.body) { toast.error(t("ui__заполните_название_и_тело_4f4d771b")); return; }
    try {
      if (editId) await api.put(`/settings/print-templates/${editId}`, form);
      else await api.post("/settings/print-templates", form);
      toast.success(t("ui__сохранено_54a59b19")); setOpen(false); setForm(empty); setEditId(null); load();
    } catch (e: any) { toast.error(getErrorMessage(e, "Xato")); }
  }
  async function del(r: Tmpl) {
    if (!confirm(`��${r.name}�� o'chirilsinmi?`)) return;
    await api.delete(`/settings/print-templates/${r.id}`);
    toast.success(t("ui__удалено_0c450c40")); load();
  }

  const cols: Column<Tmpl>[] = [
    { key: "kind", header: t("ui__тип_345805b8"), width: "140px", render: (r) => kindLabel(r.kind) },
    { key: "name", header: t("ui__название_602680ed") },
    { key: "is_default", header: t("ui__по_умолч_db87fc4e"), align: "center", width: "120px",
      render: (r) => r.is_default ? <span className="text-green-700">���</span> : <span className="text-slate-300">���</span> },
    { key: "updated_at", header: t("ui__обновлён_45f173d2"), width: "180px",
      render: (r) => new Date(r.updated_at).toLocaleString("ru-RU") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__шаблоны_печати_0e28d151")} description={t("ui__чеки_этикетки_счета_18aa225a")}
        onCreate={() => { setForm(empty); setEditId(null); setOpen(true); }} />
      <DataTable columns={cols} rows={rows} loading={loading} onEdit={openEdit} onDelete={del} />

      <Modal open={open} onClose={() => setOpen(false)} size="lg"
        title={editId ? "Shablonni tahrirlash" : "Yangi shablon"}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("ui__тип_345805b8")} required>
              <select className={input} value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="receipt">{t("ui__чек_f7510aa4")}</option>
                <option value="label">{t("ui__этикетка_9fd95bce")}</option>
                <option value="invoice">{t("ui__счёт_фактура_70a235e2")}</option>
              </select>
            </Field>
            <Field label={t("ui__название_602680ed")} required>
              <input className={input} value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
          </div>
          <Field label={t("ui__тело_шаблона_b3fa09bf")} required>
            <textarea className={`${input} font-mono text-xs`} rows={14} value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </Field>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ������������������ ��������������������: {`{org_name}, {org_address}, {org_phone}, {doc_number}, {sale_date}, {items}, {total}, {paid}, {currency}, {footer}`}
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
            {t("ui__шаблон_по_умолчанию_для_этого__eec7a43b")}
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-md border hover:bg-slate-50 dark:bg-slate-900/40">{t("ui__отмена_987b33c6")}</button>
            <button onClick={save} className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700">{t("ui__сохранить_74ea58b6")}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
