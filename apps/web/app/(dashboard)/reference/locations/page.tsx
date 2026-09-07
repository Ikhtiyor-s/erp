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

type Loc = { id: number; name: string; address?: string; phone?: string };
const empty = { name: "", address: "", phone: "" };

export default function LocationsPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Loc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Loc | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/reference/locations/${deleteTarget.id}`);
      toast.success(t("ui__удалено_0c450c40"));
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setDeleteLoading(false);
    }
  }

  const columns: Column<Loc>[] = [
    { key: "name", header: t("ui__название_602680ed") },
    { key: "address", header: t("ui__адрес_80148fa5"), render: (r) => r.address || "—" },
    { key: "phone", header: t("ui__телефон_2928e19c"), width: "160px", render: (r) => r.phone || "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__локации_филиалы_a5cec755")} description={t("ui__точки_продаж_и_местоположения_d82ce398")}
        onCreate={() => { setForm(empty); setEditId(null); setOpen(true); }} />
      <DataTable columns={columns} rows={rows} loading={loading}
        onEdit={(r) => {
          setForm({ name: r.name, address: r.address || "", phone: r.phone || "" });
          setEditId(r.id); setOpen(true);
        }}
        onDelete={(r) => setDeleteTarget(r)} />

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Joylashuvni tahrirlash" : "Yangi joylashuv"}>
        <div className="space-y-3">
          <Field label={t("ui__название_602680ed")} required>
            <input className={input} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label={t("ui__адрес_80148fa5")}>
            <input className={input} value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label={t("ui__телефон_2928e19c")}>
            <input className={input} value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("ui__отмена_987b33c6")}</Button>
            <Button type="button" onClick={save}>{t("ui__сохранить_74ea58b6")}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="O'chirish"
        message={`«${deleteTarget?.name}» o'chirilsinmi?`}
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
