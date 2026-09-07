"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

type Pos = {
  id: number;
  name: string;
  description?: string;
  employee_count?: number;
  avg_salary?: string;
};

const empty = { name: "", description: "" };
const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function PositionsPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Pos[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const [confirmItem, setConfirmItem] = useState<Pos | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows((await api.get<Pos[]>("/hr/positions")).data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    try {
      if (editId) await api.put(`/hr/positions/${editId}`, form);
      else await api.post("/hr/positions", form);
      toast.success(t("ui__сохранено_54a59b19"));
      setOpen(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  async function del() {
    if (!confirmItem) return;
    setDeleting(true);
    try {
      await api.delete(`/hr/positions/${confirmItem.id}`);
      toast.success(t("ui__удалено_0c450c40"));
      setConfirmItem(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setDeleting(false);
    }
  }

  const filtered = q
    ? rows.filter((r) =>
        (r.name + " " + (r.description || "")).toLowerCase().includes(q.toLowerCase())
      )
    : rows;

  const columns: Column<Pos>[] = [
    { key: "name", header: t("ui__название_602680ed") },
    {
      key: "description",
      header: t("ui__описание_38ca0af8"),
      render: (r) => r.description || "—",
    },
    {
      key: "employee_count",
      header: t("ui__сотрудников_7878f86e"),
      align: "right",
      width: "130px",
      render: (r) => (
        <span className="font-mono text-brand-700 dark:text-brand-400">
          {r.employee_count || 0}
        </span>
      ),
    },
    {
      key: "avg_salary",
      header: t("ui__средняя_зарплата_4d9098c5"),
      align: "right",
      width: "180px",
      render: (r) =>
        Number(r.avg_salary || 0) > 0 ? (
          <span className="font-mono">{fmt(r.avg_salary)}</span>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__должности_54f68fdc")}
        description={t("ui__справочник_должностей_8eb4db45")}
        onCreate={() => {
          setForm(empty);
          setEditId(null);
          setOpen(true);
        }}
      />

      <Card padding="md" className="flex gap-3 items-end">
        <div className="relative flex-1 max-w-md">
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__поиск_bfc95980")}
          </label>
          <Search
            size={14}
            className="absolute left-2.5 top-[34px] text-ink-400"
          />
          <input
            className={`${input} pl-8`}
            placeholder={t("ui__поиск_должности_c72b274e")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="ml-auto text-xs text-ink-500 dark:text-ink-400">
          {t("ui__всего_2dc77255")} <span className="font-semibold">{filtered.length}</span>
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={filtered}
        loading={loading}
        onEdit={(r) => {
          setForm({ name: r.name, description: r.description || "" });
          setEditId(r.id);
          setOpen(true);
        }}
        onDelete={(r) => setConfirmItem(r)}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Lavozimni tahrirlash" : "Yangi lavozim"}
      >
        <div className="space-y-3">
          <Field label={t("ui__название_602680ed")} required>
            <input
              className={input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label={t("ui__описание_38ca0af8")}>
            <textarea
              className={input}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-ink-200 dark:border-ink-800">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("ui__отмена_987b33c6")}
            </Button>
            <Button onClick={save}>
              {t("ui__сохранить_74ea58b6")}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmItem !== null}
        onClose={() => setConfirmItem(null)}
        onConfirm={del}
        title="Lavozimni o'chirish"
        message={confirmItem ? `«${confirmItem.name}» lavozimi o'chirilsinmi?` : ""}
        confirmLabel="O'chirish"
        loading={deleting}
      />
    </div>
  );
}
