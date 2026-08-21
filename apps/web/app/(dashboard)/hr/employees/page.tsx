"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Search } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Emp = {
  id: string;
  uuid_label?: string;
  full_name: string;
  position_id?: number;
  position_name?: string;
  phone?: string;
  email?: string;
  salary?: string;
  salary_currency?: number;
  currency_code?: string;
  hire_date?: string;
  balance?: string;
};
type Pos = { id: number; name: string };
type Cur = { id: number; code: string; name?: string };

const empty = {
  full_name: "",
  position_id: null as number | null,
  phone: "",
  email: "",
  salary: "",
  salary_currency: null as number | null,
  hire_date: "",
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function EmployeesPage() {
  const t = useTranslations("ui");
  const router = useRouter();
  const [rows, setRows] = useState<Emp[]>([]);
  const [positions, setPositions] = useState<Pos[]>([]);
  const [currencies, setCurrencies] = useState<Cur[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: "", position_id: "" });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.q) p.set("q", filters.q);
      if (filters.position_id) p.set("position_id", filters.position_id);
      const qs = p.toString();
      setRows((await api.get<Emp[]>(`/hr/employees${qs ? "?" + qs : ""}`)).data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([
      api.get<Pos[]>("/hr/positions").then((r) => setPositions(r.data)).catch(() => {}),
      api.get<Cur[]>("/reference/currencies").then((r) => setCurrencies(r.data)).catch(() => {}),
    ]);
    load();
  }, []);

  async function save() {
    try {
      const payload = {
        ...form,
        position_id: form.position_id || null,
        salary: form.salary ? Number(form.salary) : null,
        salary_currency: form.salary_currency || null,
        hire_date: form.hire_date || null,
      };
      if (editId) await api.put(`/hr/employees/${editId}`, payload);
      else await api.post("/hr/employees", payload);
      toast.success(t("ui__сохранено_54a59b19"));
      setOpen(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }
  async function del(r: Emp) {
    if (!confirm(`«${r.full_name}» ishdan bo'shatilsinmi?`)) return;
    await api.delete(`/hr/employees/${r.id}`);
    toast.success(t("ui__уволен_ea0713a7"));
    load();
  }

  const columns: Column<Emp>[] = [
    {
      key: "uuid_label",
      header: t("ui__id_номер_e669322b"),
      width: "110px",
      render: (r) => (
        <code className="text-xs text-slate-600 dark:text-slate-400">
          {r.uuid_label || "—"}
        </code>
      ),
    },
    { key: "full_name", header: t("ui__фио_72d974de") },
    {
      key: "position_name",
      header: t("ui__должность_b9723619"),
      width: "160px",
      render: (r) => r.position_name || "—",
    },
    {
      key: "phone",
      header: t("ui__телефон_2928e19c"),
      width: "140px",
      render: (r) => r.phone || "—",
    },
    {
      key: "email",
      header: "Email",
      width: "180px",
      render: (r) => r.email || "—",
    },
    {
      key: "salary",
      header: t("ui__зарплата_c84a5e92"),
      align: "right",
      width: "140px",
      render: (r) =>
        r.salary ? (
          <span className="font-mono">
            {fmt(r.salary)} {r.currency_code || ""}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "balance",
      header: t("ui__баланс_95dcad97"),
      align: "right",
      width: "130px",
      render: (r) => {
        const v = Number(r.balance || 0);
        const cls =
          v > 0
            ? "text-green-700 dark:text-green-400"
            : v < 0
            ? "text-red-700 dark:text-red-400"
            : "text-slate-500 dark:text-slate-400";
        return <span className={`font-mono ${cls}`}>{fmt(v)}</span>;
      },
    },
    {
      key: "hire_date",
      header: t("ui__принят_d5f9b149"),
      width: "120px",
      render: (r) =>
        r.hire_date ? new Date(r.hire_date).toLocaleDateString("ru-RU") : "—",
    },
    {
      key: "id" as any,
      header: "",
      align: "center",
      width: "60px",
      render: (r) => (
        <button
          onClick={() => router.push(`/hr/employees/${r.id}`)}
          className="text-brand-600 hover:text-brand-700 dark:text-brand-400"
          title={t("ui__профиль_a46c3723")}
          aria-label={`${r.full_name} profilini ko'rish`}
        >
          <Eye size={14} aria-hidden="true" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__сотрудники_4b5a95bc")}
        description={t("ui__кадровый_учет_20f715b6")}
        onCreate={() => {
          setForm(empty);
          setEditId(null);
          setOpen(true);
        }}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__поиск_фио_телефон_email_1064a472")}
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
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__должность_b9723619")}
          </label>
          <select
            className={input}
            value={filters.position_id}
            onChange={(e) =>
              setFilters({ ...filters, position_id: e.target.value })
            }
          >
            <option value="">{t("ui__все_a07b234e")}</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={load}
            className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700"
          >
            {t("ui__фильтр_2f884b41")}
          </button>
          <button
            onClick={() => {
              setFilters({ q: "", position_id: "" });
              setTimeout(load, 0);
            }}
            className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {t("ui__сброс_1b421ddb")}
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        onEdit={(r) => {
          setForm({
            full_name: r.full_name,
            position_id: r.position_id || null,
            phone: r.phone || "",
            email: r.email || "",
            salary: r.salary || "",
            salary_currency: r.salary_currency || null,
            hire_date: r.hire_date?.slice(0, 10) || "",
          });
          setEditId(r.id);
          setOpen(true);
        }}
        onDelete={del}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Xodimni tahrirlash" : "Yangi xodim"}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label={t("ui__фио_72d974de")} required>
              <input
                className={input}
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t("ui__должность_b9723619")}>
            <select
              className={input}
              value={form.position_id || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  position_id: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">{t("ui__нет_7b07413e")}</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("ui__дата_приёма_41df5fee")}>
            <input
              type="date"
              className={input}
              value={form.hire_date}
              onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
            />
          </Field>
          <Field label={t("ui__телефон_2928e19c")}>
            <input
              className={input}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className={input}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label={t("ui__зарплата_c84a5e92")}>
            <input
              type="number"
              step="0.01"
              className={input}
              value={form.salary}
              onChange={(e) => setForm({ ...form, salary: e.target.value })}
            />
          </Field>
          <Field label={t("ui__валюта_зарплаты_5c696c9a")}>
            <select
              className={input}
              value={form.salary_currency || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  salary_currency: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">{t("ui__нет_7b07413e")}</option>
              {currencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code || c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
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
