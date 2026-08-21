"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
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
  async function del(r: Pos) {
    if (!confirm(`«${r.name}» lavozimi o'chirilsinmi?`)) return;
    await api.delete(`/hr/positions/${r.id}`);
    toast.success(t("ui__удалено_0c450c40"));
    load();
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

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 flex gap-3 items-end">
        <div className="relative flex-1 max-w-md">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__поиск_bfc95980")}
          </label>
          <Search
            size={14}
            className="absolute left-2.5 top-[34px] text-slate-400"
          />
          <input
            className={`${input} pl-8`}
            placeholder={t("ui__поиск_должности_c72b274e")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {t("ui__всего_2dc77255")} <span className="font-semibold">{filtered.length}</span>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
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
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              {t("ui__отмена_987b33c6")}
            </button>
            <button
              onClick={save}
              className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700"
            >
              {t("ui__сохранить_74ea58b6")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
