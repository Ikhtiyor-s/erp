"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Type = { id: number; name: string; description?: string };

const empty = { name: "", description: "" };

export default function WarehouseTypesPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Type[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows((await api.get<Type[]>("/reference/warehouse-types")).data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!form.name) {
      toast.error(t("ui__����������������_����������������������_4df3db9f"));
      return;
    }
    try {
      if (editId) await api.put(`/reference/warehouse-types/${editId}`, form);
      else await api.post("/reference/warehouse-types", form);
      toast.success(t("ui__������������������_54a59b19"));
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }
  async function del(r: Type) {
    if (!confirm(`��${r.name}�� turi o'chirilsinmi?`)) return;
    await api.delete(`/reference/warehouse-types/${r.id}`);
    toast.success(t("ui__��������������_0c450c40"));
    load();
  }

  const cols: Column<Type>[] = [
    { key: "name", header: t("ui__����������������_602680ed") },
    {
      key: "description",
      header: t("ui__����������������_38ca0af8"),
      render: (r) => r.description || "���",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__��������_��������������_cbe7e372")}
        description={t("ui__��������������_������_��������������_��_��_��_a573dac4")}
        onCreate={() => {
          setForm(empty);
          setEditId(null);
          setOpen(true);
        }}
      />
      <DataTable
        columns={cols}
        rows={rows}
        loading={loading}
        onEdit={(r) => {
          setForm({ name: r.name, description: r.description || "" });
          setEditId(r.id);
          setOpen(true);
        }}
        onDelete={del}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Turni tahrirlash" : "Yangi ombor turi"}
      >
        <div className="space-y-3">
          <Field label={t("ui__����������������_602680ed")} required>
            <input
              className={input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label={t("ui__����������������_38ca0af8")}>
            <textarea
              className={input}
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              {t("ui__������������_987b33c6")}
            </button>
            <button
              onClick={save}
              className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700"
            >
              {t("ui__������������������_74ea58b6")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
