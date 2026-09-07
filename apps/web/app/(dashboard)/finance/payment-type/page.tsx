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

type PT = { id: number; code: string; name: string; is_cash: boolean; is_active: boolean };
const empty = { code: "", name: "", is_cash: true };

export default function PaymentTypePage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<PT[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const [delTarget, setDelTarget] = useState<PT | null>(null);

  async function load() {
    setLoading(true);
    try { setRows((await api.get<PT[]>("/reference/payment-types")).data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    try {
      if (editId) await api.put(`/reference/payment-types/${editId}`, form);
      else await api.post("/reference/payment-types", form);
      toast.success(t("ui__сохранено_54a59b19")); setOpen(false); load();
    } catch (e) { toast.error(getErrorMessage(e, "Xato")); }
  }
  async function del() {
    if (!delTarget) return;
    await api.delete(`/reference/payment-types/${delTarget.id}`);
    toast.success(t("ui__удалено_0c450c40"));
    setDelTarget(null);
    load();
  }

  const columns: Column<PT>[] = [
    { key: "code", header: t("ui__код_3f34a617"), width: "150px" },
    { key: "name", header: t("ui__название_602680ed") },
    {
      key: "is_cash", header: t("ui__наличные_2f0b3c5f"), align: "center", width: "120px",
      render: (r) => (r.is_cash ? "Ha" : "Naqd emas"),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__типы_платежей_28229f59")} description={t("ui__способы_оплаты_6b0aee23")}
        onCreate={() => { setForm(empty); setEditId(null); setOpen(true); }} />
      <DataTable columns={columns} rows={rows} loading={loading}
        onEdit={(r) => { setForm({ code: r.code, name: r.name, is_cash: r.is_cash }); setEditId(r.id); setOpen(true); }}
        onDelete={(r) => setDelTarget(r)} />

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Tahrirlash" : "Yangi to'lov turi"}>
        <div className="space-y-3">
          <Field label={t("ui__код_3f34a617")} required>
            <input className={input} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label={t("ui__название_602680ed")} required>
            <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_cash} onChange={(e) => setForm({ ...form, is_cash: e.target.checked })} />
            {t("ui__наличные_2f0b3c5f")}
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("ui__отмена_987b33c6")}</Button>
            <Button type="button" onClick={save}>{t("ui__сохранить_74ea58b6")}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={del}
        title="To'lov turini o'chirish"
        message={delTarget ? `«${delTarget.name}» o'chirilsinmi?` : ""}
        confirmLabel={t("ui__удалено_0c450c40")}
        variant="danger"
      />
    </div>
  );
}
