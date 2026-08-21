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

type Cost = {
  id: string;
  cost_date: string;
  category: string;
  amount: string;
  description?: string;
  cashbox_name?: string;
  currency_code?: string;
};
type Cashbox = { id: number; name: string; currency_id: number };
type Currency = { id: number; code: string };

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

export default function ExtraCostPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Cost[]>([]);
  const [boxes, setBoxes] = useState<Cashbox[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    q: "",
    date_from: monthAgo(),
    date_to: today(),
  });
  const [open, setOpen] = useState(false);

  const empty = {
    cost_date: today(),
    category: "",
    amount: 0,
    currency_id: null as number | null,
    cashbox_id: null as number | null,
    description: "",
  };
  const [form, setForm] = useState<any>(empty);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.date_from) p.set("date_from", filters.date_from);
      if (filters.date_to) p.set("date_to", filters.date_to);
      const qs = p.toString();
      setRows(
        (await api.get<Cost[]>(`/finance/extra-costs${qs ? "?" + qs : ""}`))
          .data
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    Promise.all([
      api
        .get<Cashbox[]>("/finance/cashboxes")
        .then((r) => setBoxes(r.data)),
      api
        .get<Currency[]>("/reference/currencies")
        .then((r) => setCurrencies(r.data)),
    ]).catch(() => {});
    load();
  }, []);

  async function save() {
    if (!form.category || !form.currency_id) {
      toast.error(t("ui__заполните_категорию_и_валюту_20ff5a2a"));
      return;
    }
    try {
      await api.post("/finance/extra-costs", {
        ...form,
        amount: Number(form.amount) || 0,
      });
      toast.success(t("ui__расход_добавлен_6ef110fa"));
      setOpen(false);
      setForm(empty);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }
  async function del(r: Cost) {
    if (!confirm(`«${r.category}» chiqimi o'chirilsinmi?`)) return;
    await api.delete(`/finance/extra-costs/${r.id}`);
    toast.success(t("ui__удалено_0c450c40"));
    load();
  }

  const filtered = useMemo(() => {
    if (!filters.q) return rows;
    const q = filters.q.toLowerCase();
    return rows.filter((r) =>
      (r.category + " " + (r.description || "") + " " + (r.cashbox_name || ""))
        .toLowerCase()
        .includes(q)
    );
  }, [rows, filters.q]);

  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered)
      m.set(r.category, (m.get(r.category) || 0) + Number(r.amount));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const cols: Column<Cost>[] = [
    {
      key: "cost_date",
      header: t("ui__дата_8cdd8bb7"),
      width: "140px",
      render: (r) => new Date(r.cost_date).toLocaleDateString("ru-RU"),
    },
    { key: "category", header: t("ui__категория_c95a1e2d") },
    {
      key: "description",
      header: t("ui__описание_38ca0af8"),
      render: (r) => r.description || "—",
    },
    {
      key: "cashbox_name",
      header: t("ui__касса_c85fd621"),
      render: (r) => r.cashbox_name || "—",
      width: "160px",
    },
    {
      key: "amount",
      header: t("ui__сумма_cf59ebf9"),
      align: "right",
      width: "180px",
      render: (r) => (
        <span className="font-mono text-red-700 dark:text-red-400">
          −{fmt(r.amount)} {r.currency_code}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__дополнительные_расходы_8c0f051b")}
        description={t("ui__внеплановые_расходы_аренда_усл_33d267a9")}
        onCreate={() => {
          setForm(empty);
          setOpen(true);
        }}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="sm:col-span-2 relative">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__поиск_категория_описание_23bd63c5")}
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
            {t("ui__с_даты_09fc6619")}
          </label>
          <input
            type="date"
            className={input}
            value={filters.date_from}
            onChange={(e) =>
              setFilters({ ...filters, date_from: e.target.value })
            }
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__по_дату_760bcfc8")}
          </label>
          <input
            type="date"
            className={input}
            value={filters.date_to}
            onChange={(e) =>
              setFilters({ ...filters, date_to: e.target.value })
            }
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={load}
            className="w-full px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700"
          >
            {t("ui__применить_2cd84411")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card label={t("ui__сумма_cf59ebf9")} value={fmt(total)} sub={`${filtered.length} ta yozuv`} />
        <Card
          label={t("ui__топ_категория_75409665")}
          value={byCategory[0]?.[0] || "—"}
          sub={byCategory[0] ? fmt(byCategory[0][1]) : ""}
        />
        <Card
          label={t("ui__категорий_4c2c134b")}
          value={String(byCategory.length)}
          sub="turli"
        />
      </div>

      <DataTable columns={cols} rows={filtered} loading={loading} onDelete={del} />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("ui__новый_расход_6c0a62a7")}
        size="lg"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("ui__дата_8cdd8bb7")} required>
              <input
                type="date"
                className={input}
                value={form.cost_date}
                onChange={(e) =>
                  setForm({ ...form, cost_date: e.target.value })
                }
              />
            </Field>
            <Field label={t("ui__категория_c95a1e2d")} required>
              <input
                className={input}
                placeholder={t("ui__аренда_услуги_налоги_3e3103bd")}
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
              />
            </Field>
            <Field label={t("ui__сумма_cf59ebf9")} required>
              <input
                type="number"
                step="0.01"
                className={input}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label={t("ui__валюта_cf55d9a9")} required>
              <select
                className={input}
                value={form.currency_id || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    currency_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">{t("ui__выбрать_fbbc1d13")}</option>
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("ui__касса_списать_с_6e18b9e3")}>
              <select
                className={input}
                value={form.cashbox_id || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    cashbox_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">{t("ui__только_учёт_99bf8b5e")}</option>
                {boxes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t("ui__описание_38ca0af8")}>
            <textarea
              className={input}
              rows={2}
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
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100 font-mono">
        {value}
      </div>
      <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
        {sub}
      </div>
    </div>
  );
}
