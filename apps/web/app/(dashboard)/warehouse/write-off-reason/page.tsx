"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

type Reason = { id: number; name: string };

export default function WriteOffReasonPage() {
  const t = useTranslations("ui");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<Reason[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reason | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
      toast.success(t("ui__сохранено_54a59b19")); setOpen(false); setName(""); setEditId(null); load();
    } catch (e: any) { toast.error(getErrorMessage(e, "Xato")); }
  }
  async function del() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/warehouse/write-off-reasons/${deleteTarget.id}`);
      toast.success(t("ui__удалено_0c450c40"));
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setDeleteLoading(false);
    }
  }

  const columns: Column<Reason>[] = [{ key: "name", header: t("ui__название_602680ed") }];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__причины_списания_40650004")} description={t("ui__справочник_причин_93b51904")}
        onCreate={() => { setName(""); setEditId(null); setOpen(true); }} />
      <DataTable columns={columns} rows={rows} loading={loading}
        onEdit={(r) => { setName(r.name); setEditId(r.id); setOpen(true); }}
        onDelete={(r) => setDeleteTarget(r)} />

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Tahrirlash" : "Yangi sabab"}>
        <div className="space-y-3">
          <Field label={t("ui__название_602680ed")} required>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>{t("ui__отмена_987b33c6")}</Button>
            <Button variant="primary" onClick={save}>{t("ui__сохранить_74ea58b6")}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={del}
        title={tc("delete")}
        message={`"${deleteTarget?.name ?? ""}" o'chirilsinmi?`}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
