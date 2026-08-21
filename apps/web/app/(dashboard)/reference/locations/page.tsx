"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Loc = { id: number; name: string; address?: string; phone?: string };
const empty = { name: "", address: "", phone: "" };

export default function LocationsPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Loc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try { setRows((await api.get<Loc[]>("/reference/locations")).data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    try {
      const payload = {
        name: form.name,
        address: form.address || null,
        phone: form.phone || null,
      };
      if (editId) await api.put(`/reference/locations/${editId}`, payload);
      else await api.post("/reference/locations", payload);
      toast.success(editId ? "Saqlandi" : "Yaratildi"); setOpen(false); load();
    } catch (e: any) { toast.error(getErrorMessage(e, "Xato")); }
  }
  async function del(r: Loc) {
    if (!confirm(`��${r.name}�� o'chirilsinmi?`)) return;
    await api.delete(`/reference/locations/${r.id}`);
    toast.success(t("ui__��������������_0c450c40")); load();
  }

  const columns: Column<Loc>[] = [
    { key: "name", header: t("ui__����������������_602680ed") },
    { key: "address", header: t("ui__����������_80148fa5"), render: (r) => r.address || "���" },
    { key: "phone", header: t("ui__��������������_2928e19c"), width: "160px", render: (r) => r.phone || "���" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__��������������_��������������_a5cec755")} description={t("ui__����������_������������_��_����������������������������_d82ce398")}
        onCreate={() => { setForm(empty); setEditId(null); setOpen(true); }} />
      <DataTable columns={columns} rows={rows} loading={loading}
        onEdit={(r) => {
          setForm({ name: r.name, address: r.address || "", phone: r.phone || "" });
          setEditId(r.id); setOpen(true);
        }}
        onDelete={del} />

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Joylashuvni tahrirlash" : "Yangi joylashuv"}>
        <div className="space-y-3">
          <Field label={t("ui__����������������_602680ed")} required>
            <input className={input} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label={t("ui__����������_80148fa5")}>
            <input className={input} value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label={t("ui__��������������_2928e19c")}>
            <input className={input} value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-md border hover:bg-slate-50 dark:bg-slate-900/40">{t("ui__������������_987b33c6")}</button>
            <button onClick={save} className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700">{t("ui__������������������_74ea58b6")}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
