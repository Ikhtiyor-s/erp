"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Row = {
  id: number;
  employee_id: string;
  employee_name: string;
  period_month: string;
  metric: string;
  target_value?: string;
  actual_value?: string;
  notes?: string;
};
type Emp = { id: string; full_name: string };

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const monthStart = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

export default function KpiPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: "", employee_id: "" });
  const [open, setOpen] = useState(false);

  const empty = {
    employee_id: "",
    period_month: monthStart(),
    metric: "",
    target_value: "",
    actual_value: "",
    notes: "",
  };
  const [form, setForm] = useState<any>(empty);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.employee_id) p.set("employee_id", filters.employee_id);
      const qs = p.toString();
      setRows((await api.get<Row[]>(`/hr/kpi${qs ? "?" + qs : ""}`)).data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    api
      .get<Emp[]>("/hr/employees")
      .then((r) => setEmployees(r.data))
      .catch(() => {});
    load();
  }, []);

  async function save() {
    if (!form.employee_id || !form.metric) {
      toast.error(t("ui__заполните_сотрудника_и_метрику_7e1dc0ec"));
      return;
    }
    try {
      await api.post("/hr/kpi", {
        ...form,
        target_value: form.target_value ? Number(form.target_value) : null,
        actual_value: form.actual_value ? Number(form.actual_value) : null,
      });
      toast.success(t("ui__сохранено_54a59b19"));
      setOpen(false);
      setForm(empty);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  async function del(r: Row) {
    if (!confirm(`${r.employee_name} uchun «${r.metric}» KPI o'chirilsinmi?`)) return;
    await api.delete(`/hr/kpi/${r.id}`);
    toast.success(t("ui__удалено_0c450c40"));
    load();
  }

  const filtered = useMemo(() => {
    if (!filters.q) return rows;
    const q = filters.q.toLowerCase();
    return rows.filter((r) =>
      (r.employee_name + " " + r.metric + " " + (r.notes || ""))
        .toLowerCase()
        .includes(q)
    );
  }, [rows, filters.q]);

  const totals = useMemo(() => {
    const target = filtered.reduce((s, r) => s + Number(r.target_value || 0), 0);
    const actual = filtered.reduce((s, r) => s + Number(r.actual_value || 0), 0);
    const ratio = target ? (actual / target) * 100 : 0;
    return { target, actual, ratio };
  }, [filtered]);

  const cols: Column<Row>[] = [
    {
      key: "period_month",
      header: t("ui__период_f90bfbcc"),
      width: "140px",
      render: (r) =>
        new Date(r.period_month).toLocaleDateString("ru-RU", {
          year: "numeric",
          month: "long",
        }),
    },
    { key: "employee_name", header: t("ui__сотрудник_8f519d66") },
    { key: "metric", header: t("ui__метрика_7ae745f7") },
    {
      key: "target_value",
      header: t("ui__план_ee229f3b"),
      align: "right",
      width: "120px",
      render: (r) =>
        r.target_value ? (
          <span className="font-mono">{fmt(r.target_value)}</span>
        ) : (
          "—"
        ),
    },
    {
      key: "actual_value",
      header: t("ui__факт_0a982a27"),
      align: "right",
      width: "120px",
      render: (r) =>
        r.actual_value ? (
          <span className="font-mono">{fmt(r.actual_value)}</span>
        ) : (
          "—"
        ),
    },
    {
      key: "ratio" as any,
      header: "%",
      align: "right",
      width: "100px",
      render: (r) => {
        const t = Number(r.target_value);
        const a = Number(r.actual_value);
        if (!t) return "—";
        const ratio = (a / t) * 100;
        return (
          <span
            className={`font-mono ${
              ratio >= 100
                ? "text-green-700 dark:text-green-400"
                : ratio >= 80
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {ratio.toFixed(0)}%
          </span>
        );
      },
    },
    {
      key: "ratio_bar" as any,
      header: t("ui__прогресс_875bb32f"),
      width: "180px",
      render: (r) => {
        const t = Number(r.target_value);
        const a = Number(r.actual_value);
        if (!t) return null;
        const ratio = Math.min((a / t) * 100, 100);
        const color =
          ratio >= 100
            ? "bg-green-500"
            : ratio >= 80
            ? "bg-yellow-500"
            : "bg-red-500";
        return (
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className={`${color} h-2 rounded-full`}
              style={{ width: `${ratio}%` }}
            />
          </div>
        );
      },
    },
    {
      key: "notes",
      header: t("ui__заметки_c8866295"),
      render: (r) => r.notes || "—",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__kpi_сотрудников_bd84f15a")}
        description={t("ui__цели_и_фактические_показатели_82999b69")}
        onCreate={() => {
          setForm(empty);
          setOpen(true);
        }}
        createLabel={t("ui__новый_kpi_a053ea17")}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__поиск_сотрудник_метрика_заметк_a43b1b57")}
          </label>
          <Search
            size={14}
            className="absolute left-2.5 top-[34px] text-slate-400"
          />
          <input
            className={`${input} pl-8`}
            placeholder={t("ui__поиск_b84a8f87")}
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__сотрудник_8f519d66")}
          </label>
          <select
            className={input}
            value={filters.employee_id}
            onChange={(e) => {
              setFilters({ ...filters, employee_id: e.target.value });
              setTimeout(load, 0);
            }}
          >
            <option value="">{t("ui__все_a07b234e")}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end justify-end">
          <button
            onClick={() => {
              setFilters({ q: "", employee_id: "" });
              setTimeout(load, 0);
            }}
            className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {t("ui__сброс_1b421ddb")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Card label={t("ui__план_ee229f3b")} value={fmt(totals.target)} />
        <Card label={t("ui__факт_0a982a27")} value={fmt(totals.actual)} />
        <Card
          label={t("ui__выполнение_b540f3a7")}
          value={`${totals.ratio.toFixed(0)}%`}
          color={
            totals.ratio >= 100
              ? "text-green-700 dark:text-green-400"
              : totals.ratio >= 80
              ? "text-yellow-700 dark:text-yellow-400"
              : "text-red-700 dark:text-red-400"
          }
        />
      </div>

      <DataTable columns={cols} rows={filtered} loading={loading} onDelete={del} />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={t("ui__новый_kpi_a053ea17")}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("ui__сотрудник_8f519d66")} required>
              <select
                className={input}
                value={form.employee_id}
                onChange={(e) =>
                  setForm({ ...form, employee_id: e.target.value })
                }
              >
                <option value="">{t("ui__выберите_edab92dd")}</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("ui__период_месяц_ff3d8774")} required>
              <input
                type="date"
                className={input}
                value={form.period_month}
                onChange={(e) =>
                  setForm({ ...form, period_month: e.target.value })
                }
              />
            </Field>
            <Field label={t("ui__метрика_7ae745f7")} required>
              <input
                className={input}
                placeholder={t("ui__продажи_производство_36fde43c")}
                value={form.metric}
                onChange={(e) => setForm({ ...form, metric: e.target.value })}
              />
            </Field>
            <Field label={t("ui__план_ee229f3b")}>
              <input
                type="number"
                step="0.01"
                className={input}
                value={form.target_value}
                onChange={(e) =>
                  setForm({ ...form, target_value: e.target.value })
                }
              />
            </Field>
            <Field label={t("ui__факт_0a982a27")}>
              <input
                type="number"
                step="0.01"
                className={input}
                value={form.actual_value}
                onChange={(e) =>
                  setForm({ ...form, actual_value: e.target.value })
                }
              />
            </Field>
          </div>
          <Field label={t("ui__комментарий_8d7ae9e2")}>
            <textarea
              className={input}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
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

function Card({
  label,
  value,
  color = "text-slate-900 dark:text-slate-100",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${color} font-mono`}>
        {value}
      </div>
    </div>
  );
}
