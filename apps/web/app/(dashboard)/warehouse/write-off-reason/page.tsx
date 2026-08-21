"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Reason = { id: number; name: string };

export default function WriteOffReasonPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Reason[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try { setRows((await api.get<Reason[]>("/warehouse/write-off-reasons")).data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    try {
      if (editId) await api.put(`/warehouse/write-off-reasons/${editId}`, { name });
      else await api.post("/warehouse/write-off-reasons", { name });
      toast.success(t("ui__������������������_54a59b19")); setOpen(false); setName(""); setEditId(null); load();
    } catch (e: any) { toast.error(getErrorMessage(e, "Xato")); }
  }
  async function del(r: Reason) {
    if (!confirm(`��${r.name}�� o'chirilsinmi?`)) return;
    await api.delete(`/warehouse/write-off-reasons/${r.id}`);
    toast.success(t("ui__��������������_0c450c40")); load();
  }

  const columns: Column<Reason>[] = [{ key: "name", header: t("ui__����������������_602680ed") }];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__��������������_����������������_40650004")} description={t("ui__��������������������_������������_93b51904")}
        onCreate={() => { setName(""); setEditId(null); setOpen(true); }} />
      <DataTable columns={columns} rows={rows} loading={loading}
        onEdit={(r) => { setName(r.name); setEditId(r.id); setOpen(true); }}
        onDelete={del} />

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Tahrirlash" : "Yangi sabab"}>
        <div className="space-y-3">
          <Field label={t("ui__����������������_602680ed")} required>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
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
